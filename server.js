var app = require('express')();
var server = require('http').createServer(app);
var webRTC = require('webrtc.io').listen(server);

var port = process.env.PORT || 8080;
server.listen(port, function() {
  console.log("Now listening on port %d" % port);
});



app.get('/', function(req, res) {
  res.sendfile(__dirname + '/views/index.html');
});

app.get('/style.css', function(req, res) {
  res.sendfile(__dirname + '/public/css/style.css');
});

app.get('/jquery.fancybox.css', function(req, res) {
  res.sendfile(__dirname + '/public/css/jquery.fancybox.css');
});

app.get('/clamps.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/clamps.png');
});


app.get('/slider.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/slider.png');
});

app.get('/candles.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/candles.png');
});

app.get('/blind.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/blind.png');
});

app.get('/mute.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/mute.png');
});

app.get('/tooltip.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/tooltip.png');
});

app.get('/howdoesitwork.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/howdoesitwork.png');
});

app.get('/script.js', function(req, res) {
  res.sendfile(__dirname + '/public/js/script.js');
});

app.get('/webrtc.io.js', function(req, res) {
  res.sendfile(__dirname + '/public/js/webrtc.io.js');
});

app.get('/jquery.fancybox.pack.js', function(req, res) {
  res.sendfile(__dirname + '/public/js/jquery.fancybox.pack.js');
});

app.get('/jquery.fancybox-buttons.js', function(req, res) {
  res.sendfile(__dirname + '/public/js/jquery.fancybox-buttons.js');
});

app.get('/jquery.fancybox-buttons.css', function(req, res) {
  res.sendfile(__dirname + '/public/css/jquery.fancybox-buttons.css');
});

app.get('/fancybox_buttons.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/fancybox_buttons.png');
});

app.get('/fancybox_overlay.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/fancybox_overlay.png');
});

app.get('/fancybox_loading.gif ', function(req, res) {
  res.sendfile(__dirname + '/public/img/fancybox_loading.gif');
});

app.get('/fancybox_sprite.png', function(req, res) {
  res.sendfile(__dirname + '/public/img/fancybox_sprite.png');
});

webRTC.rtc.on('chat_msg', function(data, socket) {
  var roomList = webRTC.rtc.rooms[data.room] || [];

  for (var i = 0; i < roomList.length; i++) {
    var socketId = roomList[i];

    if (socketId !== socket.id) {
      var soc = webRTC.rtc.getSocket(socketId);

      if (soc) {
        soc.send(JSON.stringify({
          "eventName": "receive_chat_msg",
          "data": {
            "messages": data.messages,
            "color": data.color
          }
        }), function(error) {
          if (error) {
            console.log(error);
          }
        });
      }
    }
  }
});
