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

// Constants for sensor pins
let PIN_MQ9_CO = 34;            // MQ9 CO sensor (ADC1_CH6)
let PIN_MQ135_CO2 = 35;         // MQ135 CO2-equivalent sensor (ADC1_CH7)
let PIN_TEMT6000_LIGHT = 32;    // TEMT6000 light sensor (ADC1_CH4)
let PIN_LM393_SOUND = 39;       // LM393 sound sensor (ADC1_CH0)
let UART_NO = 2;                // UART2 for PMS5003 (RX on GPIO 16)
let PMS5003_BAUD = 9600;        // PMS5003 baud rate
let I2C_SCL = 21;               // BME280 SCL pin
let I2C_SDA = 22;               // BME280 SDA pin
let BME280_ADDR = 0x76;         // BME280 I2C address

// BME280 register addresses
let REG_DIG_T1 = 0x88;
let REG_DIG_T2 = 0x8A;
let REG_DIG_T3 = 0x8C;
let REG_DIG_P1 = 0x8E;
let REG_DIG_P2 = 0x90;
let REG_DIG_P3 = 0x92;
let REG_DIG_P4 = 0x94;
let REG_DIG_P5 = 0x96;
let REG_DIG_P6 = 0x98;
let REG_DIG_P7 = 0x9A;
let REG_DIG_P8 = 0x9C;
let REG_DIG_P9 = 0x9E;
let REG_DIG_H1 = 0xA1;
let REG_DIG_H2 = 0xE1;
let REG_DIG_H3 = 0xE3;
let REG_DIG_H4 = 0xE4;
let REG_DIG_H5 = 0xE5;
let REG_DIG_H6 = 0xE7;
let REG_CHIP_ID = 0xD0;
let REG_CTRL_HUM = 0xF2;
let REG_CTRL_MEAS = 0xF4;
let REG_CONFIG = 0xF5;
let REG_DATA = 0xF7;

// ADC configuration
ADC.enable(PIN_MQ9_CO);
ADC.enable(PIN_MQ135_CO2);
ADC.enable(PIN_TEMT6000_LIGHT);
ADC.enable(PIN_LM393_SOUND);

// I2C setup
let i2c = I2C.get();

// UART setup for PMS5003
UART.setConfig(UART_NO, {
  baud: PMS5003_BAUD,
  rxPin: 16,                    // RX pin for PMS5003
  txPin: -1,                    // TX not used (passive mode)
  bufferSize: 256               // Buffer for incoming data
});

// BME280 calibration data
let calib = {};

// Function to initialize BME280
function initBME280() {
  // Verify chip ID
  let chipId = I2C.readRegB(i2c, BME280_ADDR, REG_CHIP_ID);
  if (chipId !== 0x60) {
    Log.error('BME280 not found or wrong chip ID: 0x' + chipId.toString(16));
    return false;
  }

  // Read calibration data
  calib.dig_T1 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_T1);
  calib.dig_T2 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_T2, true);
  calib.dig_T3 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_T3, true);
  calib.dig_P1 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P1);
  calib.dig_P2 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P2, true);
  calib.dig_P3 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P3, true);
  calib.dig_P4 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P4, true);
  calib.dig_P5 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P5, true);
  calib.dig_P6 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P6, true);
  calib.dig_P7 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P7, true);
  calib.dig_P8 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P8, true);
  calib.dig_P9 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_P9, true);
  calib.dig_H1 = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H1);
  calib.dig_H2 = I2C.readRegW(i2c, BME280_ADDR, REG_DIG_H2, true);
  calib.dig_H3 = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H3);
  let h4 = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H4);
  let h4_lsb = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H4 + 1);
  calib.dig_H4 = (h4 << 4) | (h4_lsb & 0x0F);
  let h5_lsb = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H5);
  let h5_msb = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H5 + 1);
  calib.dig_H5 = (h5_msb << 4) | (h5_lsb >> 4);
  calib.dig_H6 = I2C.readRegB(i2c, BME280_ADDR, REG_DIG_H6, true);

  // Configure BME280: 1x oversampling, normal mode
  I2C.writeRegB(i2c, BME280_ADDR, REG_CTRL_HUM, 0x01); // Humidity 1x
  I2C.writeRegB(i2c, BME280_ADDR, REG_CTRL_MEAS, 0x27); // Temp 1x, Pressure 1x
  I2C.writeRegB(i2c, BME280_ADDR, REG_CONFIG, 0xA0); // Standby 1000ms, filter off

  Log.info('BME280 initialized successfully');
  return true;
}

