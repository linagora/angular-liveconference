'use strict';

angular.module('op.live-conference')

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
            $log.debug('On datachannel open send %s (%s)', data, 'attendee:initialization');
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

      function setPeerListener(handler, msgType) {
        easyrtc.setPeerListener(handler, msgType)
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

      function broadcastData(msgType, data) {
        easyrtc.getRoomOccupantsAsArray(room).forEach(function(easyrtcid) {
          if (easyrtcid === easyrtc.myEasyrtcid) {
            return;
          }
          easyrtc.sendData(easyrtcid, msgType, data);
        });
      }

      return {
        leaveRoom: leaveRoom,
        performCall: performCall,
        connect: connect,
        enableMicrophone: enableMicrophone,
        enableCamera: enableCamera,
        enableVideo: enableVideo,
        configureBandwidth: configureBandwidth,
        sendPeerMessage: sendPeerMessage,
        setPeerListener: setPeerListener,
        myEasyrtcid: myEasyrtcid,
        broadcastData: broadcastData
      };
    }]);
