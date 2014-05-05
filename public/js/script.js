var videos = [];
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.RTCPeerConnection;
var fb_instance;
var fb_new_chat_room;
var fb_instance_users;
var dom = false;
var fb_requests;
var fb_responses;
var control_clamps;
var control_video;
var control_audio;
var clamps_on = false;

function getNumPerRow() {
  var len = videos.length;
  var biggest;

  // Ensure length is even for better division.
  if(len % 2 === 1) {
    len++;
  }

  biggest = Math.ceil(Math.sqrt(len));
  while(len % biggest !== 0) {
    biggest++;
  }
  return biggest;
}

function subdivideVideos() {
  var perRow = getNumPerRow();
  var numInRow = 0;
  for(var i = 0, len = videos.length; i < len; i++) {
    var video = videos[i];
    setWH(video, i);
    numInRow = (numInRow + 1) % perRow;
  }
}

function setWH(video, i) {
  var perRow = getNumPerRow();
  var perColumn = Math.ceil(videos.length / perRow);
  var width = Math.floor((window.innerWidth) / perRow);
  var height = Math.floor((window.innerHeight - 190) / perColumn);
  video.width = width;
  video.height = height;
  video.style.position = "absolute";
  video.style.left = (i % perRow) * width + "px";
  video.style.top = Math.floor(i / perRow) * height + "px";
}


/* Video cloned from the end of the socket gets added here */
function cloneVideo(domId, socketId) {
  var video = document.getElementById(domId);
  var clone = video.cloneNode(false);
  clone.id = "remote" + socketId;
  document.getElementById('videos').appendChild(clone);
  videos.push(clone);
  return clone;
}

function removeVideo(socketId) {
  var video = document.getElementById('remote' + socketId);
  if(video) {
    videos.splice(videos.indexOf(video), 1);
    video.parentNode.removeChild(video);
  }
}

function addToChat(msg, color) {
  var messages = document.getElementById('messages');
  msg = sanitize(msg);
  if(color) {
    msg = '<span style="color: ' + color + '; padding-left: 15px">' + msg + '</span>';
  } else {
    msg = '<strong style="padding-left: 15px">' + msg + '</strong>';
  }
  messages.innerHTML = messages.innerHTML + msg + '<br>';
  messages.scrollTop = 10000;
}

function sanitize(msg) {
  return msg.replace(/</g, '&lt;');
}

function initFullScreen() {
  var button = document.getElementById("fullscreen");
  button.addEventListener('click', function(event) {
    var elem = document.getElementById("videos");
    //show full screen
    elem.webkitRequestFullScreen();
  });
}

function setHash() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 30;
    var randomstring = '';
    for(var i = 0; i < string_length; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum + 1);
    }

    window.location.hash = randomstring;
    location.reload();
    return randomstring;
}

function initNewRoom() {
  var button = document.getElementById("newRoom");

  button.addEventListener('click', function(event) {
    setHash();
  });
}


var websocketChat = {
  send: function(message) {
    rtc._socket.send(message);
  },
  recv: function(message) {
    return message;
  },
  event: 'receive_chat_msg'
};

var dataChannelChat = {
  send: function(message) {
    for(var connection in rtc.dataChannels) {
      var channel = rtc.dataChannels[connection];
      channel.send(message);
    }
  },
  recv: function(channel, message) {
    return JSON.parse(message).data;
  },
  event: 'data stream data'
};

function initChat() {
  var chat;

  if(rtc.dataChannelSupport) {
    console.log('initializing data channel chat');
    chat = dataChannelChat;
  } else {
    console.log('initializing websocket chat');
    chat = websocketChat;
  }

  var input = document.getElementById("chatinput");
  // var toggleHideShow = document.getElementById("hideShowMessages");
  var room = window.location.hash.slice(1);
  var color = "#" + ((1 << 24) * Math.random() | 0).toString(16);

  // toggleHideShow.addEventListener('click', function() {
  //   var element = document.getElementById("messages");

  //   if(element.style.display === "block") {
  //     element.style.display = "none";
  //   }
  //   else {
  //     element.style.display = "block";
  //   }

  // });

  input.addEventListener('keydown', function(event) {
    var key = event.which || event.keyCode;
    if(key === 13) {
      chat.send(JSON.stringify({
        "eventName": "chat_msg",
        "data": {
          "messages": input.value,
          "room": room,
          "color": color
        }
      }));
      addToChat(input.value);
      input.value = "";
    }
  }, false);
  rtc.on(chat.event, function() {
    var data = chat.recv.apply(this, arguments);
    console.log(data.color);
    addToChat(data.messages, data.color.toString(16));
  });
}


