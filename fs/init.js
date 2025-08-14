// Load required Mongoose OS libraries
load('api_config.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_gpio.js');
load('api_adc.js');
load('api_i2c.js');
load('api_sys.js');
load('api_log.js');
load('api_math.js');

// Constants for analog pins and I2C
let ANALOG_PIN_MQ_CO = 34;      // pin for CO sensor
let ANALOG_PIN_MQ_METHANE = 35; // pin for Methane sensor
let ANALOG_PIN_MQ_LPG = 32;     // pin for LPG sensor
let ANALOG_PIN_LIGHT = 33;      // pin for light sensor
let ANALOG_PIN_SOUND = 39;      // pin for sound sensor

// I2C setup for BME280
let i2c = I2C.get();
let BME280_ADDR = 0x76;         // BME280 default I2C address

// Function to read analog sensors (mocking complex logic for simplicity)
function readAnalogSensor(pin) {
  let value = ADC.read(pin);
  // Simple linear mapping for demonstration. Calibration is needed.
  return (value / 4095.0) * 100.0;
}

// Function to simulate PM2.5 and PM10 values
function getPMValues() {
  // Replace with actual sensor readings if you have a PM sensor
  return {
    pm25: 35.75,
    pm10: 62.35
  };
}

// Function to read raw data from BME280 via I2C
function readBME280Data() {
  let temp, pressure, humidity;
  // This is a simplified example. A full implementation requires reading calibration
  // data and performing complex calculations, which is what api_bme280.js handles.
  // For this direct I2C approach, we will use mock data to demonstrate the concept.
  
  // In a real scenario, you would perform I2C transactions here to read registers.
  // Example (conceptual):
  // i2c.readReg(BME280_ADDR, 0xF7, 8); // Read temperature, pressure, humidity registers
  
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

  // Get simulated PM values
  let pmData = getPMValues();
  data.pm25 = pmData.pm25;
  data.pm10 = pmData.pm10;

  // Add a timestamp
  data.recorded_at = Sys.uptime();

  return data;
}

// Timer to send data every 5 seconds
Timer.set(5000, Timer.REPEAT, function() {
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
