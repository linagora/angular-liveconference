'use strict';

/* global chai: false */

var expect = chai.expect;

describe('easyRTCService service', function() {
  var service, tokenAPI, session, webrtcFactory, easyrtc, currentConferenceState, disconnectCallback;

  beforeEach(angular.mock.module('op.live-conference'));

  beforeEach(function() {
    currentConferenceState = {};
    easyrtc = {
      setGotMedia: function() {},
      setDataChannelCloseListener: function() {},
      setCallCancelled: function() {},
      setOnStreamClosed: function() {},
      getVideoSourceList: function() {},
      enableDataChannels: function() {},
      setDisconnectListener: function(callback) { disconnectCallback = callback; },
      myEasyrtcid: 'myself'
    };
    tokenAPI = {};
    session = {
      getUsername: function() { return 'Wooot'; },
      getUserId: function() { return 2; },
      user: {
        _id: 2,
        emails: ['test@openpaas.io']
      },
      domain: {
        _id: 123
      }
    };
    webrtcFactory = {
      get: function() {
        return easyrtc;
      }
    };

    module(function($provide) {
      $provide.value('tokenAPI', {});
      $provide.value('session', session);
      $provide.value('webrtcFactory', webrtcFactory);
      $provide.value('ioSocketConnection', {});
      $provide.value('ioConnectionManager', {});
      $provide.value('currentConferenceState', currentConferenceState);
    });

    inject(function($injector) {
      service = $injector.get('easyRTCService');
    });
  });

  describe('broadcastData function', function() {

    it('should do nothing if easyrtc.getRoomOccupantsAsArray fails to return the occupants', function() {
      easyrtc.getRoomOccupantsAsArray = function() { return null; };
      easyrtc.sendData = function() { throw new Error('This test should not call easyrtc.sendData'); };

      service.broadcastData('', {});
    });

    it('should call easyrtc.sendData on each occupant except myself', function() {
      var calledIds = [];

      easyrtc.getRoomOccupantsAsArray = function() { return ['myself', 'other1', 'other2']; };
      easyrtc.sendData = function(easyrtcid, event, data) {
        expect(event).to.equal('message');
        expect(data).to.deep.equal({ da: 'ta' });

        calledIds.push(easyrtcid);
      };

      service.broadcastData('message', { da: 'ta' });

      expect(calledIds).to.deep.equal(['other1', 'other2']);
    });

  });

  describe('broadcastMe function', function() {

    it('should call broadcastData with a prepared attendee', function() {
      currentConferenceState.getAttendeeByEasyrtcid = function() {
        return {
          index: 0,
          videoId: 'videoId',
          id: 'id',
          easyrtcid: 'easyrtcid',
          displayName: 'displayName',
          avatar: 'avatar',
          mute: true,
          muteVideo: false,
          speaking: false,
          foo: 'bar'
        };
      };
      easyrtc.getRoomOccupantsAsArray = function() { return ['myself', 'other1', 'other2']; };
      easyrtc.sendData = function(easyrtcid, event, data) {
        expect(data).to.deep.equal({
          id: 'id',
          easyrtcid: 'easyrtcid',
          displayName: 'displayName',
          avatar: 'avatar',
          mute: true,
          muteVideo: false,
          speaking: false
        });
      };

      service.broadcastMe();
    });

    it('should do nothing if attendee cannot be found', function() {
      currentConferenceState.getAttendeeByEasyrtcid = function() { return null; };
      easyrtc.getRoomOccupantsAsArray = function() {
        throw new Error('This test should not call easyrtc.getRoomOccupantsAsArray.');
      };

      service.broadcastMe();
    });

  });

  describe('addDisconnectCallback function', function() {

    it('should return false if no callback is given', function() {
      expect(service.addDisconnectCallback()).to.be.false;
    });

    it('should register a new disconnect callback', function(done) {
      service.addDisconnectCallback(done);

      disconnectCallback();
    });

    it('should return an identifier for the registered callback', function() {
      expect(service.addDisconnectCallback(function() {})).to.exist;
    });

  });

  describe('removeDisconnectCallback function', function() {

    it('should return false if no id is given', function() {
      expect(service.removeDisconnectCallback()).to.be.false;
    });

    it('should remove an existing disconnect callback', function() {
      var id = service.addDisconnectCallback(function() {
        throw new Error('This test should not call any disconnect callback !');
      });

      service.removeDisconnectCallback(id);
      disconnectCallback();
    });

  });

  describe('setGotMedia function', function() {

    it('should proxy to easyrtc.setGotMedia()', function(done) {

      var callback = function() {
      };

      easyrtc.setGotMedia = function(arg) {
        expect(arg).to.equal(callback);
        done();
      };
      service.setGotMedia(callback);
    });
  });

});