function init() {
  /* Generate new chat hash if needed */
  $("#videos").hide();
  var url_segments = document.location.href.split("#");
  var hash = url_segments[1];
  if(!hash){
    hash = setHash();
  } else {
    /* Connect to Firebase */
    fb_instance = new Firebase("https://dynamixxx.firebaseio.com");
    fb_new_chat_room = fb_instance.child('chatrooms').child(hash);
    fb_instance_users = fb_new_chat_room.child('users');
    fb_instance_users.once('value', function(snapshot) { 
      var num_users = snapshot.numChildren();
      if(num_users > 1) {
        alert("There are already two users in this chat. Redirecting to new chat...")
        setHash();
      } else {
        if (num_users == 0) {
          dom = true;
          $("#dom-status").show();
        } else {
          $("#sub-status").show();
        }
        fb_requests = fb_new_chat_room.child('permissions').child('requests');
        fb_responses = fb_new_chat_room.child('permissions').child('responses');
        
        /* Prompt name and add user to chat */
        var username = window.prompt(dom? "What will your partner call you?": "What would you like to be called?");
        if(!username){
          username = "anonymous"+Math.floor(Math.random()*1111);
        }
        // TODO: check if username already exists in chat, prompt again if so
        fb_instance_users.push({ name: username });
        var initiation_div = (dom? "dom-initiation": "sub-initiation");
        document.getElementById(initiation_div).style.display="block";

        /* This part initiates the request to access camera/mic, should wait until after initiation to do so 
            (not doing this right now because chat is routed through the same socket */
        if(PeerConnection) {
          rtc.createStream({
            "video": {"mandatory": {}, "optional": []},
            "audio": true
          }, function(stream) {
            document.getElementById('you').src = URL.createObjectURL(stream);
            document.getElementById('you').play();
            //videos.push(document.getElementById('you'));
            //rtc.attachStream(stream, 'you');
            //subdivideVideos();
          });
        } else {
          alert('Your browser is not supported or you have to turn on flags. In chrome you go to chrome://flags and turn on Enable PeerConnection remember to restart chrome');
        }


      }

      /* Set up RTC */
      var room = window.location.hash.slice(1);
      rtc.connect("ws:" + window.location.href.substring(window.location.protocol.length).split('#')[0], room);
      rtc.on('add remote stream', function(stream, socketId) {
        console.log("ADDING REMOTE STREAM...");
        var clone = cloneVideo('you', socketId);
        document.getElementById(clone.id).setAttribute("class", "partner-video");
        rtc.attachStream(stream, clone.id);
        subdivideVideos();
      });
      rtc.on('disconnect stream', function(data) {
        console.log('remove ' + data);
        removeVideo(data);
      });
      initChat();
      dom? initDomInitiation(): initSubInitiation();

    });
  }
}

function checkAllNegotiated(num_negotiated) {
  console.log(num_negotiated);
  if(num_negotiated == 3) {
    $(".start-session").addClass("start-session-enabled");
    $(".start-session").click(startChat);
  }
}

// on okays, need to add class to the outer option div so it will turn green
// on all three okayed, need to add class to start session that allows for it to be clickable
// need to add some more text so it's clear to each partner what's been agreed upon
// should add ability to reset negotiations

