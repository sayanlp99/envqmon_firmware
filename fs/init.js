load('api_config.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_gpio.js');
load('api_adc.js');
load('api_i2c.js');
load('api_sys.js');
load('api_log.js');
load('api_math.js');
load('api_uart.js');

// Constants for analog pins and I2C
let ANALOG_PIN_MQ_CO = 34;      // pin for CO sensor
let ANALOG_PIN_MQ_METHANE = 35; // pin for Methane sensor
let ANALOG_PIN_MQ_LPG = 32;     // pin for LPG sensor
let ANALOG_PIN_LIGHT = 33;      // pin for light sensor
let ANALOG_PIN_SOUND = 39;      // pin for sound sensor

// I2C setup for BME280
let i2c = I2C.get();
let BME280_ADDR = 0x76;         // BME280 default I2C address

// UART setup for PMS5003
let UART_NO = 2;                // UART2 (RXD2 on pin 16)
let PMS5003_BAUD = 9600;        // PMS5003 uses 9600 baud rate

// Configure UART for PMS5003
UART.setConfig(UART_NO, {
  baud: PMS5003_BAUD,
  rxPin: 16,                    // RX pin for PMS5003
  txPin: -1,                    // TX not used for PMS5003 (passive mode)
  bufferSize: 256               // Buffer for incoming data
});

// Function to read analog sensors
function readAnalogSensor(pin) {
  let value = ADC.read(pin);
  return (value / 4095.0) * 100.0;
}

// Function to read PMS5003 sensor data
function getPMValues() {
  let pmData = { pm25: 0, pm10: 0 };
  let buffer = '';
  let start1 = 0x42, start2 = 0x4d; // PMS5003 frame start bytes
  let frameLength = 32;             // PMS5003 frame length in bytes

  // Read UART data
  UART.setRxEnabled(UART_NO, true);
  let timeout = Sys.uptime() + 5;   // 5-second timeout
  while (Sys.uptime() < timeout) {
    let byte = UART.readByte(UART_NO);
    if (byte >= 0) {
      buffer += String.fromCharCode(byte);
      if (buffer.length() >= frameLength) {
        // Check for valid frame start
        if (buffer.charCodeAt(0) === start1 && buffer.charCodeAt(1) === start2) {
          // Verify frame length and checksum
          let frameLen = (buffer.charCodeAt(2) << 8) + buffer.charCodeAt(3);
          if (frameLen + 4 <= buffer.length()) {
            let checksum = 0;
            for (let i = 0; i < frameLen + 2; i++) {
              checksum += buffer.charCodeAt(i);
            }
            let receivedChecksum = (buffer.charCodeAt(frameLen + 2) << 8) + buffer.charCodeAt(frameLen + 3);
            if (checksum === receivedChecksum) {
              // Extract PM2.5 and PM10 (standard particles, CF=1)
              pmData.pm25 = (buffer.charCodeAt(4) << 8) + buffer.charCodeAt(5);
              pmData.pm10 = (buffer.charCodeAt(6) << 8) + buffer.charCodeAt(7);
              break;
            }
          }
          // Clear buffer if frame is invalid
          buffer = buffer.slice(-frameLength);
        }
      }
    }
    Sys.usleep(1000); // Small delay to prevent CPU overload
  }
  UART.setRxEnabled(UART_NO, false);
  return pmData;
}

// Function to read raw data from BME280 via I2C
function readBME280Data() {
  let temp, pressure, humidity;
  // Mock data for demonstration purposes
  temp = 23.36 + Math.random() * 2 - 1;
  pressure = 1011.36 + Math.random() * 5 - 2.5;
  humidity = 71.73 + Math.random() * 3 - 1.5;

  return {
    temperature: temp,
    pressure: pressure,
    humidity: humidity
  };
}

// Main function to collect all sensor data
function collectSensorData() {
  let data = {};

  // Read BME280 data via I2C
  let bmeData = readBME280Data();
  data.temperature = bmeData.temperature;
  data.pressure = bmeData.pressure;
  data.humidity = bmeData.humidity;

  // Read analog sensors
  data.co = readAnalogSensor(ANALOG_PIN_MQ_CO);
  data.methane = readAnalogSensor(ANALOG_PIN_MQ_METHANE);
  data.lpg = readAnalogSensor(ANALOG_PIN_MQ_LPG);
  data.light = readAnalogSensor(ANALOG_PIN_LIGHT);
  data.noise = readAnalogSensor(ANALOG_PIN_SOUND);

  // Get PMS5003 PM values
  let pmData = getPMValues();
  data.pm25 = pmData.pm25;
  data.pm10 = pmData.pm10;

  // Add a timestamp
  data.recorded_at = Sys.uptime();

  return data;
}

// Timer to send data every 10 seconds
Timer.set(10000, Timer.REPEAT, function() {
  let deviceId = Cfg.get('device.id');
  let topic = 'envqmon/' + deviceId;

  // Collect and format data
  let sensorData = collectSensorData();
  let msg = JSON.stringify(sensorData);

  // Publish to MQTT
  let ok = MQTT.pub(topic, msg, 1, false);
  if (ok) {
    Log.info('Published to topic ' + topic + ': ' + msg);
  } else {
    Log.error('Failed to publish');
  }
}, null);
