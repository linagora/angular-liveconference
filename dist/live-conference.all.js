'use strict';

angular.module('op.live-conference')
  .directive('conferenceVideo', ['$timeout', '$window', '$rootScope', 'drawVideo', 'conferenceHelpers', function($timeout, $window, $rootScope, drawVideo, conferenceHelpers) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/conference-video.jade',
      link: function(scope, element) {
        var canvas = {};
        var context = {};
        var mainVideo = {};
        var stopAnimation = function() {};

        function garbage() {
          stopAnimation();
          canvas = {};
          context = {};
          mainVideo = {};
          stopAnimation = function() {};
        }

        $timeout(function() {
          canvas = element.find('canvas#mainVideoCanvas');
          context = canvas[0].getContext('2d');
          mainVideo = element.find('video#video-thumb0');
          mainVideo.on('loadedmetadata', function() {
            function drawVideoInCancas() {
              canvas[0].width = mainVideo[0].videoWidth;
              canvas[0].height = mainVideo[0].videoHeight;
              stopAnimation = drawVideo(context, mainVideo[0], canvas[0].width, canvas[0].height);
            }
            if ($window.mozRequestAnimationFrame) {
              // see https://bugzilla.mozilla.org/show_bug.cgi?id=926753
              // Firefox needs this timeout.
              $timeout(function() {
                drawVideoInCancas();
              }, 500);
            } else {
              drawVideoInCancas();
            }
            $rootScope.$broadcast('mainvideo', 'video-thumb0');
          });
        }, 1000);

        scope.$watch('mainVideoId', function(newVideoId) {
          // Reject the first watch of the mainVideoId
          // when clicking on a new video, loadedmetadata event is not
          // fired.
          if (!mainVideo[0]) {
            return;
          }
          mainVideo = element.find('video#' + newVideoId);
          canvas[0].width = mainVideo[0].videoWidth;
          canvas[0].height = mainVideo[0].videoHeight;
          stopAnimation = drawVideo(context, mainVideo[0], canvas[0].width, canvas[0].height);
          $rootScope.$broadcast('mainvideo', newVideoId);
        });

        scope.getDisplayName = function(userId) {
          return conferenceHelpers.getUserDisplayName(userId);
        };

        scope.$on('$destroy', garbage);
      }
    };
  }])

  .directive('conferenceAttendee', function() {
    return {
      restrict: 'E',
      templateUrl: 'templates/attendee.jade'
    };
  })

  .directive('conferenceAttendeeVideo', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/attendee-video.jade',
      scope: {
        attendee: '=',
        videoId: '@',
        onVideoClick: '=',
        videoIndex: '='
      },
      link: function(scope, element) {
        var video = element.find('video');
        scope.muted = video[0].muted;

        scope.mute = function() {
          video[0].muted = !video[0].muted;
        };

        scope.$watch(function() {
          return video[0].muted;
        }, function() {
          scope.muted = video[0].muted;
        });

        scope.showReportPopup = function() {}
      }
    };
  })

  .directive('conferenceUserVideo', ['$modal', 'matchmedia', function($modal, matchmedia) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/user-video.jade',
      link: function(scope) {
        if (matchmedia.isDesktop()) {
          return;
        }

        var modal = $modal({
          scope: scope,
          animation: 'am-fade-and-scale',
          placement: 'center',
          template: 'templates/mobile-user-video-quadrant-control.jade',
          container: 'div.user-video',
          backdrop: 'static',
          show: false
        });

        scope.onMobileToggleControls = function() {
          if (scope.mainVideoId === 'video-thumb0') {
            return;
          }
          modal.$promise.then(modal.toggle);
        };

        scope.showReportPopup = function() {
          scope.onMobileToggleControls();
        };

        var mainVideo = {};
        var videoElement = {};
        var watcher = {};

        scope.$on('mainvideo', function(event, videoId) {
          if (watcher instanceof Function) {
            // we must unregister previous watcher
            // if it has been initialized first
            watcher();
          }
          mainVideo = $('video#' + videoId);
          videoElement = mainVideo[0];
          scope.muted = videoElement.muted;

          scope.mute = function() {
            videoElement.muted = !videoElement.muted;
            scope.onMobileToggleControls();
          };

          watcher = scope.$watch(function() {
            return videoElement.muted;
          }, function() {
            scope.muted = videoElement.muted;
          });
        });
      }
    };
  }])

  .directive('conferenceUserControlBar', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/user-control-bar.jade',
      scope: {
        users: '=',
        easyrtc: '=',
        inviteCall: '=',
        showInvitation: '=',
        onLeave: '='
      },
      controller: function($scope, $log, easyRTCService) {
        $scope.muted = false;
        $scope.videoMuted = false;

        $scope.toggleSound = function() {
          easyRTCService.enableMicrophone($scope.muted);
          $scope.muted = !$scope.muted;
        };

        $scope.toggleCamera = function() {
          easyRTCService.enableCamera($scope.videoMuted);
          easyRTCService.enableVideo($scope.videoMuted);
          $scope.videoMuted = !$scope.videoMuted;
        };

        $scope.showInvitationPanel = function() {
          $scope.showInvitation();
        };

        $scope.leaveConference = function() {
          $scope.onLeave();
        };
      }
    };
  })
  .directive('scaleToCanvas', ['$interval', '$window', 'cropDimensions', function($interval, $window, cropDimensions) {

    var requestAnimationFrame =
      $window.requestAnimationFrame ||
      $window.mozRequestAnimationFrame ||
      $window.msRequestAnimationFrame ||
      $window.webkitRequestAnimationFrame;

    function link(scope, element, attrs) {

      var widgets = [];
      var toggleAnim = false;
      var stopScaling = false;

      function videoToCanvas(widget) {
        var canvas = widget.canvas,
            ctx = widget.context,
            vid = widget.video,
            width = canvas.width,
            height = canvas.height,
            vHeight = vid.videoHeight,
            vWidth = vid.videoWidth;
        if (!height || !width || !vHeight || !vWidth) {
          return;
        }
        var cropDims = cropDimensions(width, height, vWidth, vHeight);
        ctx.drawImage(vid, cropDims[0], cropDims[1], cropDims[2], cropDims[2], 0, 0, width, height);
      }

      $interval(function cacheWidgets() {
        element.find('video').each(function(index, vid) {
          var canvas = element.find('canvas[data-video-id=' + vid.id + ']').get(0);
          widgets.push({
            video: vid,
            canvas: canvas,
            context: canvas.getContext('2d')
          });
        });
      }, 100, 1, false);

      function onAnimationFrame() {
        if ((toggleAnim = !toggleAnim)) {
          widgets.forEach(videoToCanvas);
        }
        if (stopScaling) {
          return;
        }
        requestAnimationFrame(onAnimationFrame);
      }

      function garbage() {
        stopScaling = true;
        widgets = [];
      }

      scope.$on('$destroy', garbage);

      onAnimationFrame();
    }

    return {
      restrict: 'A',
      link: link
    };
  }]);
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

      function connect(conference, mainVideoId, attendees) {

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

        easyrtc.joinRoom(conference._id, null,
          function() {
            $log.debug('Joined room ' + conference._id);
          },
          function() {
            $log.debug('Error while joining room ' + conference._id);
          }
        );

        easyrtc.username = session.getUserId();
        attendees[0] = session.getUserId();

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
            mainVideoId,
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
            attendees[slot + 1] = easyrtc.idToName(easyrtcid);
            $log.debug('SetOnCall', easyrtcid);
            $rootScope.$apply();
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            attendees[slot + 1] = null;
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

  });