function initDomInitiation() {
  var num_negotiated = 0;

    fb_responses.on("child_added",function(snapshot){
      var option = snapshot.val()['option'];
      var status = snapshot.val()['status'];

      if(option == 'clamps') {
        if (status == 'granted') {
          $("#awaiting-clamps-permission").hide();
          $("#dom-clamps-negotiated").show();
          $("#clamps-control").addClass("okay");
          control_clamps = true;
          checkAllNegotiated(++num_negotiated);
        } else {
          $("#request-clamps").show();
          $("#giveup-clamps").show();
          $("#awaiting-clamps-permission").hide();
          $("#clamps-permission-denied").show();
        }
      } else if (option == 'video') {
        if (status == 'granted') {
          $("#awaiting-video-permission").hide();
          $("#dom-video-negotiated").show();
          $("#video-control").addClass("okay");
          control_video = true;
          checkAllNegotiated(++num_negotiated);
        } else {
          $("#request-video").show();
          $("#giveup-video").show();
          $("#awaiting-video-permission").hide();
          $("#video-permission-denied").show();
        }
      } else if (option == 'audio') {
        if (status == 'granted') {
          $("#awaiting-audio-permission").hide();
          $("#dom-audio-negotiated").show();
          $("#audio-control").addClass("okay");
          control_audio = true;
          checkAllNegotiated(++num_negotiated);
        } else {
          $("#awaiting-audio-permission").hide();
          $("#request-audio").show();
          $("#giveup-audio").show();
          $("#audio-permission-denied").show();
        }
      }
    });

  $("#request-clamps").click(function() {
    $("#request-clamps").hide();
    $("#giveup-clamps").hide();
    $("#awaiting-clamps-permission").show();
    $("#clamps-permission-denied").hide();
    fb_requests.push({'option': 'clamps', 'status': 'requested'});
  });
  $("#giveup-clamps").click(function() {
    $("#request-clamps").hide();
    $("#giveup-clamps").hide();
    $("#dom-clamps-negotiated").show();
    $("#clamps-control").addClass("okay");
    control_clamps = false;
    checkAllNegotiated(++num_negotiated);
    $("#clamps-permission-denied").hide();
    fb_requests.push({'option': 'clamps', 'status': 'given up'});
  });
  $("#request-video").click(function() {
    $("#request-video").hide();
    $("#giveup-video").hide();
    $("#awaiting-video-permission").show();
    $("#video-permission-denied").hide();
    fb_requests.push({'option': 'video', 'status': 'requested'});
  });
  $("#giveup-video").click(function() {
    $("#request-video").hide();
    $("#giveup-video").hide();
    $("#dom-video-negotiated").show();
    control_video = false;
    checkAllNegotiated(++num_negotiated);
    $("#video-control").addClass("okay");
    $("#video-permission-denied").hide();
    fb_requests.push({'option': 'video', 'status': 'given up'});
  });
  $("#request-audio").click(function() {
    $("#request-audio").hide();
    $("#giveup-audio").hide();
    $("#awaiting-audio-permission").show();
    $("#audio-permission-denied").hide();
    fb_requests.push({'option': 'audio', 'status': 'requested'});
  });
  $("#giveup-audio").click(function() {
    $("#request-audio").hide();
    $("#giveup-audio").hide();
    $("#dom-audio-negotiated").show();
    $("#audio-control").addClass("okay");
    control_audio - false;
    checkAllNegotiated(++num_negotiated);
    $("#audio-permission-denied").hide();
    fb_requests.push({'option': 'audio', 'status': 'given up'});
  });
}

