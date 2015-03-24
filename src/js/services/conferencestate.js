'use strict';

angular.module('op.live-conference')

  .factory('currentConferenceState', ['session', 'ConferenceState', function(session, ConferenceState) {
    return new ConferenceState(session.conference);
  }])

  .factory('newImage', [function() {
    return function() {
      return new Image();
    };
  }])

  .factory('ConferenceState', ['$rootScope', 'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'newImage', function($rootScope, LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, newImage) {
    /*
     * Store a snapshot of current conference status and an array of attendees describing
     * current visible attendees of the conference by their index as position.
     * attendees : [{
     *   videoId:
     *   id:
     *   easyrtcid:
     *   displayName:
     *   avatar:
     * }]
     */
    function ConferenceState(conference) {
      this.conference = conference;
      this.attendees = [];
      this.localVideoId = LOCAL_VIDEO_ID;
      this.videoIds = [LOCAL_VIDEO_ID].concat(REMOTE_VIDEO_IDS);
      this.avatarCache = [];
    }

    ConferenceState.prototype.getAttendeeByEasyrtcid = function(easyrtcid) {
      return this.attendees.filter(function(attendee) {
          return attendee && attendee.easyrtcid === easyrtcid;
        })[0] || null;
    };

    ConferenceState.prototype.getAttendeeByVideoId = function(videoId) {
      return this.attendees.filter(function(attendee) {
          return attendee && attendee.videoId === videoId;
        })[0] || null;
    };

    function updateAttendee(attendee, properties) {
      if (!attendee) {
        return;
      }

      Object.keys(properties).forEach(function(property) {
        attendee[property] = properties[property];
      });

      $rootScope.$applyAsync();
      $rootScope.$broadcast('conferencestate:attendees:update', attendee);

      ['speaking', 'mute', 'muteVideo'].forEach(function(property) {
        $rootScope.$broadcast('conferencestate:' + property, (function(o) { o[property] = attendee[property]; return o; })({ id: attendee.easyrtcid }));
      });
    }

    ConferenceState.prototype.updateAttendeeByIndex = function(index, properties) {
      updateAttendee(this.attendees[index], properties);
    };

    ConferenceState.prototype.updateAttendeeByEasyrtcid = function(easyrtcid, properties) {
      updateAttendee(this.getAttendeeByEasyrtcid(easyrtcid), properties);
    };

    ConferenceState.prototype.pushAttendee = function(index, easyrtcid, id, displayName) {
      var attendee = {
        index: index,
        videoId: this.videoIds[index],
        id: id,
        easyrtcid: easyrtcid,
        displayName: displayName,
        // This needs to be served by the webapp embedding angular-liveconference
        avatar: '/images/avatar/default.png'
      };
      this.attendees[index] = attendee;
      $rootScope.$broadcast('conferencestate:attendees:push', attendee);
    };

    ConferenceState.prototype.removeAttendee = function(index) {
      var attendee = this.attendees[index];
      this.attendees[index] = null;
      this.avatarCache[index] = null;
      $rootScope.$broadcast('conferencestate:attendees:remove', attendee);
    };

    ConferenceState.prototype.updateLocalVideoId = function(videoId) {
      this.localVideoId = videoId;
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateLocalVideoIdToIndex = function(index) {
      this.localVideoId = this.videoIds[index];
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateSpeaking = function(easyrtcid, speaking) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { speaking: speaking });
    };

    ConferenceState.prototype.updateMuteFromIndex = function(index, mute) {
      this.updateAttendeeByIndex(index, { mute: mute });
    };

    ConferenceState.prototype.updateMuteFromEasyrtcid = function(easyrtcid, mute) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { mute: mute });
    };

    ConferenceState.prototype.updateMuteVideoFromIndex = function(index, mute) {
      this.updateAttendeeByIndex(index, { muteVideo: mute });
    };

    ConferenceState.prototype.updateMuteVideoFromEasyrtcid = function(easyrtcid, mute) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { muteVideo: mute });
    };

    ConferenceState.prototype.getAvatarImageByIndex = function(index, callback) {
      var attendee = this.attendees[index];

      if (!attendee) {
        return callback(new Error('No attendee at index ' + index));
      }

      if (!this.avatarCache[index]) {
        var self = this;

        this.avatarCache[index] = newImage();
        this.avatarCache[index].src = attendee.avatar;
        this.avatarCache[index].onload = function() {
          callback(null, self.avatarCache[index]);
        };
      } else {
        callback(null, this.avatarCache[index]);
      }
    };

    return ConferenceState;
  }]);
