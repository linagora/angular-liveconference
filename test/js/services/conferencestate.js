'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The ConferenceState module', function() {
  beforeEach(angular.mock.module('op.live-conference'));

  describe('ConferenceState service', function() {
    var ConferenceState, conference, conferenceState, $rootScope, apply, newImage;

    beforeEach(function() {
      apply = false;
      newImage = {};

      module(function($provide) {
        $provide.value('newImage', function() {
          return newImage;
        });
      });

      inject(function($injector, _$rootScope_) {
        ConferenceState = $injector.get('ConferenceState');

        $rootScope = _$rootScope_;
        $rootScope.$applyAsync = function() { apply = true; };
      });

      conference = { name: 'name' };
      conferenceState = new ConferenceState(conference);
    });

    it('should store conference, attendees, localVideoId and videoIds', function() {
      expect(conferenceState.conference).to.deep.equal({ name: 'name' });
      expect(conferenceState.attendees).to.deep.equal([]);
      expect(conferenceState.localVideoId).to.equal('video-thumb0');
      expect(conferenceState.videoIds).to.deep.equal([
        'video-thumb0',
        'video-thumb1',
        'video-thumb2',
        'video-thumb3',
        'video-thumb4',
        'video-thumb5',
        'video-thumb6',
        'video-thumb7',
        'video-thumb8'
      ]);
      var videoElements = [];
      for (var i = 0; i < 9; i++) {
        videoElements.push(angular.element('<video id="video-thumb' + i + '" autoplay="autoplay" style="display:none;"></video>'));
      }
      expect(conferenceState.videoElements).to.deep.equal(videoElements);
    });

    describe('getAttendeeByEasyrtcid method', function() {
      it('should return the correct attendee', function() {
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }, null];
        expect(conferenceState.getAttendeeByEasyrtcid('easyrtcid')).to.deep.equal({ easyrtcid: 'easyrtcid' });
        expect(conferenceState.getAttendeeByEasyrtcid('easyrtcid3')).to.be.null;
      });
    });

    describe('getAttendeeByVideoId method', function() {
      it('should return the correct attendee', function() {
        conferenceState.attendees = [{ videoId: 'video1' }, { videoId: 'video2' }, null];

        expect(conferenceState.getAttendeeByVideoId('video1')).to.deep.equal({ videoId: 'video1' });
        expect(conferenceState.getAttendeeByVideoId('idontexist')).to.be.null;
      });
    });

    describe('updateAttendee method', function() {
      it('should update the good attendee, $rootScope.$applyAsync() and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:attendees:update', function(event, attendee) {
          var expected = {
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName'
          };

          expect(attendee).to.deep.equal(expected);
          expect(conferenceState.attendees[0]).to.deep.equal(expected);
          expect(apply).to.be.true;

          done();
        });

        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }];
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          id: 'id',
          displayName: 'displayName'
        });
      });
    });

    describe('updateAttendee method', function() {
      it('should $rootScope.$broadcast when the speaking property changes', function(done) {
        $rootScope.$on('conferencestate:speaking', function(event, attendee) {
          expect(attendee).to.deep.equal({
            id: 'easyrtcid',
            speaking: true
          });

          done();
        });

        conferenceState.pushAttendee(0, 'easyrtcid');
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          speaking: true
        });
      });
    });

    describe('updateAttendee method', function() {
      it('should not $rootScope.$broadcast when the speaking property does not change', function(done) {
        $rootScope.$on('conferencestate:speaking', function() {
          done(new Error('This test should not call $rootScope.$broadcast(conferencestate:speaking)'));
        });

        conferenceState.attendees = [{
          easyrtcid: 'easyrtcid',
          speaking: true
        }];
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          speaking: true
        });

        done();
      });
    });

    describe('updateAttendee method', function() {
      it('should $rootScope.$broadcast when the mute property changes', function(done) {
        $rootScope.$on('conferencestate:mute', function(event, attendee) {
          expect(attendee).to.deep.equal({
            id: 'easyrtcid',
            mute: true
          });

          done();
        });

        conferenceState.pushAttendee(0, 'easyrtcid');
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          mute: true
        });
      });
    });

    describe('updateAttendee method', function() {
      it('should not $rootScope.$broadcast when the mute property does not change', function(done) {
        $rootScope.$on('conferencestate:mute', function() {
          done(new Error('This test should not call $rootScope.$broadcast(conferencestate:mute)'));
        });

        conferenceState.attendees = [{
          easyrtcid: 'easyrtcid',
          mute: true
        }];
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          mute: true
        });

        done();
      });
    });

    describe('updateAttendee method', function() {
      it('should $rootScope.$broadcast when the muteVideo property changes', function(done) {
        $rootScope.$on('conferencestate:muteVideo', function(event, attendee) {
          expect(attendee).to.deep.equal({
            id: 'easyrtcid',
            muteVideo: true
          });

          done();
        });

        conferenceState.pushAttendee(0, 'easyrtcid');
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          muteVideo: true
        });
      });
    });

    describe('updateAttendee method', function() {
      it('should not $rootScope.$broadcast when the muteVideo property does not change', function(done) {
        $rootScope.$on('conferencestate:muteVideo', function() {
          done(new Error('This test should not call $rootScope.$broadcast(conferencestate:muteVideo)'));
        });

        conferenceState.attendees = [{
          easyrtcid: 'easyrtcid',
          muteVideo: true
        }];
        conferenceState.updateAttendeeByEasyrtcid('easyrtcid', {
          easyrtcid: 'easyrtcid',
          muteVideo: true
        });

        done();
      });
    });

    describe('pushAttendee method', function() {
      it('should push the good attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:attendees:push', function(event, attendee) {
          var expected = {
            index: 0,
            videoId: 'video-thumb0',
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName',
            avatar: '/images/avatar/default.png',
            localmute: false
          };

          expect(attendee).to.deep.equal(expected);
          expect(conferenceState.attendees[0]).to.deep.equal(expected);
          done();
        });

        conferenceState.attendees = [];
        conferenceState.pushAttendee(0, 'easyrtcid', 'id', 'displayName');
      });
    });

    describe('removeAttendee method', function() {
      it('should remove the good attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:attendees:remove', function(event, attendee) {
          expect(attendee).to.deep.equal({ easyrtcid: 'easyrtcid2' });
          expect(conferenceState.attendees[1]).to.be.null;
          done();
        });

        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }];
        conferenceState.removeAttendee(1);
      });
    });

    describe('updateLocalVideoId method', function() {
      it('should update local video id and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:localVideoId:update', function(event, videoid) {
          expect(videoid).to.deep.equal('newlocalvideo');
          expect(conferenceState.localVideoId).to.deep.equal('newlocalvideo');
          done();
        });

        conferenceState.updateLocalVideoId('newlocalvideo');
      });
    });

    describe('updateLocalVideoIdToIndex method', function() {
      it('should update local video id by index and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:localVideoId:update', function(event, videoid) {
          expect(videoid).to.deep.equal('video-thumb2');
          expect(conferenceState.localVideoId).to.deep.equal('video-thumb2');
          done();
        });

        conferenceState.updateLocalVideoIdToIndex(2);
      });
    });

    describe('updateSpeaking method', function() {
      it('should do nothing if the attendee is not found', function() {
        $rootScope.$on('conferencestate:speaking', function() {
          throw new Error('should not be here');
        });

        conferenceState.attendees.push({
          easyrtcid: 'easyrtcid',
          id: 'id',
          displayName: 'displayName'
        });
        conferenceState.updateSpeaking('easyrtcid2', true);
      });

      it('should update speaking,  $rootScope.$applyAsync and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:speaking', function(event, data) {
          expect(data).to.deep.equal({id: 'easyrtcid2', speaking: true});
          expect(conferenceState.attendees[1].speaking).to.be.true;
          done();
        });

        conferenceState.attendees.push({
          easyrtcid: 'easyrtcid',
          id: 'id',
          displayName: 'displayName'
        });
        conferenceState.attendees.push({
          easyrtcid: 'easyrtcid2',
          id: 'id2',
          displayName: 'displayName'
        });
        conferenceState.updateSpeaking('easyrtcid2', true);
      });
    });

    describe('updateMuteFromEasyrtcid method', function() {
      it('should update mute property of attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:mute', function(event, data) {
          expect(data).to.deep.equal({id: 'easyrtcid', mute: true});
          expect(conferenceState.attendees).to.deep.equal([{ easyrtcid: 'easyrtcid', videoId: 'videoId', mute: true}]);
          done();
        });

        conferenceState.attendees = [{ easyrtcid: 'easyrtcid', videoId: 'videoId'}];
        conferenceState.updateMuteFromEasyrtcid('easyrtcid', true);
      });
    });

    describe('updateMuteFromIndex method', function() {
      it('should update mute property of attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:mute', function(event, data) {
          expect(data).to.deep.equal({id: 'easyrtcid', mute: true});
          expect(conferenceState.attendees).to.deep.equal([{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId', mute: true}]);
          done();
        });

        conferenceState.attendees = [{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId'}];
        conferenceState.updateMuteFromIndex(1, true);
      });
    });

    describe('updateMuteVideoFromEasyrtcid method', function() {
      it('should update muteVideo property of attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:muteVideo', function(event, data) {
          expect(data).to.deep.equal({id: 'easyrtcid', muteVideo: true});
          expect(conferenceState.attendees).to.deep.equal([{ easyrtcid: 'easyrtcid', videoId: 'videoId', muteVideo: true}]);
          done();
        });

        conferenceState.attendees = [{ easyrtcid: 'easyrtcid', videoId: 'videoId'}];
        conferenceState.updateMuteVideoFromEasyrtcid('easyrtcid', true);
      });
    });

    describe('updateMuteVideoFromIndex method', function() {
      it('should update muteVideo property of attendee and $rootScope.$broadcast', function(done) {
        $rootScope.$on('conferencestate:muteVideo', function(event, data) {
          expect(data).to.deep.equal({id: 'easyrtcid', muteVideo: true});
          expect(conferenceState.attendees).to.deep.equal([{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId', muteVideo: true}]);
          done();
        });

        conferenceState.attendees = [{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId'}];
        conferenceState.updateMuteVideoFromIndex(1, true);
      });
    });

    describe('getAvatarImageByIndex method', function() {

      it('should send back an error if attendee at given index does not exist', function(done) {
        conferenceState.getAvatarImageByIndex(0, function(err) {
          expect(err).to.exist;

          done();
        });
      });

      it('should send back the cached image if available', function(done) {
        conferenceState.avatarCache[0] = { image: 'loaded' };
        conferenceState.pushAttendee(0, 'easyrtcid');

        conferenceState.getAvatarImageByIndex(0, function(err, image) {
          expect(err).to.not.exist;
          expect(image).to.deep.equal({image: 'loaded' });

          expect(newImage).to.deep.equal({});

          done();
        });
      });

      it('should send back a new image when it is fully loaded', function(done) {
        conferenceState.pushAttendee(0, 'easyrtcid');

        conferenceState.getAvatarImageByIndex(0, function(err, image) {
          expect(err).to.not.exist;
          expect(image).to.exist;

          done();
        });
        newImage.onload();
      });

    });

    describe('updateLocalMuteFromEasyrtcid function', function() {
      it('should update localmute property of attendee', function() {
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }];
        conferenceState.updateLocalMuteFromEasyrtcid('easyrtcid', true);
        expect(conferenceState.attendees[0].localmute).to.be.true;
      });
    });

    describe('getVideoElementById function', function() {
      it('should return an video element ', function() {
        var video = angular.element('<video id="video-thumb1" autoplay="autoplay" style="display:none;"></video>');
        var videoElement = conferenceState.getVideoElementById('video-thumb1');
        expect(videoElement).to.deep.equal(video);
      });
    });

    describe('getAttendees() method', function() {
      it('should return a copy of the attendees array', function() {
        var attendees = [{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoIds: 'videoId'}];
        conferenceState.attendees = attendees;
        var attendeesCopy = conferenceState.getAttendees();
        expect(attendeesCopy).to.deep.equal(attendees);
        conferenceState.attendees[0].test = true;
        expect(attendeesCopy).to.not.have.property('test');
      });
    });

    describe('updateTimezoneOffsetFromIndex method', function() {
      it('should update timezoneOffset property of attendee and $rootScope.$broadcast', function() {
        conferenceState.attendees = [{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId'}];
        conferenceState.updateTimezoneOffsetFromIndex(1, -120);
        expect(conferenceState.attendees).to.deep.equal([{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoId: 'videoId', timezoneOffset: -120}]);
      });
    });
  });

  describe('The newImage service', function() {

    var newImage;

    beforeEach(function() {
      inject(function($injector) {
        newImage = $injector.get('newImage');
      });
    });

    it('should return an instance of Image', function() {
      expect(newImage()).to.be.an.instanceof(Image);
    });

  });

  describe('cropDimensions services', function() {
    beforeEach(function() {
      var self = this;
      inject(function(cropDimensions) {
        self.service = cropDimensions;
      });
    });

    it('should return a function', function() {
      expect(this.service).to.be.a('function');
    });
    describe('when video width is greater than video height', function() {
      it('should send an sx > 0, an sy=0', function() {
        var result = [100, 0, 200];
        var dimensions = this.service(100, 100, 400, 200);
        expect(dimensions).to.be.an('array');
        expect(dimensions).to.deep.equal(result);
      });
    });
    describe('when video height is greater than video width', function() {
      it('should send an sy > 0, an sx=0', function() {
        var result = [0, 100, 200];
        var dimensions = this.service(100, 100, 200, 400);
        expect(dimensions).to.be.an('array');
        expect(dimensions).to.deep.equal(result);
      });
    });
    describe('when video height equals video width', function() {
      it('should send an sy=0, an sx=0', function() {
        var result = [0, 0, 200];
        var dimensions = this.service(100, 100, 200, 200);
        expect(dimensions).to.be.an('array');
        expect(dimensions).to.deep.equal(result);
      });
    });
  });

  describe('drawVideo service', function() {

    beforeEach(function() {
      module(function($provide) {
        $provide.value('drawAvatarIfVideoMuted', function() {});
      });
    });

    it('should return a function', function() {
      inject(function(drawVideo) {
        var test = drawVideo();
        expect(test).to.be.a('function');
      });
    });
    it('should call $interval.cancel() when executing function', function(done) {
      module(function($provide) {
        function intervalMock() {
          return 'identifier';
        }

        intervalMock.cancel = function(id) {
          expect(id).to.equal('identifier');
          done();
        };

        $provide.value('$interval', intervalMock);
      });
      inject(function(drawVideo) {
        var test = drawVideo();
        test();
      });
    });
  });
});
