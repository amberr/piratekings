var videos = [];
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.RTCPeerConnection;
var fb_instance;
var fb_new_chat_room;
var fb_instance_users;
var fb_requests; // requests from the dom during initiation
var fb_responses; // responses from the sub during intiation
var fb_logs;


var control_clamps; // does dom have the ability to control clamps?
var control_video; // does dom have the ability to control video?
var control_audio; // does dom have the ability to control audio?
var me;
var partner;

var dom = false;
var clamps_val = 0;
var gagged = false;
var blindfolded = false;
var num_negotiated = 0;
var restarted = false;

/* All variables below are for logging purposes */
var times_tactile_requested;
var times_tactile_given_up;
var times_audio_requested;
var times_audio_given_up;
var times_video_requested;
var times_video_given_up;

var times_tactile_granted;
var times_tactile_denied;
var times_audio_granted;
var times_audio_denied;
var times_video_granted;
var times_video_denied;

var times_blindfolded;
var times_gagged;
var times_clamp_changed;

var times_warned;
var times_terminated;

var times_chat_used;

var negotiated;
var time_spent_negotiation;
var scene_complete;
var time_spent_scene;
var time_spent_aftercare;

var times_restarted;
/* End logging variables */

function setAftercareStyles() {

time_spent_scene = new Date().getTime() - time_spent_scene;
scene_complete = true;
time_spent_aftercare = new Date().getTime();

  $("body").animate({
    'background-color' : "#ff4d4d"
}, 3000, 'swing', function() {

    $('#videos').show();

  // if we want to add an image, can do it here, but I think the fade is nice

  // $('body').css('background', 'URL("/candles.png")');
  // $('body').css('background-size', 'cover'); 
  // $('body').css('background-repeat', 'no-repeat');
});

  $(".partner-video").css('background-image', 'none');
  $(".partner-video").animate({
    'background-color' : "#383838"
}, 3000);

  $('#dom-status')[0].innerHTML = 'You were in control.';
  $('#sub-status')[0].innerHTML = 'Your partner was in control.';

}

function adjustClamps(value) {
  /* Make call to url that will toggle clamps. Example:*/

  $.post( "https://api.spark.io/v1/devices/50ff6a065067545624240287/servo", { 
      access_token: '4ef65b4fc9b8b09ed815933889832f43ac449433', 
      args: value.toString() } 
    );

}

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
  var width = Math.floor((window.innerWidth));
  var height = Math.floor((window.innerHeight));
  //var width = Math.floor((window.innerWidth) / perRow);
  //var height = Math.floor((window.innerHeight) / perColumn);
  video.width = width;
  video.height = height-380;
  video.style.position = "absolute";
  video.style.left = "0px";
  video.style.top = "65px";
}


/* Video cloned from the end of the socket gets added here */
function cloneVideo(domId, socketId) {
  var video = document.getElementById(domId);
  var clone = video.cloneNode(false);
  var div = document.createElement('div');
  div.id = 'them-overlay';
  div.className = 'overlay';
  clone.id = 'them';
  div.appendChild(clone);
  document.getElementById('videos').appendChild(div);
  videos.push(clone);
  console.log(clone);
  return clone;
}

function removeVideo(socketId) {
  var video = document.getElementById('remote' + socketId);
  if(video) {
    videos.splice(videos.indexOf(video), 1);
    video.parentNode.removeChild(video);
  }
}

function addToChat(msg, user, color) {
  var messages = document.getElementById('messages');
  if(msg != '') {
    msg = '<div class="message" style="color: ' + color + '; ">' + user + ': ' + msg + '</div>';
  }
  messages.innerHTML = messages.innerHTML + msg;
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
    var string_length = 5;
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
  var room = window.location.hash.slice(1);

  var color = dom? "#3366FF" : "#CC0099";

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
      addToChat(input.value, me, color);
      times_chat_used++;
      input.value = "";
    }
  }, false);
  if (dom) {
    addToChat('<b>Get your partner to join by sharing this link:      ' + window.location.href + '</b>', '<b>Dynamixx</b>', 'black');
  }
  rtc.on(chat.event, function() {
    var data = chat.recv.apply(this, arguments);
    addToChat(data.messages, partner, data.color.toString(16));
  });
}

