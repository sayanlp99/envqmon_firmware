load('api_gpio.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_sys.js');
load('api_config.js');


let led_pin = 2; 
GPIO.set_mode(led_pin, GPIO.MODE_OUTPUT);

print("Hello ESP32!");

let mqtt_topic = 'envqmon/' + Cfg.get('device.id');

print('MQTT topic:', mqtt_topic);

Timer.set(10000, Timer.REPEAT, function() {
  let res = MQTT.pub(mqtt_topic, JSON.stringify({ a: 1, b: 2 }), 1);
  print('Published:', res ? 'yes' : 'no');
}, null);