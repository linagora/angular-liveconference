'use strict';

angular.module('op.live-conference')
  .constant('easyRTCBitRates', {
    low: {
      audio: 20,
      video: 30
    },
    medium: {
      audio: 40,
      video: 60
    },
    nolimit: null
  })
  .constant('EASYRTC_APPLICATION_NAME', 'LiveConference')
  .constant('LOCAL_VIDEO_ID', 'video-thumb0')
  .constant('REMOTE_VIDEO_IDS', [
    'video-thumb1',
    'video-thumb2',
    'video-thumb3',
    'video-thumb4',
    'video-thumb5',
    'video-thumb6',
    'video-thumb7',
    'video-thumb8'
  ])
  .factory('easyRTCService', ['$rootScope', '$log', 'webrtcFactory', 'tokenAPI', 'session',
    'ioSocketConnection', 'ioConnectionManager', '$timeout', 'easyRTCBitRates', 'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'EASYRTC_APPLICATION_NAME',
    function($rootScope, $log, webrtcFactory, tokenAPI, session, ioSocketConnection, ioConnectionManager, $timeout, easyRTCBitRates, LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, EASYRTC_APPLICATION_NAME) {
      var easyrtc = webrtcFactory.get();
      easyrtc.enableDataChannels(true);

      var bitRates, room;

      function stopLocalStream() {
        var stream = easyrtc.getLocalStream();
        if (stream) {
          stream.stop();
        }
      }

      function leaveRoom(conference) {
        stopLocalStream();
        easyrtc.leaveRoom(conference._id, function() {
          $log.debug('Left the conference ' + conference._id);
          $rootScope.$emit('conference:left', {conference_id: conference._id});
        }, function() {
          $log.error('Error while leaving conference');
        });
      }

      function performCall(otherEasyrtcid) {
        $log.debug('Calling ' + otherEasyrtcid);
        easyrtc.hangupAll();

        function onSuccess() {
          $log.debug('Successfully connected to ' + otherEasyrtcid);
        }

        function onFailure() {
          $log.error('Error while connecting to ' + otherEasyrtcid);
        }

        easyrtc.call(otherEasyrtcid, onSuccess, onFailure);
      }

      function connect(conferenceState) {

        function entryListener(entry, roomName) {
          if (entry) {
            $log.debug('Entering room ' + roomName);
            room = roomName;
          } else {
            $log.debug('Leaving room ' + roomName);
            room = null;
          }
        }

        function roomOccupantListener(roomName, data, isPrimary) {
          easyrtc.setRoomOccupantListener(null); // so we're only called once.
          $log.debug('New user(s) in room ' + roomName);
          $log.debug('Room data ', data);

          function onSuccess() {
            $log.info('Successfully connected to user');
          }

          function onFailure() {
            $log.error('Error while connecting to user');
          }

          for (var easyrtcid in data) {
            $log.debug('Calling: ' + easyrtc.idToName(easyrtcid));
            easyrtc.call(easyrtcid, onSuccess, onFailure);
          }
        }

        if (bitRates) {
          var localFilter = easyrtc.buildLocalSdpFilter({audioRecvBitrate: bitRates.audio, videoRecvBitrate: bitRates.video});
          var remoteFilter = easyrtc.buildRemoteSdpFilter({audioSendBitrate: bitRates.audio, videoSendBitrate: bitRates.video});
          easyrtc.setSdpFilters(localFilter, remoteFilter);
        }

        easyrtc.setRoomOccupantListener(roomOccupantListener);
        easyrtc.setRoomEntryListener(entryListener);

        easyrtc.setDisconnectListener(function() {
          $log.info('Lost connection to signaling server');
        });

        var conference = conferenceState.conference;
        easyrtc.joinRoom(conference._id, null,
          function() {
            $log.debug('Joined room ' + conference._id);
          },
          function() {
            $log.debug('Error while joining room ' + conference._id);
          }
        );

        easyrtc.username = session.getUserId();
        conferenceState.pushAttendee(0, easyrtc.myEasyrtcid, session.getUserId(), session.getUsername());

        easyrtc.debugPrinter = function(message) {
          $log.debug(message);
        };

        function onWebsocket() {
          var sio = ioSocketConnection.getSio();
          sio.socket = {connected: true};
          easyrtc.useThisSocketConnection(sio);
          function onLoginSuccess(easyrtcid) {
            $log.debug('Successfully logged: ' + easyrtcid);
            $rootScope.$apply();
          }

          function onLoginFailure(errorCode, message) {
            $log.error('Error while connecting to the webrtc signaling service ' + errorCode + ' : ' + message);
          }

          easyrtc.easyApp(
            EASYRTC_APPLICATION_NAME,
            LOCAL_VIDEO_ID,
            REMOTE_VIDEO_IDS,
            onLoginSuccess,
            onLoginFailure);

          easyrtc.setOnCall(function(easyrtcid, slot) {
            $log.debug('SetOnCall', easyrtcid);
            conferenceState.pushAttendee(slot + 1, easyrtcid);
            $rootScope.$apply();
          });

          easyrtc.setDataChannelOpenListener( function(easyrtcid) {
            var data = {
              id: session.getUserId(),
              displayName: session.getUsername(),
              mute: conferenceState.attendees[0].mute
            };
            $log.debug('On datachannel open send %s (%s)', data, 'easyrtcid:myusername');
            easyrtc.sendData(easyrtcid, 'attendee:initialization', data);
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            conferenceState.removeAttendee(slot + 1);
            $rootScope.$apply();
          });

          easyrtc.setPeerListener(function(easyrtcid, msgType, msgData) {
            $log.debug('UserId and displayName received from %s: %s (%s)', easyrtcid, msgData.id, msgData.displayName);
            conferenceState.updateAttendee(easyrtcid, msgData.id, msgData.displayName);
            conferenceState.updateMuteFromEasyrtcid(easyrtcid, msgData.mute);
          }, 'attendee:initialization');

          easyrtc.setPeerListener(function(easyrtcid, msgType, msgData) {
            $log.debug('Mute event received from %s: %s (%s)', easyrtcid, msgData);
            conferenceState.updateMuteFromEasyrtcid(easyrtcid, msgData.mute);
          }, 'conferencestate:mute');
        }

        if (ioSocketConnection.isConnected()) {
          onWebsocket();
        } else {
          ioSocketConnection.addConnectCallback(onWebsocket);
        }

      }

      function enableMicrophone(muted) {
        easyrtc.enableMicrophone(muted);
      }

      function enableCamera(videoMuted) {
        easyrtc.enableCamera(videoMuted);
      }

      function enableVideo(videoMuted) {
        easyrtc.enableVideo(videoMuted);
      }

      function sendPeerMessage(msgType, data) {
        if (!room) {
          $log.debug('Did not send message because not in a room.');
        }

        easyrtc.sendPeerMessage(
          {targetRoom: room},
          msgType,
          data,
          function(msgType, msgBody) {
            $log.debug('Peer message was sent to room : ', room);
          },
          function(errorCode, errorText) {
            $log.error('Error sending peer message : ', errorText);
          }
        );
      }

      function configureBandwidth(rate) {
        if (rate) {
          bitRates = easyRTCBitRates[rate];
        }
        else {
          bitRates = null;
        }
      }

      return {
        leaveRoom: leaveRoom,
        performCall: performCall,
        connect: connect,
        enableMicrophone: enableMicrophone,
        enableCamera: enableCamera,
        enableVideo: enableVideo,
        configureBandwidth: configureBandwidth,
        sendPeerMessage: sendPeerMessage
      };
    }])

  .factory('currentConferenceState', ['session', 'ConferenceState', function(session, ConferenceState) {
    return new ConferenceState(session.conference);
  }])

  .factory('ConferenceState', ['$rootScope', 'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', function($rootScope, LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS) {

    /*
     * Store a snapshot of current conference status and an array of attendees describing
     * current visible attendees of the conference by their index as position.
     * attendees : [{
     *   videoId:
     *   id:
     *   easyrtcid:
     *   displayName:
     * }]
     */
    function ConferenceState(conference) {
      this.conference = conference;
      this.attendees = [];
      this.localVideoId = LOCAL_VIDEO_ID;
      this.videoIds = [LOCAL_VIDEO_ID].concat(REMOTE_VIDEO_IDS);
    }

    ConferenceState.prototype.updateAttendee = function(easyrtcid, id, displayName) {
      var attendeeToUpdate = this.attendees.filter(function(attendee) {
        return attendee.easyrtcid === easyrtcid;
      })[0];
      if (!attendeeToUpdate) {
        return;
      }
      attendeeToUpdate.id = id;
      attendeeToUpdate.displayName = displayName;
      attendeeToUpdate.easyrtcid = easyrtcid;
      $rootScope.$apply();
      $rootScope.$broadcast('conferencestate:attendees:update', attendeeToUpdate);
    };

    ConferenceState.prototype.pushAttendee = function(index, easyrtcid, id, displayName) {
      var attendee = {
        videoIds: this.videoIds[index],
        id: id,
        easyrtcid: easyrtcid,
        displayName: displayName
      };
      this.attendees[index] = attendee;
      $rootScope.$broadcast('conferencestate:attendees:push', attendee);
    };

    ConferenceState.prototype.removeAttendee = function(index) {
      var attendee = this.attendees[index];
      this.attendees[index] = null;
      $rootScope.$broadcast('conferencestate:attendees:remove', attendee);
    };

    ConferenceState.prototype.updateLocalVideoId = function(videoId) {
      this.localVideoId = videoId;
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateLocalVideoIdToIndex = function(index) {
      this.localVideoId = this.videoIds[index];
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateSpeaking = function(userId, speaking) {
      var attendeeToUpdate = this.attendees.filter(function(attendee) {
        return attendee.id === userId;
      })[0];
      if (!attendeeToUpdate) {
        return;
      }
      attendeeToUpdate.speaking = speaking;
      $rootScope.$apply();
      $rootScope.$broadcast('conferencestate:speaking', { id: attendeeToUpdate.easyrtcid, speaking: speaking });
    };

    ConferenceState.prototype.updateMuteFromIndex = function(index, mute) {
      if (this.attendees[index]) {
        this.attendees[index].mute = mute;
        $rootScope.$applyAsync();
      }
    };

    ConferenceState.prototype.updateMuteFromEasyrtcid = function(easyrtcid, mute) {
      this.attendees = this.attendees.map(function(attendee) {
        if (attendee.easyrtcid === easyrtcid) {
          attendee.mute = mute;
        }
        return attendee;
      });
      $rootScope.$applyAsync();
    };

    return ConferenceState;
  }])

  .factory('drawVideo', function($rootScope, $window, $interval) {
    var requestAnimationFrame =
      $window.requestAnimationFrame ||
      $window.mozRequestAnimationFrame ||
      $window.msRequestAnimationFrame ||
      $window.webkitRequestAnimationFrame;

    var VIDEO_FRAME_RATE = 1000 / 30;
    var promise;

    function draw(context, video, width, height) {
      // see https://bugzilla.mozilla.org/show_bug.cgi?id=879717
      // Sometimes Firefox drawImage before it is even available.
      // Thus we ignore this error.
      try {
        context.drawImage(video, 0, 0, width, height);
      } catch (e) {
        if (e.name !== 'NS_ERROR_NOT_AVAILABLE') {
          throw e;
        }
      }

    }

    return function(context, video, width, height) {
      function stopCurrentAnimation() {
        if (promise) {
          $interval.cancel(promise);
        }
      }

      stopCurrentAnimation();

      promise = $interval(function() {
        requestAnimationFrame(function() {
          draw(context, video, width, height);
        });
      }, VIDEO_FRAME_RATE, 0, false);

      return stopCurrentAnimation;
    };
  })
  .factory('cropDimensions', function() {
    var valuesCache = {};

    function cropSide(cSide, vSide, vReferenceSide) {
      var diff = vSide - vReferenceSide;
      var start = Math.round(diff / 2);
      return start;
    }

    /*
      The goal of this function is to get the coordinate to crop the
      camera image to a square.
      width & height are the target canvas width & height
      vWidth & vHeight are the video width and height

      Read  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images
      the "Slicing" part

      This method sends back an array, where:
      the first element of the array is sx , the second element is sy,
      and the third element is sWidth & sHeight (yeah, bc it's a square)
    */
    function cropDimensions(width, height, vWidth, vHeight) {
      var key = width + ':' + height + ':' + vWidth + ':' + vHeight;
      if ( valuesCache[key] ) {
        return valuesCache[key];
      }
      var back = [0, 0, 0];
      if ( vWidth < vHeight ) {
        back[1] = cropSide(height, vHeight, vWidth);
        back[2] = vWidth;
      } else {
        back[0] = cropSide(width, vWidth, vHeight);
        back[2] = vHeight;
      }
      valuesCache[key] = back;
      return back;
    }

    return cropDimensions;

  })
  .factory('speechDetector', function() {
  /**
  * https://github.com/otalk/hark
  *
  * returns a hark instance
  *
  * detector.on('speaking', function() {...});
  * detector.on('stopped_speaking', function() {...});
  *
  * don't forget to call detector.stop();
  */
  /* global hark */
  return function(stream, options) {
    options = options || {};
    options.play = false;
    var speechEvents = hark(stream, options);
    stream = null;
    return speechEvents;
  };
});
