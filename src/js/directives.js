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
  }])
  .directive('localSpeakEmitter', ['$rootScope', 'session', 'speechDetector', function($rootScope, session, speechDetector) {
    function link(scope) {
      function createLocalEmitter(stream) {
        var detector = speechDetector(stream);
        var id = session.getUserId();
        scope.$on('$destroy', function() {
          detector.stop();
          detector = null;
        });
        detector.on('speaking', function() {
          $rootScope.$broadcast('speaking', {id: id});
        });
        detector.on('stopped_speaking', function() {
          $rootScope.$broadcast('stopped_speaking', {id: id});
        });
      }

      var unreg = $rootScope.$on('localMediaStream', function(event, stream) {
        unreg();
        createLocalEmitter(stream);
      });
    }

    return {
      restrict: 'A',
      link: link
    };
  }]);
