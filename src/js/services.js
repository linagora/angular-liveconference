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
  .constant('LOCAL_VIDEO_ID', 'video-thumb0')
  .factory('easyRTCService', ['$rootScope', '$log', 'webrtcFactory', 'tokenAPI', 'session',
    'ioSocketConnection', 'ioConnectionManager', '$timeout', 'easyRTCBitRates',
    function($rootScope, $log, webrtcFactory, tokenAPI, session, ioSocketConnection, ioConnectionManager, $timeout, easyRTCBitRates) {
      var easyrtc = webrtcFactory.get();
      var bitRates;

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
          } else {
            $log.debug('Leaving room ' + roomName);
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
        conferenceState.pushAttendee(0, session.getUserId());

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
            'LiveConference',
            'video-thumb0',
            [
              'video-thumb1',
              'video-thumb2',
              'video-thumb3',
              'video-thumb4',
              'video-thumb5',
              'video-thumb6',
              'video-thumb7',
              'video-thumb8'
            ],
            onLoginSuccess,
            onLoginFailure);

          easyrtc.setOnCall(function(easyrtcid, slot) {
            conferenceState.pushAttendee(slot + 1, easyrtc.idToName(easyrtcid));
            $log.debug('SetOnCall', easyrtcid);
            $rootScope.$apply();
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            conferenceState.removeAttendee(slot + 1);
            $rootScope.$apply();
          });
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
        configureBandwidth: configureBandwidth
      };
    }])

  .factory('ConferenceState', ['$rootScope', function($rootScope) {
    function ConferenceState(conference) {
      this.conference = conference;
      this.videoIds = [
        'video-thumb0',
        'video-thumb1',
        'video-thumb2',
        'video-thumb3',
        'video-thumb4',
        'video-thumb5',
        'video-thumb6',
        'video-thumb7',
        'video-thumb8'
      ];
      this.attendees = [];
      this.positions = [];
      this.mainVideoId = 'video-thumb0';
    }

    ConferenceState.prototype.pushAttendee = function(index, attendee) {
      this.attendees[index] = attendee;
      $rootScope.$broadcast('conferencestate:attendees:push', attendee)
    };

    ConferenceState.prototype.removeAttendee = function(index) {
      var attendee = this.attendees[index];
      var position = this.positions.filter(function(position) {
        return position && position.member._id === attendee;
      })[0];
      this.attendees[index] = null;
      $rootScope.$broadcast('conferencestate:attendees:remove', {attendee: attendee, position: position})
    };

    ConferenceState.prototype.updatePositions = function(conference) {
      var self = this;
      this.conference = conference;

      function _position(index) {
        return {
          member: (function() {
            return self.conference.members.filter(function(member) {
              return member._id === self.attendees[index];
            })[0];
          }) (),
          videoId: self.videoIds[index],
          videoIndex: i
        }
      }

      for(var i = 0; i < this.attendees.length; i++) {
        this.positions[i] = (this.attendees[i] === null) ? null : _position(i);
      }
    };

    ConferenceState.prototype.updateMainVideoId = function(mainVideoId) {
      this.mainVideoId = mainVideoId;
      $rootScope.$broadcast('conferencestate:mainvideoid:update', this.mainVideoId);
    };

    ConferenceState.prototype.updateMainVideoIdByIndex = function(index) {
      this.mainVideoId = this.videoIds[index];
      $rootScope.$broadcast('conferencestate:mainvideoid:update', this.mainVideoId);
    };

    ConferenceState.prototype.getMemberOfIndex = function(index) {
      var position = this.positions[index];
      return position ? position.member : null;
    };

    ConferenceState.prototype.getMemberOfVideoId = function(videoId) {
      var position = this.positions.filter(function(position) {
        return position && position.videoId === videoId;
      })[0];
      return position ? position.member : null;
    };

    ConferenceState.prototype.getMainVideoIdAsMember = function() {
      return this.positions.filter(function(position) {
        return position && position.videoId === this.mainVideoId
      }.bind(this))[0].member;
    };

    return ConferenceState;
  }])

  .factory('conferenceHelpers', function() {
    var map = {};

    function mapUserIdToName(users) {
      if (!users) {
        return map;
      }

      if (users instanceof Array) {
        users.forEach(function(user) {
          var name = user.displayName || 'No name';
          map[user._id] = name;
        });
        return map;
      }
      else {
        map[users._id] = users.displayName;
        return map;
      }
    }

    function getUserDisplayName(userId) {
      return userId ? map[userId] : null;
    }

    function getMainVideoAttendeeIndexFrom(videoId) {
      return parseInt(videoId.substr(11));
    }

    function isMainVideo(mainVideoId, videoId) {
      return mainVideoId === videoId;
    }

    return {
      mapUserIdToName: mapUserIdToName,
      getMainVideoAttendeeIndexFrom: getMainVideoAttendeeIndexFrom,
      isMainVideo: isMainVideo,
      getUserDisplayName: getUserDisplayName
    };
  })

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