// Function to read analog sensors
function readAnalogSensor(pin) {
  if (pin === PIN_LM393_SOUND) {
    // LM393: Measure RMS voltage over 125ms (approx. 100 samples at 800Hz)
    let samples = 100;
    let sum_squares = 0;
    let start_time = Sys.uptime();
    for (let i = 0; i < samples; i++) {
      let value = ADC.read(pin);
      let voltage = (value / 4095.0) * 3.3; // Convert to voltage (3.3V ref)
      sum_squares += voltage * voltage;
      Sys.usleep(1250); // 1.25ms delay for ~800Hz sampling
    }
    let rms_voltage = Math.sqrt(sum_squares / samples);
    
    // Convert to dB SPL (approximate, requires calibration)
    // Formula: dB = 40 + 20 * log10(Vrms / Vref)
    // Vref = voltage at 40 dB (e.g., quiet room), adjust via calibration
    let Vref = 0.01; // Placeholder: calibrate with reference meter
    let db = 40 + 20 * Math.log10(rms_voltage > Vref ? rms_voltage / Vref : 1);
    db = db < 40 ? 40 : db > 90 ? 90 : db; // Clamp to 40-90 dB
    return db;
  } else {
    // MQ9, MQ135, TEMT6000: Percentage scaling (calibration needed for ppm/lux)
    let value = ADC.read(pin);
    return (value / 4095.0) * 100.0;
  }
}

// Function to read PMS5003 sensor data
function getPMValues() {
  let pmData = { pm25: 0, pm10: 0 };
  let buffer = '';
  let start1 = 0x42, start2 = 0x4d; // PMS5003 frame start bytes
  let frameLength = 32;             // PMS5003 frame length in bytes

  // Clear UART buffer to avoid overflow
  UART.flush(UART_NO);
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
          // Shift buffer to keep latest bytes
          buffer = buffer.slice(-frameLength);
        }
      }
    }
    Sys.usleep(1000); // Prevent CPU overload
  }
  UART.setRxEnabled(UART_NO, false);
  return pmData;
}

