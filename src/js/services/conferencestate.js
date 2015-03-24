'use strict';

angular.module('op.live-conference')

  .factory('currentConferenceState', ['session', 'ConferenceState', function(session, ConferenceState) {
    return new ConferenceState(session.conference);
  }])

  .factory('ConferenceState', ['$rootScope', 'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', function($rootScope, LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS) {
    /*
     * Store a snapshot of current conference status and an array of attendees describing
     * current visible attendees of the conference by their index as position.
     * attendees : [{
     *   videoId:
     *   id:
     *   easyrtcid:
     *   displayName:
     * }]
     */
    function ConferenceState(conference) {
      this.conference = conference;
      this.attendees = [];
      this.localVideoId = LOCAL_VIDEO_ID;
      this.videoIds = [LOCAL_VIDEO_ID].concat(REMOTE_VIDEO_IDS);
    }

    ConferenceState.prototype.getAttendeeByEasyrtcid = function(easyrtcid) {
      return this.attendees.filter(function(attendee) {
          return attendee && attendee.easyrtcid === easyrtcid;
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

      ['speaking', 'mute'].forEach(function(property) {
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
        videoIds: this.videoIds[index],
        id: id,
        easyrtcid: easyrtcid,
        displayName: displayName
      };
      this.attendees[index] = attendee;
      $rootScope.$broadcast('conferencestate:attendees:push', attendee);
    };

    ConferenceState.prototype.removeAttendee = function(index) {
      var attendee = this.attendees[index];
      this.attendees[index] = null;
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

    return ConferenceState;
  }]);
