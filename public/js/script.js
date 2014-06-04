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

// Bringing streams into global scope to prevent them being garbage collected
var partner_stream;
var my_stream;

function setAftercareStyles() {

$('#muted').css('opacity', '0.0');
$('#muted2').css('opacity', '0.0');
$('#you').removeClass('blur2');
$('#them').removeClass('blur');

time_spent_scene = new Date().getTime() - time_spent_scene;
scene_complete = true;
time_spent_aftercare = new Date().getTime();
if($("#them").css('visibility') == 'hidden') {
  toggleVideoDisplay("#them");
}

if($("#them").prop('muted')) {
  toggleAudioMute("#them");
}

$("body").animate({
    'background-color' : "#27d1bb"
}, 3000, 'swing', function() {

    $('#videos').show();

  // if we want to add an image, can do it here, but I think the fade is nice

  // $('body').css('background', 'URL("/candles.png")');
  // $('body').css('background-size', 'cover'); 
  // $('body').css('background-repeat', 'no-repeat');
});

  $(".partner-video").css('background-image', 'none');
  $(".partner-video").animate({
    'background-color' : "#2ECC71"
}, 3000);

  $('#dom-status')[0].innerHTML = 'You were in control.';
  $('#sub-status')[0].innerHTML = 'Your partner was in control.';


  fb_stats = fb_new_chat_room.child('stats');
  var stats = document.getElementById("stats");
  fb_stats.on("child_added", function(snapshot) {
    $("#stats").show();
    stats.innerHTML += '<div class="stat">' + snapshot.val() + '</div';
  });

  if (times_clamp_changed) {
    fb_stats.push('The tactile controls were adjusted ' + times_clamp_changed + ' time(s).');
  }
  if (times_blindfolded) {
    b = times_blindfolded / 2;
    if (times_blindfolded % 2) {
      b += 0.5;
    }
    fb_stats.push('The submissive partner was blindfolded ' + b + ' time(s).');
  }
  if (times_gagged) {
    g = times_gagged / 2;
    if (times_gagged % 2) {
      g += 0.5;
    }
    fb_stats.push('The submissive partner was silenced ' + g + ' time(s).');
  }
  if (times_warned) {
    fb_stats.push('The partner in control was warned ' + times_warned + ' time(s).');
  }
  if (times_terminated) {
    fb_stats.push('The submissive partner ended the chat by hitting STOP.');
  }
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

  var muted2 = document.createElement('img');
  muted2.id = 'muted2';
  muted2.src='/muted.png';
  // muted2.style = 'opacity:0';
  div.appendChild(muted2);
  document.getElementById('videos').appendChild(div);
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
    five_letter_words = words().split(' ');
    randomstring = five_letter_words[Math.floor(Math.random()*five_letter_words.length)];
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
  var chat = fb_new_chat_room.child('chat');
  var input = document.getElementById("chatinput");
  var room = window.location.hash.slice(1);

  var color = dom? "#3366FF" : "#CC0099";

  input.addEventListener('keydown', function(event) {
    var key = event.which || event.keyCode;
    if(key === 13) {
      chat.push({'message': input.value, 'room': room, 'color': color, 'partner': me});
      times_chat_used++;
      input.value = "";
    }
  });

  chat.on("child_added", function(snapshot) {
    console.log(snapshot);
    addToChat(snapshot.val()['message'], snapshot.val()['partner'], snapshot.val()['color']);
  });

  if (dom) {
    $('#init-notification').show();
    $('#init-notification').html('<b>Get your partner to join by sharing this link:      ' + window.location.href + '</b>');
    // addToChat('<b>Get your partner to join by sharing this link:      ' + window.location.href + '</b>', '<b>Dynamixx</b>', 'black');
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

function blinkId(id) {
  var i = document.getElementById(id);
  if(i.style.visibility=='hidden') {
    i.style.visibility='visible';
  } else {
    i.style.visibility='hidden';
  }
    setTimeout("blinkId('"+id+"')",1000);
  return true;
}

function init() {

  initializeLogVars();
  blinkId('muted');

  /* Generate new chat hash if needed */
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
    fb_removed = fb_new_chat_room.child('removed');
    fb_removed.on("child_added", function(snapshot) {
      $('#them').hide();
      $('#waiting').text('Partner left the room.');
      $('#waiting').show();
    });
  fb_removed.push('removed');
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

        $.fancybox.open([
          {
              afterLoad: function() {
                  // this.title = '<a href="' + this.href + '">Download</a> ' + this.title;
                  /* Set lightbox title styles here */
              },
              href : dom? 'Instructions-dom.png': 'Instructions-sub.png',
              title : 'How does it work?',
              closeBtn: true,
               helpers : {
                title: null,
                overlay : {
                  css : {
                    // CSS for overlay background here
                      'background' : 'rgba(0, 0, 0, 0.5)'
                  }
                },

              }
            }  
      ], {
          padding : 0   
      });
        
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
            my_stream = stream;
          });
        } else {
          alert('Your browser is not supported or you have to turn on flags. In chrome you go to chrome://flags and turn on Enable PeerConnection remember to restart chrome');
        }
      }

      /* Set up RTC */
      var room = window.location.hash.slice(1);
      ws_string = (window.location.href.indexOf('localhost:8080') == -1)? 'wss:' : 'ws:';
      rtc.connect(ws_string + window.location.href.substring(window.location.protocol.length).split('#')[0], room);
      rtc.on('add remote stream', function(stream, socketId) {
        partner_stream = stream;
        console.log("ADDING REMOTE STREAM...");
        var clone = cloneVideo('you', socketId);
        document.getElementById(clone.id).setAttribute("class", "partner-video");
        blinkId('muted2');
        var right = (window.innerWidth)/2 - 50;
        var bottom = (window.innerHeight)/2 - 150;
        $('#muted2').css('opacity', 0);
        $('#muted2').css('top', bottom + 'px');
        $('#muted2').css('left', right + 'px');

        $('#init-notification').html('<b>Partner joined!</b>');
        setInterval(function(){$('#init-notification').hide();}, 15000);

        rtc.attachStream(stream, clone.id);
        subdivideVideos();
        toggleAudioMute('#them');
      });
      rtc.on('disconnect stream', function(data) {
        rtc.connect(ws_string + window.location.href.substring(window.location.protocol.length).split('#')[0], room);
        // console.log('remove ' + data);
        // $('#them').hide();
        // $('#waiting').text('Partner left the room.');
        // $('#waiting').show();
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
          $('#dom-clamps-negotiated').text("Your request for tactile control was accepted!");
        } else {
          $("#request-clamps").show();
          $("#giveup-clamps").show();
          $("#awaiting-clamps-permission").hide();
          $("#clamps-permission-denied").show();
          $('#clamps-permission-denied"').text("Your request for tactile control was denied.");
        }
      } else if (option == 'video') {
        if (status == 'granted') {
          $("#awaiting-video-permission").hide();
          $("#dom-video-negotiated").show();
          $("#video-control").addClass("okay");
          control_video = true;
          checkAllNegotiated(++num_negotiated);
          $('#dom-video-negotiated').text("Your request for video control was accepted!");
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
          $('#dom-audio-negotiated').text("Your request for audio control was accepted!");
        } else {
          $("#awaiting-audio-permission").hide();
          $("#request-audio").show();
          $("#giveup-audio").show();
          $("#audio-permission-denied").show();
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
    $('#dom-clamps-negotiated').text("You relinquished tactile control.");
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
    $('#dom-video-negotiated').text("You relinquished video control.");
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
    $('#dom-audio-negotiated').text("You relinquished audio control.");
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
          $('#sub-clamps-negotiated').text("Your partner relinquished tactile control.");
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
          $('#sub-video-negotiated').text("Your partner relinquished video control.");
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
          $('#sub-audio-negotiated').text("Your partner relinquished audio control.");
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
    $('#sub-clamps-negotiated').text("Your partner will have tactile control.");
    checkAllNegotiated(++num_negotiated);
  });
  $("#deny-clamps").click(function() {
    times_tactile_denied++;
    fb_responses.push({'option': 'clamps', 'status': 'denied'});
    $("#grant-clamps").hide();
    $("#deny-clamps").hide();
    $("#awaiting-clamps-request").show();
    $('#awaiting-clamps-request').text("Waiting for partner to request again or relinquish control.");
  });
  $("#grant-video").click(function() {
    times_video_granted++;
    fb_responses.push({'option': 'video', 'status': 'granted'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#sub-video-negotiated").show();
    $("#sub-video-control").addClass("okay");
    $('#sub-video-negotiated').text("Your partner will have video control.");
    checkAllNegotiated(++num_negotiated);
  });
  $("#deny-video").click(function() {
    times_video_denied++;
    fb_responses.push({'option': 'video', 'status': 'denied'});
    $("#grant-video").hide();
    $("#deny-video").hide();
    $("#awaiting-video-request").show();
    $('#awaiting-video-request').text("Waiting for partner to request again or relinquish control.");
  });
  $("#grant-audio").click(function() {
    times_audio_granted++;
    fb_responses.push({'option': 'audio', 'status': 'granted'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#sub-audio-negotiated").show();
    $("#sub-audio-control").addClass("okay");
    $('#sub-audio-negotiated').text("Your partner will have audio control.");
    checkAllNegotiated(++num_negotiated);;
  });
  $("#deny-audio").click(function() {
    times_audio_denied++;
    fb_responses.push({'option': 'audio', 'status': 'denied'});
    $("#grant-audio").hide();
    $("#deny-audio").hide();
    $("#awaiting-audio-request").show();
    $('#awaiting-audio-request').text("Waiting for partner to request again or relinquish control.");
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

function initGag() {
  var fb_commands = fb_new_chat_room.child('commands');
  $("#gag").click(function() {
    times_gagged++;
    fb_commands.push({'command': 'gag'});
    toggleAudioMute('#them');
    if (gagged) {
      $('#gag-text').text('Gag');
      $('#gag').removeClass('gag-active');
      $('#gag').addClass('gag');
      $('#muted2').css('opacity', 0.0)
    } else {
      $('#gag-text').text('Ungag');
      $('#gag').addClass('gag-active');
      $('#gag').removeClass('gag');
      $('#muted2').css('opacity', 1.0)
    }
    gagged = !gagged;
  });
}

function initBlindfold() {
  var fb_commands = fb_new_chat_room.child('commands');
  $("#blindfold").click(function() {
      times_blindfolded++;
      fb_commands.push({'command': 'blindfold'});
      if (blindfolded) {
        $('#blindfold-text').text('Blindfold');
        $('#blindfold').addClass('blindfold');
        $('#blindfold').removeClass('blindfold-active');
        $('#you').removeClass('blur2');
      } else {
        $('#blindfold-text').text('Unblind');
        $('#blindfold').addClass('blindfold-active');
        $('#blindfold').removeClass('blindfold');
        $('#you').addClass('blur2');
      }
      blindfolded = !blindfolded;
    });
}

function initClamps() {
  $("#points").click(function() {
    times_clamp_changed++;
    adjustClamps($("#points").val())
  });
}

function initWarnings() {
  // Listen for signals from sub
  var fb_warnings = fb_new_chat_room.child('warnings');

  if(dom) {
    fb_warnings.on("child_added",function(snapshot){
      var warning = snapshot.val()['warning'];
      if (warning == 'slow') {
        $('#warning').show();
        setInterval(function(){$('#warning').hide();}, 5000);
      } else {
        toggleAudioMute('#them');
        $('#videos').hide();
        $('#warning').hide();
        $('#terminated').show();
        $('#dom-controls').hide();
      }
    });
  } else {
    $("#slow").click(function() {
      times_warned++;
      fb_warnings.push({'warning': 'slow'});
      $('#warning-sent').show();
      setInterval(function(){$('#warning-sent').hide();}, 5000);
    });
    $("#stop").click(function() {
      times_terminated++;
      fb_warnings.push({'warning': 'stop'});
      $('#videos').hide();
      $('#warning-sent').hide();
      $('#terminated-sent').show();
      $('#sub-controls').hide();
      $('#gagged').hide();
      $('#blindfolded').hide();

      adjustClamps(0);
      $("#points").val(0);

    });
    $('#init-notification').show();
    $('#init-notification').html('<b>Warn your partner with <span class="slow-text">WARN</span>, or end the session with <span class="stop-text">STOP</span></b>');
    setInterval(function(){$('#init-notification').hide();}, 60000);
    // addToChat('<b>Warn your partner with <span class="slow-text">WARN</span>, or end the session with <span class="stop-text">STOP</span></b>', '<b>Dynamixx</b>', 'black');    
  }
}

function initAfterCare() {
  $("#aftercare").click(function() {
    var fb_aftercare = fb_new_chat_room.child('aftercare');
    fb_aftercare.push({'restart': true});
  });
}

function initListenControls() {
  // Listen for dom's signals
  var fb_commands = fb_new_chat_room.child('commands');
  fb_commands.on("child_added",function(snapshot){
    var command = snapshot.val()['command'];
    if (command == 'gag') {
      toggleAudioMute('#you');
      if (gagged) {
        $('#gagged').hide();
        $('#muted').css('opacity', '0.0');
      } else {
        $('#gagged').show();
        $('#muted').css('opacity', '1.0');
      }
      gagged = !gagged;
    } else if (command == 'blindfold') {
      if (blindfolded) {
        $('#blindfolded').hide();
        $('#them').removeClass('blur');
      } else {
        $('#blindfolded').show();
        $('#them').addClass('blur');
      }
      blindfolded = !blindfolded;
    }
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

  if(!restarted) {
    initWarnings();
    initAfterCare();
    if (!dom) {
      initListenControls();
    }
    removeControlElements(); // remove control elements on aftercare
  }

  if(dom) {
    $("#dom-controls").show();
    if (!control_audio) {
      $("#gag").css('background-color', '#acb2b7');
      $("#gag").css('opacity', 0.5);
    } else {
      if(!restarted) { initGag(); }
    }
    if (!control_video) {
      $("#blindfold").css('background-color', '#acb2b7');
      $("#blindfold").css('opacity', 0.5);
    } else {
      if(!restarted) { initBlindfold(); }
    }
    if (!control_clamps) {
      $('#points').prop('disabled', true);
      $("#points").css('background-image', 'url(slider_gray.png)');
      $("#points").css('opacity', 0.5);
    } else {
      if(!restarted) { initClamps(); }
    }
  } else {
    $("#sub-controls").show();
    $("#aftercare").show();
  }

  initRestart();

}

window.onresize = function(event) {
  subdivideVideos();
};



window.onbeforeunload = function (e) {
  var url_segments = document.location.href.split("#");
  var hash = url_segments[1];
  if(hash){
    fb_removed = fb_new_chat_room.child('removed');
    fb_removed.push('removed');
    saveAndResetLogData();
  }
  return null;
};

function saveAndResetLogData() {

  if (!negotiated) {
    time_spent_negotiation = new Date().getTime() - time_spent_negotiation;
    time_spent_scene = 0;
    time_spent_aftercare = 0;
  } else if (!scene_complete) {
    time_spent_scene = new Date().getTime() - time_spent_scene;
    time_spent_aftercare = 0;
  } else if (scene_complete) {
    time_spent_aftercare = new Date().getTime() - time_spent_aftercare;
  }
  
  if(window.location.href.indexOf('localhost:8080') == -1) {
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
  }
  initializeLogVars();
}

function initializeLogVars() {
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
    time_spent_negotiation = new Date().getTime();
    scene_complete = false;
    time_spent_scene = 0;
    time_spent_aftercare = 0;

    times_restarted = 0;
}