// Function to read and compensate BME280 data
function readBME280Data() {
  // Retry up to 3 times for I2C read
  let retries = 3;
  let data = null;
  while (retries > 0 && !data) {
    data = I2C.readRegN(i2c, BME280_ADDR, REG_DATA, 8);
    if (!data || data.length() < 8) {
      Log.warn('BME280 read failed, retrying... (' + retries + ')');
      retries--;
      Sys.usleep(10000); // 10ms delay between retries
    }
  }
  if (!data || data.length() < 8) {
    Log.error('Failed to read BME280 data after retries');
    return { temperature: 0, pressure: 0, humidity: 0 };
  }

  // Extract raw values
  let raw_temp = (data.charCodeAt(3) << 12) | (data.charCodeAt(4) << 4) | (data.charCodeAt(5) >> 4);
  let raw_press = (data.charCodeAt(0) << 12) | (data.charCodeAt(1) << 4) | (data.charCodeAt(2) >> 4);
  let raw_hum = (data.charCodeAt(6) << 8) | data.charCodeAt(7);

  // Temperature compensation
  let var1 = (((raw_temp >> 3) - (calib.dig_T1 << 1)) * calib.dig_T2) >> 11;
  let var2 = (((((raw_temp >> 4) - calib.dig_T1) * ((raw_temp >> 4) - calib.dig_T1)) >> 12) * calib.dig_T3) >> 14;
  let t_fine = var1 + var2;
  let temp = ((t_fine * 5 + 128) >> 8) / 100.0;

  // Pressure compensation
  var1 = (t_fine >> 1) - 64000;
  var2 = (((var1 >> 2) * (var1 >> 2)) >> 11) * calib.dig_P6;
  var2 = var2 + ((var1 * calib.dig_P5) << 1);
  var2 = (var2 >> 2) + (calib.dig_P4 << 16);
  var1 = (((calib.dig_P3 * ((var1 >> 2) * (var1 >> 2)) >> 13) >> 3) + ((calib.dig_P2 * var1) >> 1)) >> 18;
  var1 = ((32768 + var1) * calib.dig_P1) >> 15;
  if (var1 === 0) {
    Log.warn('BME280 pressure division by zero');
    return { temperature: temp, pressure: 0, humidity: 0 };
  }
  let press = (((1048576 - raw_press) - (var2 >> 12)) * 3125);
  if (press < 0x80000000) {
    press = (press << 1) / var1;
  } else {
    press = (press / var1) * 2;
  }
  var1 = (calib.dig_P9 * (((press >> 3) * (press >> 3)) >> 13)) >> 12;
  var2 = ((press >> 2) * calib.dig_P8) >> 13;
  press = press + ((var1 + var2 + calib.dig_P7) >> 4);
  press = press / 100.0; // Convert to hPa

  // Humidity compensation
  var1 = t_fine - 76800;
  var1 = (((raw_hum << 14) - (calib.dig_H4 << 20) - (calib.dig_H5 * var1)) +
          16384) >> 15;
  var1 = var1 * (((((((var1 * calib.dig_H6) >> 10) *
          (((var1 * calib.dig_H3) >> 11) + 32768)) >> 10) + 2097152) *
          calib.dig_H2 + 8192) >> 14);
  var1 = var1 - (((((var1 >> 15) * (var1 >> 15)) >> 7) * calib.dig_H1) >> 4);
  var1 = var1 < 0 ? 0 : var1;
  var1 = var1 > 419430400 ? 419430400 : var1;
  let hum = (var1 >> 12) / 1024.0;

  return {
    temperature: temp,
    pressure: press,
    humidity: hum
  };
}

// Main function to collect all sensor data
function collectSensorData() {
  let data = {};

  // Read BME280 data
  let bmeData = readBME280Data();
  data.temperature = bmeData.temperature;
  data.pressure = bmeData.pressure;
  data.humidity = bmeData.humidity;

  // Read analog sensors
  data.co = readAnalogSensor(PIN_MQ9_CO);           // MQ9: CO concentration (%)
  data.co2 = readAnalogSensor(PIN_MQ135_CO2);       // MQ135: CO2-equivalent (%)
  data.light = readAnalogSensor(PIN_TEMT6000_LIGHT); // TEMT6000: Light intensity (%)
  data.noise = readAnalogSensor(PIN_LM393_SOUND);   // LM393: Noise level (dB SPL)

  // Read PMS5003 data
  let pmData = getPMValues();
  data.pm25 = pmData.pm25;  // PM2.5 (µg/m³)
  data.pm10 = pmData.pm10;  // PM10 (µg/m³)

  // Add timestamp
  data.recorded_at = Sys.uptime();

  return data;
}

// Initialize BME280
if (!initBME280()) {
  Log.error('BME280 initialization failed. Check wiring or address (0x76).');
}

// Warm-up period for MQ9, MQ135, and PMS5003
let WARMUP_TIME = 20000; // 20 seconds in milliseconds
Log.info('Starting 20-second warm-up for MQ9, MQ135, and PMS5003 sensors...');

// Start data collection after warm-up
Timer.set(WARMUP_TIME, false, function() {
  Log.info('Warm-up complete. Starting data collection and MQTT publishing.');

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
      Log.error('Failed to publish to MQTT');
    }
  }, null);
}, null);
