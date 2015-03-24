'use strict';

angular.module('op.live-conference')

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
  })

  .factory('AutoVideoSwitcher', ['$rootScope', '$timeout', 'AUTO_VIDEO_SWITCH_TIMEOUT', 'LOCAL_VIDEO_ID',
    function($rootScope, $timeout, AUTO_VIDEO_SWITCH_TIMEOUT, LOCAL_VIDEO_ID) {

      function AutoVideoSwitcher(conferenceState) {
        this.conferenceState = conferenceState;
        this.timeouts = {};
        var self = this;
        $rootScope.$on('conferencestate:speaking', function(event, data) {
          if (data.speaking) {
            self.onSpeech(event, data);
          } else {
            self.onSpeechEnd(event, data);
          }
        });
      }

      AutoVideoSwitcher.prototype.onSpeech = function(evt, data) {
        var member = this.getMemberFromData(data);
        if (!member || this.timeouts[member.easyrtcid] || member.videoId === LOCAL_VIDEO_ID || member.mute || member.videoId === this.conferenceState.localVideoId) {
          return;
        }
        var easyrtcid = member.easyrtcid;

        this.timeouts[easyrtcid] = $timeout(function() {
          var member = this.getMemberFromData(data);
          if (!member) {
            return;
          }

          this.conferenceState.updateLocalVideoId(member.videoId);
        }.bind(this), AUTO_VIDEO_SWITCH_TIMEOUT, false);
      };

      AutoVideoSwitcher.prototype.onSpeechEnd = function(evt, data) {
        var member = this.getMemberFromData(data);
        if (!member || !this.timeouts[member.easyrtcid] || member.videoId === LOCAL_VIDEO_ID) {
          return;
        }
        $timeout.cancel(this.timeouts[member.easyrtcid]);
        this.timeouts[member.easyrtcid] = null;
      };

      AutoVideoSwitcher.prototype.getMemberFromData = function(data) {
        return this.conferenceState.getAttendeeByEasyrtcid(data.id);
      };

      return AutoVideoSwitcher;
    }]);
