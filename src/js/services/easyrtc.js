'use strict';

angular.module('op.live-conference')

  .factory('easyRTCService', ['$rootScope', '$log', 'webrtcFactory', 'tokenAPI', 'session',
    'ioSocketConnection', 'ioConnectionManager', '$timeout', 'easyRTCBitRates', 'currentConferenceState',
    'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'EASYRTC_APPLICATION_NAME', 'EASYRTC_EVENTS',
    function($rootScope, $log, webrtcFactory, tokenAPI, session, ioSocketConnection, ioConnectionManager, $timeout, easyRTCBitRates, currentConferenceState,
             LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, EASYRTC_APPLICATION_NAME, EASYRTC_EVENTS) {
      var easyrtc = webrtcFactory.get();
      easyrtc.enableDataChannels(true);

      var bitRates, room, disconnectCallbacks = [];
      var videoEnabled = true;

      function removeDisconnectCallback(id) {
        if (!id) {
          return false;
        }

        disconnectCallbacks.splice(id, 1);
      }

      function addDisconnectCallback(callback) {
        if (!callback) {
          return false;
        }

        return disconnectCallbacks.push(callback) - 1;
      }

      easyrtc.setDisconnectListener(function() {
        disconnectCallbacks.forEach(function(callback) {
          callback();
        });
      });

      addDisconnectCallback(function() {
        $log.info('Lost connection to signaling server');
      });

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

        easyrtc.debugPrinter = function(message) {
          $log.debug(message);
        };

        function onWebsocket() {
          var sio = ioSocketConnection.getSio();
          sio.socket = {connected: true};
          easyrtc.useThisSocketConnection(sio);

          function onLoginSuccess(easyrtcid) {
            $log.debug('Successfully logged: ' + easyrtcid);
            conferenceState.pushAttendee(0, easyrtcid, session.getUserId(), session.getUsername());
            $rootScope.$apply();
            if (!videoEnabled) {
              conferenceState.updateMuteVideoFromIndex(0, true);
              broadcastMe();
            }
          }

          function onLoginFailure(errorCode, message) {
            $log.error('Error while connecting to the webrtc signaling service ' + errorCode + ' : ' + message);
          }

          easyrtc.setOnError(function(errorObject){
            $log.error('setOnError with error: ' + errorObject.errorText + ' [error=' + JSON.stringify(errorObject) + ']');
          });

          easyrtc.setVideoDims();

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
              mute: conferenceState.attendees[0].mute,
              muteVideo: conferenceState.attendees[0].muteVideo
            };

            $log.debug('Data channel open, sending %s event with data: ', EASYRTC_EVENTS.attendeeUpdate, data);
            easyrtc.sendData(easyrtcid, EASYRTC_EVENTS.attendeeUpdate, data);
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            conferenceState.removeAttendee(slot + 1);
            $rootScope.$apply();
          });

          easyrtc.setPeerListener(function(easyrtcid, msgType, msgData) {
            $log.debug('Event %s received from %s with data: ', EASYRTC_EVENTS.attendeeUpdate, easyrtcid, msgData);
            conferenceState.updateAttendeeByEasyrtcid(easyrtcid, msgData);
          }, EASYRTC_EVENTS.attendeeUpdate);
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

      function enableVideo(videoChoice) {
        videoEnabled = videoChoice;
        easyrtc.enableVideo(videoChoice);
      }

      function isVideoEnabled() {
        return videoEnabled;
      }

      function muteRemoteMicrophone(easyrtcid, mute) {
        var stream = easyrtc.getRemoteStream(easyrtcid);
        if (stream && stream.getAudioTracks) {
          var tracks = stream.getAudioTracks();
          if (tracks) {
            tracks.forEach(function(track) {
              track.enabled = !mute;
            });
          }
        }
      }

      function setPeerListener(handler, msgType) {
        easyrtc.setPeerListener(handler, msgType);
      }

      function configureBandwidth(rate) {
        if (rate) {
          bitRates = easyRTCBitRates[rate];
        }
        else {
          bitRates = null;
        }
      }

      function myEasyrtcid() {
        return easyrtc.myEasyrtcid;
      }

      function prepareAttendeeForBroadcast(attendee) {
        return {
          id: attendee.id,
          easyrtcid: attendee.easyrtcid,
          displayName: attendee.displayName,
          avatar: attendee.avatar,
          mute: attendee.mute,
          muteVideo: attendee.muteVideo,
          speaking: attendee.speaking
        };
      }

      function broadcastData(msgType, data) {
        var occupants = easyrtc.getRoomOccupantsAsArray(room);

        if (!occupants) {
          return;
        }

        occupants.forEach(function(easyrtcid) {
          if (easyrtcid === myEasyrtcid()) {
            return;
          }

          easyrtc.sendData(easyrtcid, msgType, data);
        });
      }

      function broadcastMe() {
        var attendee = currentConferenceState.getAttendeeByEasyrtcid(myEasyrtcid());

        if (!attendee) {
          return;
        }

        broadcastData(EASYRTC_EVENTS.attendeeUpdate, prepareAttendeeForBroadcast(attendee));
      }

      return {
        leaveRoom: leaveRoom,
        performCall: performCall,
        connect: connect,
        enableMicrophone: enableMicrophone,
        muteRemoteMicrophone: muteRemoteMicrophone,
        enableCamera: enableCamera,
        enableVideo: enableVideo,
        isVideoEnabled: isVideoEnabled,
        configureBandwidth: configureBandwidth,
        setPeerListener: setPeerListener,
        myEasyrtcid: myEasyrtcid,
        broadcastData: broadcastData,
        broadcastMe: broadcastMe,
        addDisconnectCallback: addDisconnectCallback,
        removeDisconnectCallback: removeDisconnectCallback
      };
    }]);
