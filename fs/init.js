load('api_gpio.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_sys.js');
load('api_config.js');

let led_pin = 2; // GPIO2 is usually the built-in LED on ESP32 boards
GPIO.set_mode(led_pin, GPIO.MODE_OUTPUT);

print("Hello ESP32!");

let mqtt_topic = 'airqmon/' + Cfg.get('device.id');

print('MQTT topic:', mqtt_topic);

MQTT.sub(mqtt_topic, function(conn, topic, msg) {
  print('Topic:', topic, 'message:', msg);
  let parsed = JSON.parse(msg);
  let op = parsed.op;
  if(op === "t"){
    GPIO.toggle(led_pin);
  }
}, null);

let btn_pin = 0; // GPIO0 is usually the button on ESP32 boards
GPIO.set_mode(btn_pin, GPIO.MODE_INPUT);

GPIO.set_button_handler(btn_pin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
  print('Button pressed!');
  let res = MQTT.pub(mqtt_topic, JSON.stringify({ a: 1, b: 2 }), 1);
  print('Published:', res ? 'yes' : 'no');
}, null);