function initSubInitiation() {
    var num_negotiated = 0;

    fb_requests.on("child_added",function(snapshot){
      var option = snapshot.val()['option'];
      var status = snapshot.val()['status'];

      if(option == 'clamps') {
        if (status == 'requested') {
          $("#grant-clamps").show();
          $("#deny-clamps").show();
          $("#awaiting-clamps-request").hide();
        } else {
          $("#awaiting-clamps-request").hide();
          $("#sub-clamps-negotiated").show();
          $("#sub-clamps-control").addClass("okay");
          checkAllNegotiated(++num_negotiated);
        }
      } else if (option == 'video') {
        if (status == 'requested') {
          $("#grant-video").show();
          $("#deny-video").show();
          $("#awaiting-video-request").hide();
        } else {
          $("#awaiting-video-request").hide();
          $("#sub-video-negotiated").show();
          $("#sub-video-control").addClass("okay");
          checkAllNegotiated(++num_negotiated);
        }
      } else if (option == 'audio') {
        if (status == 'requested') {
          $("#grant-audio").show();
          $("#deny-audio").show();
          $("#awaiting-audio-request").hide();
        } else {
          $("#awaiting-audio-request").hide();
          $("#sub-audio-negotiated").show();
          $("#sub-audio-control").addClass("okay");
          checkAllNegotiated(++num_negotiated);
        }
      }
    });

  $("#grant-clamps").click(function() {
    fb_responses.push({'option': 'clamps', 'status': 'granted'});
    $("#grant-clamps").hide();
    $("#deny-clamps").hide();
    $("#sub-clamps-negotiated").show();
    $("#sub-clamps-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    console.log("clamps granted");
  });
  $("#deny-clamps").click(function() {
    fb_responses.push({'option': 'clamps', 'status': 'denied'});
    $("#grant-clamps").hide();
    $("#deny-clamps").hide();
    $("#awaiting-clamps-request").show();
    console.log("clamps denied");
  });
  $("#grant-video").click(function() {
    fb_responses.push({'option': 'video', 'status': 'granted'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#sub-video-negotiated").show();
    $("#sub-video-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    console.log("video granted");
  });
  $("#deny-video").click(function() {
    fb_responses.push({'option': 'video', 'status': 'denied'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#awaiting-video-request").show();
    console.log("video denied");
  });
  $("#grant-audio").click(function() {
    fb_responses.push({'option': 'audio', 'status': 'granted'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#sub-audio-negotiated").show();
    $("#sub-audio-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    console.log("audio granted");
  });
  $("#deny-audio").click(function() {
    fb_responses.push({'option': 'audio', 'status': 'denied'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#awaiting-audio-request").show();
    console.log("audio denied");
  });
}


/* Unhide video and show/activate the appropriate controls */
function startChat() {
  $(".initiation").remove(); // take away the initiation elements
  $("#videos").show(); // show the videos

  var fb_commands = fb_new_chat_room.child('commands');
  var fb_warnings = fb_new_chat_room.child('warnings');

  // if(dom) {
  //   $("#dom-controls").show();
  //   if (control_audio) {
  //     $("#gag").onclick(function() {
  //       fb_commands.push({'command': 'gag'});
  //       // send signal to their end to turn off their audio, show them that this has happened
  //     });
  //   } else {
  //     $("#gag").hide();
  //   }

  //   if (control_video) {
  //     $("#blindfold").onclick(function() {
  //       fb_commands.push({'command': 'blindfold'});
  //       // just turn off my video, but send them a signal to show them that this has happened
  //     });
  //   } else {
  //     $("#blindfold").hide();
  //   }

  //   if (control_clamps) {
  //     $("#clamp").onclick(function() {
  //       clamps_on = !clamps_on;
  //       fb_commands.push({'command': 'clamp'});
  //       // toggle clamps on, send signal to clamps to toggle on/off, and send signal to them to show that this has happened
  //     });
  //   } else {
  //     $("#clamp").hide();
  //   }

  //   // Listen for signals from sub
  //   fb_warnings.on("child_added",function(snapshot){
  //     var warning = snapshot.val()['warning'];
  //     if (warning == 'slow') {
  //       // show slow signal
  //     } else {
  //       // hide video and dom controls, show stop signal
  //     }
  //   }

  // } else {
  //   $("#sub-controls").show();
  //   $("#slow").onclick(function() {
  //     fb_warnings.push({'warning': 'slow'});
  //     // send signal to dom to SLOW
  //   });
  //   $("#stop").onclick(function() {
  //     fb_warnings.push({'warning': 'stop'});
  //     // send signal to dom to STOP
  //     // hide videos and turn off controls
  //   });

  //   // Listen for dom's signals
  //   fb_commands.on("child_added",function(snapshot){
  //     var command = snapshot.val()['command'];
  //     if (command == 'gag') {

  //     } else if (command == 'blindfold') {

  //     } else if (command == 'clamp') {

  //     }
  //   }
  // }


}

window.onresize = function(event) {
  subdivideVideos();
};