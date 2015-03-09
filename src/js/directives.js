'use strict';

angular.module('op.live-conference')
  .directive('conferenceVideo', ['$timeout', '$window', 'drawVideo', 'conferenceHelpers', function($timeout, $window, drawVideo, conferenceHelpers) {
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
        scope.muted = false;
        scope.mute = function() {
          scope.muted = !scope.muted;
        };
        scope.videoMuted = false;
        scope.muteVideo = function() {
          scope.videoMuted = !scope.videoMuted;
        };

        scope.$watch('muted', function() {
          var video = element.find('video');
          video[0].muted = scope.muted;
        });

        scope.$watch('videoMuted', function() {
          var video = element.find('video');
          video[0].videoMuted = scope.videoMuted;
        });

        scope.showReportPopup = function() {}
      }
    };
  })

  .directive('conferenceUserVideo', ['$modal', function($modal) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/user-video.jade',
      scope: {
        videoId: '@'
      },
      link: function(scope, element) {
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
          modal.$promise.then(modal.toggle);
        };

        scope.muted = false;
        scope.mute = function() {
          scope.muted = !scope.muted;
          scope.onMobileToggleControls();
        };

        scope.$watch('muted', function() {
          var video = element.find('video');
          video[0].muted = scope.muted;
        });

        scope.showReportPopup = function() {
          scope.onMobileToggleControls();
        };
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
