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

        $timeout(function() {
          canvas = element.find('canvas#mainVideoCanvas');
          context = canvas[0].getContext('2d');
          mainVideo = element.find('video#video-thumb0');
          mainVideo.on('loadedmetadata', function() {
            function drawVideoInCancas() {
              canvas[0].width = mainVideo[0].videoWidth;
              canvas[0].height = mainVideo[0].videoHeight;
              drawVideo(context, mainVideo[0], canvas[0].width, canvas[0].height);
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
          drawVideo(context, mainVideo[0], canvas[0].width, canvas[0].height);
          $rootScope.$broadcast('mainvideo', newVideoId);
        });

        scope.getDisplayName = function(userId) {
          return conferenceHelpers.getUserDisplayName(userId);
        };
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

        scope.$on('mainvideo', function(event, videoId) {
          mainVideo = $('video#' + videoId);
          videoElement = mainVideo[0];
          scope.muted = videoElement.muted;

          scope.mute = function() {
            videoElement.muted = !videoElement.muted;
            scope.onMobileToggleControls();
          };

          scope.$watch(function() {
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
  });