angular.module('op.liveconference-templates', []).run(['$templateCache', function($templateCache) {
  "use strict";
  $templateCache.put("templates/application.jade",
    "<div class=\"conference-container\"><div class=\"container-fluid\"><div class=\"row\"><div ng-view></div></div></div></div>");
  $templateCache.put("templates/attendee-settings-dropdown.jade",
    "<ul role=\"menu\" class=\"dropdown-menu attendee-settings-dropdown\"><li role=\"presentation\"><a href=\"\" ng-click=\"mute()\" role=\"menuitem\" target=\"_blank\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-fw conference-mute-button\"></i>&nbsp;Mute</a></li><li role=\"presentation\"><a href=\"\" ng-click=\"showReportPopup()\" role=\"menuitem\" target=\"_blank\"><i class=\"fa fa-fw fa-exclamation-triangle conference-report-button\"></i>&nbsp;Report</a></li></ul>");
  $templateCache.put("templates/attendee-video.jade",
    "<div class=\"attendee-video\"><canvas data-video-id=\"{{videoId}}\" width=\"150\" height=\"150\" ng-click=\"onVideoClick(videoIndex)\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = false\" ng-init=\"count=0\" ng-class=\"{thumbhover: thumbhover}\" class=\"conference-attendee-video-multi\"></canvas><video id=\"{{videoId}}\" autoplay=\"autoplay\"></video><a href=\"\" target=\"_blank\" ng-show=\"videoId !== 'video-thumb0' &amp;&amp; thumbhover\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = true\" class=\"hidden-xs hidden-sm\"><i data-placement=\"right-bottom\" data-html=\"true\" data-animation=\"am-flip-x\" bs-dropdown template=\"templates/attendee-settings-dropdown.jade\" class=\"fa fa-2x fa-cog conference-settings-button\"></i></a><i ng-show=\"muted &amp;&amp; videoId !== 'video-thumb0'\" class=\"fa fa-2x fa-microphone-slash conference-secondary-mute-button\"></i><i ng-show=\"videoMuted\" class=\"fa fa-2x fa-eye-slash conference-secondary-toggle-video-button\"></i><p class=\"text-center conference-attendee-name ellipsis\">{{attendee}}</p></div>");
  $templateCache.put("templates/attendee.jade",
    "<div class=\"col-xs-12 media nopadding conference-attendee\"><a href=\"#\" class=\"pull-left\"><img src=\"/images/user.png\" ng-src=\"/api/users/{{user._id}}/profile/avatar\" class=\"media-object thumbnail\"></a><div class=\"media-body\"><h6 class=\"media-heading\">{{user.firstname}} {{user.lastname}}</h6><button type=\"submit\" ng-disabled=\"invited\" ng-click=\"inviteCall(user); invited=true\" class=\"btn btn-primary nopadding\">Invite</button></div><div class=\"horiz-space\"></div></div>");
  $templateCache.put("templates/conference-video.jade",
    "<div id=\"multiparty-conference\" class=\"conference-video\"><div class=\"row\"><conference-user-video video-id=\"{{mainVideoId}}\"></conference-user-video></div><div class=\"row\"><conference-user-control-bar users=\"users\" easyrtc=\"easyrtc\" invite-call=\"invite\" show-invitation=\"showInvitation\" on-leave=\"onLeave\"></conference-user-control-bar></div><div class=\"row conference-row-attendees-bar\"><div class=\"conference-attendees-bar\"><ul scale-to-canvas class=\"content\"><li ng-repeat=\"id in attendeeVideoIds\" ng-hide=\"!attendees[$index]\"><conference-attendee-video video-index=\"$index\" on-video-click=\"streamToMainCanvas\" video-id=\"{{id}}\" attendee=\"getDisplayName(attendees[$index])\"></conference-attendee-video></li></ul></div></div></div>");
  $templateCache.put("templates/invite-members.jade",
    "<div class=\"aside\"><div class=\"aside-dialog\"><div class=\"aside-content\"><div class=\"aside-header\"><h4>Members</h4></div><div class=\"aside-body\"><div ng-repeat=\"user in users\" class=\"row\"><conference-attendee></conference-attendee></div></div></div></div></div>");
  $templateCache.put("templates/live.jade",
    "<div class=\"col-xs-12\"><conference-video easyrtc=\"easyrtc\"></conference-video><conference-notification conference-id=\"{{conference._id}}\"></conference-notification></div>");
  $templateCache.put("templates/mobile-user-video-quadrant-control.jade",
    "<ul class=\"list-inline mobile-user-video-control\"><li><a href=\"\" ng-click=\"mute()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-5x fa-fw\"></i></a></li><li><a href=\"\" ng-click=\"onMobileToggleControls()\"><i class=\"fa fa-5x fa-fw fa-times\"></i></a></li><li><a href=\"\" ng-click=\"showReportPopup()\"><i class=\"fa fa-5x fa-fw fa-exclamation-triangle\"></i></a></li></ul>");
  $templateCache.put("templates/user-control-bar.jade",
    "<div class=\"col-xs-12 conference-user-control-bar text-center\"><ul class=\"list-inline\"><li><a href=\"\" ng-click=\"showInvitationPanel()\"><i class=\"fa fa-users fa-2x conference-toggle-invite-button\"></i></a></li><li><a href=\"\" ng-click=\"toggleCamera()\"><i ng-class=\"{'fa-eye': !videoMuted, 'fa-eye-slash': videoMuted}\" class=\"fa fa-2x conference-toggle-video-button\"></i></a></li><li><a href=\"\" ng-click=\"toggleSound()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-2x conference-mute-button\"></i></a></li><li><a href=\"\" ng-click=\"leaveConference()\"><i class=\"fa fa-phone fa-2x conference-toggle-terminate-call-button\"></i></a></li></ul></div>");
  $templateCache.put("templates/user-video.jade",
    "<div class=\"col-xs-12 nopadding\"><div ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = false\" class=\"user-video\"><canvas id=\"mainVideoCanvas\" ng-click=\"onMobileToggleControls()\" class=\"conference-main-video-multi\"></canvas></div></div>");
}]);