function toggleAudioMute(div) {
  var isAudioMuted = $(div).prop('muted');
    if (isAudioMuted && div != '#you') { // JENK AF, FIX THIS
      $(div).prop('muted', false);
    } else {
      $(div).prop('muted', true);
    }
    isAudioMuted = !isAudioMuted;
  }

function toggleVideoDisplay(div) {
  var hidden = $(div).css('visibility');
  if (hidden == 'hidden') {
    $(div).css('visibility', 'visible');
  } else {
      $(div).css('visibility', 'hidden');
  }
}


function init() {
  /* Generate new chat hash if needed */
  var time_spent_negotiation = new Date().getTime();
  $("#videos").hide();
  var url_segments = document.location.href.split("#");
  var hash = url_segments[1];
  if(!hash){
    hash = setHash();
  } else {
    /* Connect to Firebase */
    fb_instance = new Firebase("https://dynamixxx.firebaseio.com");
    fb_logs = fb_instance.child('logs').child(hash);
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
        me = username;

        fb_instance_users.on("child_added", function(snapshot) {
          if(snapshot.val()['name'] != me) {
            partner = snapshot.val()['name'];
          }
        });

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
            toggleAudioMute('#you');
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
        toggleAudioMute('#them');
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
  if(num_negotiated == 3) {
    $(".start-session").addClass("start-session-enabled");
    $(".start-session").click(function() {
      if ($("#start-session").hasClass('start-session-enabled')) {

        fb_started = fb_new_chat_room.child('status').child('started');
        $("#videos").show();
        $('#them').hide();

        fb_started.on("child_added",function(snapshot){
          if (snapshot.val()['partner'] != dom) {
              toggleAudioMute('#them');
              $('#them').show();
              $('#waiting').hide();
          }
        });
        fb_started.push({'partner': dom});
        startChat();
      }
    });
  }
}

// on okays, need to add class to the outer option div so it will turn green
// on all three okayed, need to add class to start session that allows for it to be clickable
// need to add some more text so it's clear to each partner what's been agreed upon
// should add ability to reset negotiations

function initDomInitiation() {
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
          addToChat('<b>Your request for tactile control was accepted!', '<b>Dynamixx</b>', '#2ECC71');
        } else {
          $("#request-clamps").show();
          $("#giveup-clamps").show();
          $("#awaiting-clamps-permission").hide();
          $("#clamps-permission-denied").show();
          addToChat('<b>Your request for tactile control was denied.', '<b>Dynamixx</b>', 'red');
        }
      } else if (option == 'video') {
        if (status == 'granted') {
          $("#awaiting-video-permission").hide();
          $("#dom-video-negotiated").show();
          $("#video-control").addClass("okay");
          control_video = true;
          checkAllNegotiated(++num_negotiated);
          addToChat('<b>Your request for video control was accepted!', '<b>Dynamixx</b>', '#2ECC71');
        } else {
          $("#request-video").show();
          $("#giveup-video").show();
          $("#awaiting-video-permission").hide();
          $("#video-permission-denied").show();
          addToChat('<b>Your request for video control was denied.', '<b>Dynamixx</b>', 'red');
        }
      } else if (option == 'audio') {
        if (status == 'granted') {
          $("#awaiting-audio-permission").hide();
          $("#dom-audio-negotiated").show();
          $("#audio-control").addClass("okay");
          control_audio = true;
          checkAllNegotiated(++num_negotiated);
          addToChat('<b>Your request for audio control was accepted!', '<b>Dynamixx</b>', '#2ECC71');
        } else {
          $("#awaiting-audio-permission").hide();
          $("#request-audio").show();
          $("#giveup-audio").show();
          $("#audio-permission-denied").show();
          addToChat('<b>Your request for audio control was denied.', '<b>Dynamixx</b>', 'red');
        }
      }
    });

  $("#request-clamps").click(function() {
    times_tactile_requested++;
    $("#request-clamps").hide();
    $("#giveup-clamps").hide();
    $("#awaiting-clamps-permission").show();
    $("#clamps-permission-denied").hide();
    fb_requests.push({'option': 'clamps', 'status': 'requested'});
  });
  $("#giveup-clamps").click(function() {
    times_tactile_given_up++;
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
    times_video_requested++;
    $("#request-video").hide();
    $("#giveup-video").hide();
    $("#awaiting-video-permission").show();
    $("#video-permission-denied").hide();
    fb_requests.push({'option': 'video', 'status': 'requested'});
  });
  $("#giveup-video").click(function() {
    times_video_given_up++;
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
    times_audio_requested++;
    $("#request-audio").hide();
    $("#giveup-audio").hide();
    $("#awaiting-audio-permission").show();
    $("#audio-permission-denied").hide();
    fb_requests.push({'option': 'audio', 'status': 'requested'});
  });
  $("#giveup-audio").click(function() {
    times_audio_given_up++;
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
    num_negotiated = 0;

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
          addToChat('<b>Your partner relinquished tactile control.', '<b>Dynamixx</b>', '#2ECC71');
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
          addToChat('<b>Your partner relinquished video control.', '<b>Dynamixx</b>', '#2ECC71');
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
          addToChat('<b>Your partner relinquished audio control.', '<b>Dynamixx</b>', '#2ECC71');
        }
      }
    });

  $("#grant-clamps").click(function() {
    times_tactile_granted++;
    fb_responses.push({'option': 'clamps', 'status': 'granted'});
    $("#grant-clamps").hide();
    $("#deny-clamps").hide();
    $("#sub-clamps-negotiated").show();
    $("#sub-clamps-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    addToChat('<b>You granted tactile control.', '<b>Dynamixx</b>', '#2ECC71');
    console.log("clamps granted");
  });
  $("#deny-clamps").click(function() {
    times_tactile_denied++;
    fb_responses.push({'option': 'clamps', 'status': 'denied'});
    $("#grant-clamps").hide();
    $("#deny-clamps").hide();
    $("#awaiting-clamps-request").show();
    console.log("clamps denied");
    addToChat('<b>You denied your partner tactile control. They may request again.', '<b>Dynamixx</b>', 'red');
  });
  $("#grant-video").click(function() {
    times_video_granted++;
    fb_responses.push({'option': 'video', 'status': 'granted'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#sub-video-negotiated").show();
    $("#sub-video-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    addToChat('<b>Your granted video control.', '<b>Dynamixx</b>', '#2ECC71');
    console.log("video granted");
  });
  $("#deny-video").click(function() {
    times_video_denied++;
    fb_responses.push({'option': 'video', 'status': 'denied'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#awaiting-video-request").show();
    console.log("video denied");
    addToChat('<b>You denied your partner video control. They may request again.', '<b>Dynamixx</b>', 'red');
  });
  $("#grant-audio").click(function() {
    times_audio_granted++;
    fb_responses.push({'option': 'audio', 'status': 'granted'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#sub-audio-negotiated").show();
    $("#sub-audio-control").addClass("okay");
    checkAllNegotiated(++num_negotiated);
    addToChat('<b>You granted audio control.', '<b>Dynamixx</b>', '#2ECC71');
    console.log("audio granted");
  });
  $("#deny-audio").click(function() {
    times_audio_denied++;
    fb_responses.push({'option': 'audio', 'status': 'denied'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#awaiting-audio-request").show();
    console.log("audio denied");
    addToChat('<b>You denied your partner audio control. They may request again.', '<b>Dynamixx</b>', 'red');
  });
}

// this gets buggy if 2nd partner never started first sesh and 1st tries to initiate a new negotiation
function initRestart() {
  $('#restart').show();


  if(!restarted) {
    var fb_restart = fb_new_chat_room.child('restart');
    $('#restart').click(function() {
      times_restarted++;
      fb_restart.push({'restart': true});
    });

    fb_restart.on('child_added', function(snapshot) {
        saveAndResetLogData();
        time_spent_negotiation = new Date().getTime();

        $("#messages").removeClass("messages-final");
        $("#messages").addClass("messages");

          $("body").animate({
            'background-color' : "#383838"
          }, 0);

          $("#controls").animate({
            'background-color' : "#383838"
          }, 0);

      $('#videos').hide();
      $('#sub-controls').hide();
      $('#dom-controls').hide();
      $('#terminated').hide();
      $('#terminated-sent').hide();
      $('#warning').hide();
      $('#warning-sent').hide();
      $('#gagged').hide();
      $('#blindfolded').hide();
      $('#restart').hide();
      $('#aftercare').hide();
      if (dom) {
        $('#dom-initiation').show();
        $('#request-clamps').show();
        $('#giveup-clamps').show();
        $('#request-video').show();
        $('#giveup-video').show();
        $('#request-audio').show();
        $('#giveup-audio').show();
      } else {
        $('#sub-initiation').show();
        $("#awaiting-clamps-request").show();
        $("#awaiting-video-request").show();
        $("#awaiting-audio-request").show();
      }
      $('.good-to-go').hide();
      $('.option').removeClass('okay');
      $('.start-session').removeClass('start-session-enabled');

      $('#them').prop('muted', false);
      $('#you').prop('muted', false);

      $('#blindfold').addClass('blindfold');
      $('#gag').addClass('gag');
      $('#blindfold').removeClass('blindfold-active');
      $('#gag').removeClass('gag-active');

      gagged = false;
      blindfolded = false;
      control_video = false;
      control_audio = false;
      control_clamps = false;
      num_negotiated = 0;

      adjustClamps(0);
      $("#points").val(0);

    });
  }
  restarted = true;
}

function removeControlElements() {
  var fb_aftercare = fb_new_chat_room.child('aftercare');
  fb_aftercare.on('child_added', function(snapshot) {

    $('#sub-controls').hide();
    $('#dom-controls').hide();
    $('#terminated').hide();
    $('#terminated-sent').hide();
    $('#warning').hide();
    $('#warning-sent').hide();
    $('#gagged').hide();
    $('#blindfolded').hide();
    $('#restart').hide();
    $('#aftercare').hide();

    // show aftercare initiated divs
    if (dom) {
      $('#aftercare-dom').show();
    } else {
      $('#aftercare-sub').show();
    }
    setAftercareStyles();

  });
}


/* Unhide video and show/activate the appropriate controls */
function startChat() {
  time_spent_negotiation = new Date().getTime() - time_spent_negotiation;
  negotiated = true;
  time_spent_scene = new Date().getTime();

  $("#messages").removeClass("messages");
  $("#messages").addClass("messages-final");
  $(".initiation").css('display', 'none');
  $("body").animate({
    'background-color' : "#1d1d1d"
  }, 5000);

    $("#controls").animate({
    'background-color' : "#1d1d1d"
  }, 5000);

  initRestart();

  var fb_commands = fb_new_chat_room.child('commands');
  var fb_warnings = fb_new_chat_room.child('warnings');

  removeControlElements(); // remove control elements on aftercare

  if(dom) {
    $("#dom-controls").show();
    if (control_audio) {
      $("#gag").click(function() {
        times_gagged++;
        fb_commands.push({'command': 'gag'});
        toggleAudioMute('#them');
        if (gagged) {
          //$('#gag').text('gag');
          $('#gag').removeClass('gag-active');
          $('#gag').addClass('gag');
          addToChat('<b>You unsilenced ' + partner + '.</b>', '<b>Dynamixx</b>', '#c18700');
        } else {
          //$('#gag').text('ungag');
          $('#gag').addClass('gag-active');
          $('#gag').removeClass('gag');
          addToChat('<b>You silenced ' + partner + '</b>', '<b>Dynamixx</b>', '#8e44ad');
        }
        gagged = !gagged;
      });
    } else {
      $("#gag").hide();
    }

    if (control_video) {
      times_blindfolded++;
      $("#blindfold").click(function() {
        fb_commands.push({'command': 'blindfold'});
        if (blindfolded) {
          //$('#blindfold').text('blindfold');
          $('#blindfold').addClass('blindfold');
          $('#blindfold').removeClass('blindfold-active');
          addToChat('<b>You removed ' + partner + '\'s blindfold.</b>', '<b>Dynamixx</b>', '#c18700');
        } else {
          //$('#blindfold').text('remove blindfold');
          addToChat('<b>You blindfolded ' + partner + '</b>', '<b>Dynamixx</b>', '#8e44ad');
          $('#blindfold').addClass('blindfold-active');
          $('#blindfold').removeClass('blindfold');
        }
        blindfolded = !blindfolded;
      });
    } else {
      $("#blindfold").hide();
    }

    if (control_clamps) {
      times_clamp_changed++;
      $("#points").change(function() {
        adjustClamps($("#points").val())
      })
    } else {
      $("#clamp").hide();
    }

    // Listen for signals from sub
    fb_warnings.on("child_added",function(snapshot){
      var warning = snapshot.val()['warning'];
      if (warning == 'slow') {
        $('#warning').show();
        setInterval(function(){$('#warning').hide();}, 5000);
      } else {
        // hide video and dom controls, show stop signal
        toggleAudioMute('#you');
        toggleAudioMute('#them');
        $('#videos').hide();
        $('#warning').hide();
        $('#terminated').show();
        $('#dom-controls').hide();
      }
    });

  } else {
    addToChat('<b>Warn your partner with <span class="slow-text">SLOW</span>, or end the session with <span class="stop-text">STOP</span></b>', '<b>Dynamixx</b>', 'black');    
    $("#sub-controls").show();
    $("#aftercare").show();
    $("#aftercare").click(function() {
      var fb_aftercare = fb_new_chat_room.child('aftercare');
      fb_aftercare.push({'restart': true});
    });
    $("#slow").click(function() {
      times_warned++;
      fb_warnings.push({'warning': 'slow'});
      $('#warning-sent').show();
      setInterval(function(){$('#warning-sent').hide();}, 5000);
    });
    $("#stop").click(function() {
      times_terminated++;
      fb_warnings.push({'warning': 'stop'});
      toggleAudioMute('#you');
      toggleAudioMute('#them');
      $('#videos').hide();
      $('#warning-sent').hide();
      $('#terminated-sent').show();
      $('#sub-controls').hide();
      $('#gagged').hide();
      $('#blindfolded').hide();

      adjustClamps(0);
      $("#points").val(0);

    });

    // Listen for dom's signals
    fb_commands.on("child_added",function(snapshot){
      var command = snapshot.val()['command'];
      console.log(command);
      if (command == 'gag') {
        toggleAudioMute('#you');
        if (gagged) {
          $('#gagged').hide();
        } else {
          $('#gagged').show();
        }
        gagged = !gagged;
      } else if (command == 'blindfold') {
        toggleVideoDisplay('#them');
        if (blindfolded) {
          $('#blindfolded').hide();
        } else {
          $('#blindfolded').show();
        }
        blindfolded = !blindfolded;
      }
    });
  }
}

window.onresize = function(event) {
  subdivideVideos();
};

window.onbeforeunload = function(){
  saveAndResetLogData();
};

function saveAndResetLogData() {

  if (!negotiation_complete) {
    time_spent_negotiation = new Date().getTime() - time_spent_negotiation;
    time_spent_scene = 0;
    time_spent_aftercare = 0;
  } else if (!scene_complete) {
    time_spent_scene = new Date().getTime() - time_spent_scene;
    time_spent_aftercare = 0;
  } else if (scene_complete) {
    time_spent_aftercare = new Date().getTime() - time_spent_aftercare;
  }
  if (dom) {
    fb_logs.push({
      'role': 'DOM',
      'times tactile requested': times_tactile_requested,
      'times tactile given up': times_tactile_given_up,
      'times audio requested': times_audio_requested,
      'times audio given up': times_audio_given_up,
      'times video requested': times_video_requested,
      'times video given up': times_video_given_up,
      'times blindfolded': times_blindfolded,
      'times gagged': times_gagged,
      'times chat used': times_chat_used,
      'time spent on negotiation': time_spent_negotiation,
      'time spent on scene': time_spent_scene,
      'time spent on aftercare': time_spent_aftercare,
      'times restarted': times_restarted
    });
  } else {
    fb_logs.push({
      'role': 'SUB',
      'times tactile granted': times_tactile_granted,
      'times tactile denied': times_tactile_denied,
      'times audio granted': times_audio_granted,
      'times audio denied': times_audio_denied,
      'times video granted': times_video_granted,
      'times video denied': times_video_denied,
      'times warned': times_warned,
      'times terminated': times_terminated,
      'times chat used': times_chat_used,
      'time spent on negotiation': time_spent_negotiation,
      'time spent on scene': time_spent_scene,
      'time spent on aftercare': time_spent_aftercare,
      'times restarted': times_restarted
    });
  }

  times_tactile_requested = 0;
  times_tactile_given_up = 0;
  times_audio_requested = 0;
  times_audio_given_up = 0;
  times_video_requested = 0;
  times_video_given_up = 0;

  times_tactile_granted = 0;
  times_tactile_denied = 0;
  times_audio_granted = 0;
  times_audio_denied = 0;
  times_video_granted = 0;
  times_video_denied = 0;

  times_blindfolded = 0;
  times_gagged = 0;
  times_clamp_changed = 0;

  times_warned = 0;
  times_terminated = 0;

  times_chat_used = 0;

  negotiated = false;
  time_spent_negotiation = 0;
  scene_complete = false;
  time_spent_scene = 0;
  time_spent_aftercare = 0;

  times_restarted = 0;
}