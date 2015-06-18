'use strict';

angular.module('op.live-conference')
  .factory('newCanvas', [function() {
    return function(width, height) {
      var canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      return canvas;
    };
  }])
  .factory('localCameraScreenshot', ['LOCAL_VIDEO_ID', 'CHAT_AVATAR_SIZE', 'currentConferenceState', 'newCanvas', 'newImage',
    function(LOCAL_VIDEO_ID, CHAT_AVATAR_SIZE, currentConferenceState, newCanvas, newImage) {
      function shoot(screenshotEdgePx) {
        var attendee = currentConferenceState.getAttendeeByVideoId(LOCAL_VIDEO_ID);

        if (!attendee || attendee.muteVideo) {
          return null;
        }

        var size = screenshotEdgePx || CHAT_AVATAR_SIZE,
            thumbnail = angular.element('canvas[data-video-id=' + LOCAL_VIDEO_ID + ']');

        if (!thumbnail.length) {
          return null;
        }

        var canvas = newCanvas(size, size),
            image = newImage();

        canvas.getContext('2d').drawImage(thumbnail[0], 0, 0, size, size);
        image.src = canvas.toDataURL();

        return image;
      }

      return {
        shoot: shoot
      };
    }]);
