'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The draw factory collection', function () {

  beforeEach(angular.mock.module('op.live-conference'));

  describe('The drawAvatarIfVideoMuted function', function() {

    var currentConferenceState, drawAvatarIfVideoMuted, centerAndFit, attendeeColorsService, centerAndFitMock;

    beforeEach(function() {
      centerAndFitMock = {};
      currentConferenceState = {};
      centerAndFit = function() { return centerAndFitMock; };
      attendeeColorsService = {
        getColorForAttendeeAtIndex: function() { return 'color'; }
      };

      module(function ($provide) {
        $provide.value('currentConferenceState', currentConferenceState);
        $provide.value('centerAndFit', centerAndFit);
        $provide.value('attendeeColorsService', attendeeColorsService);
      });

      inject(function($injector) {
        drawAvatarIfVideoMuted = $injector.get('drawAvatarIfVideoMuted');
      });
    });

    it('should do nothing if the attendee cannot be found', function() {
      currentConferenceState.getAttendeeByVideoId = function() { return null; };
      currentConferenceState.getAvatarImageByIndex = function() { throw new Error('This test should not call currentConferenceState.getAvatarImageByIndex'); };

      drawAvatarIfVideoMuted('videoId', null, null, null, function() {
        throw new Error('This test should not call the otherwise function');
      });
    });

    it('should call the otherwise function if attendee is not video muted', function(done) {
      currentConferenceState.getAttendeeByVideoId = function() { return { muteVideo: false }; };
      currentConferenceState.getAvatarImageByIndex = function() { done(new Error('This test should not call currentConferenceState.getAvatarImageByIndex')); };

      drawAvatarIfVideoMuted('videoId', null, null, null, function() {
        done();
      });
    });

    it('should do nothing if the attendee avatar cannot be loaded', function() {
      currentConferenceState.getAttendeeByVideoId = function() { return { muteVideo: true }; };
      currentConferenceState.getAvatarImageByIndex = function(index, callback) { callback(new Error('WTF')); };

      drawAvatarIfVideoMuted('videoId', {
        clearRect: function() {
          throw new Error('This test should not call context.clearRect');
        }
      }, null, null, function() {
        throw new Error('This test should not call the otherwise function');
      });
    });

    it('should draw the avatar, centered and fitted', function() {
      var context = {
        called: [],
        fillStyle: '',
        clearRect: function(x, y, width, height) {
          expect(x).to.equal(0);
          expect(y).to.equal(0);
          expect(width).to.equal(400);
          expect(height).to.equal(400);

          this.called.push('clearRect');
        },
        fillRect: function(x, y, width, height) {
          expect(x).to.equal(100);
          expect(y).to.equal(100);
          expect(width).to.equal(200);
          expect(height).to.equal(200);

          this.called.push('fillRect');
        },
        drawImage: function(image, x, y, width, height) {
          expect(x).to.equal(100);
          expect(y).to.equal(100);
          expect(width).to.equal(200);
          expect(height).to.equal(200);

          this.called.push('drawImage');
        }
      };

      currentConferenceState.getAttendeeByVideoId = function() { return { muteVideo: true }; };
      currentConferenceState.getAvatarImageByIndex = function(index, callback) { callback(null, { width: 200 }); };
      centerAndFitMock = {
        x: 100,
        y: 100,
        size: 200
      };

      drawAvatarIfVideoMuted('videoId', context, 400, 400, function() {
        throw new Error('This test should not call the otherwise function');
      });

      expect(context.fillStyle).to.equal('color');
      expect(context.called).to.deep.equal(['clearRect', 'fillRect', 'drawImage']);
    });

  });

  describe('The centerAndFit function', function() {

    var centerAndFit;

    beforeEach(function () {
      inject(function($injector) {
        centerAndFit = $injector.get('centerAndFit');
      });
    });

    it('should not scale the child up when parent is larger', function() {
      expect(centerAndFit(1000, 1000, 200).size).to.equal(200);
    });

    it('should center the child when the parent is larger', function() {
      expect(centerAndFit(1000, 1000, 200)).to.deep.equal({
        x: 400,
        y: 400,
        size: 200
      });
    });

    it('should scale the child down when the parent is smaller', function() {
      expect(centerAndFit(100, 100, 200)).to.deep.equal({
        x: 0,
        y: 0,
        size: 100
      });
    });

    it('should consider the width of the parent to scale the child down when the parent is portrait', function() {
      expect(centerAndFit(100, 500, 200)).to.deep.equal({
        x: 0,
        y: 200,
        size: 100
      });
    });

    it('should consider the height of the parent to scale the child down when the parent is landscape', function() {
      expect(centerAndFit(500, 150, 300)).to.deep.equal({
        x: 175,
        y: 0,
        size: 150
      });
    });

    it('should use the whole parent when child has the same size', function() {
      expect(centerAndFit(200, 200, 200)).to.deep.equal({
        x: 0,
        y: 0,
        size: 200
      });
    });

  });

});
