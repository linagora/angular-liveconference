'use strict';

angular.module('op.live-conference')

  .factory('drawVideo', ['$window', '$interval', 'drawAvatarIfVideoMuted', function($window, $interval, drawAvatarIfVideoMuted) {
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
        drawAvatarIfVideoMuted(video.id, context, width, height, function() {
          context.drawImage(video, 0, 0, width, height);
        });
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
  }])
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

  .factory('getCoordinatesOfCenteredImage', function() {
    return function(width, height, childSize) {
      if (!childSize) {
        childSize = 1;
      }
      var scale = Math.min(Math.min(width, height) / childSize, 1);

      return {
        x: (width - childSize * scale) / 2,
        y: (height - childSize * scale) / 2,
        size: childSize * scale
      };
    };
  })

  .factory('drawAvatarIfVideoMuted', ['currentConferenceState', 'attendeeColorsService', 'getCoordinatesOfCenteredImage', '$log',
    function(currentConferenceState, attendeeColorsService, getCoordinatesOfCenteredImage, $log) {
    return function(videoId, context, width, height, otherwise) {
      var attendee = currentConferenceState.getAttendeeByVideoId(videoId);

      if (!attendee) {
        return;
      }

      var canvas = context.canvas;

      if (attendee.muteVideo) {
        if (canvas.drawnAvatarVideoId === videoId) {
          return;
        }

        currentConferenceState.getAvatarImageByIndex(attendee.index, function(err, image) {
          if (err) {
            return $log.error('Failed to get avatar image for attendee with videoId %s: ', videoId, err);
          }

          if (!image.width) {
            return;
          }

          var coords = getCoordinatesOfCenteredImage(width, height, image.width);

          context.clearRect(0, 0, width, height);
          context.fillStyle = attendeeColorsService.getColorForAttendeeAtIndex(attendee.index);
          context.fillRect(coords.x, coords.y, coords.size, coords.size);
          context.drawImage(image, coords.x, coords.y, coords.size, coords.size);

          canvas.drawnAvatarVideoId = videoId;
        });
      } else {
        otherwise(videoId, context, width, height);
        canvas.drawnAvatarVideoId = null;
      }
    };
  }]);

