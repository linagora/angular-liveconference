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

  describe('sendData function', function() {

    it('should forward the call to easyrtc.sendData', function(done) {
      var testId = 'anId';
      var testMsgType = 'aType';
      var testData = {
        toto: 'titi',
        tata: {}
      };
      var testHandler = function() {};

      easyrtc.sendData = function(easyrtcid, msgType, data, ackhandler) {
        expect(easyrtcid).to.equal(testId);
        expect(msgType).to.equal(testMsgType);
        expect(data).to.equal(JSON.stringify(testData));
        expect(ackhandler).to.deep.equal(testHandler);
        done();
      };

      service.sendData(testId, testMsgType, testData, testHandler);
    });
  });

});

describe('listenerFactory factory', function() {
  var service, DummyCallbackConstructor, dummyCallback, CountCall, listen, emptyFunction;

  DummyCallbackConstructor = function() {
    var callback;
    return {
      setCallback: function(cb) {
        callback = cb;
      },
      callCallback: function() {
        console.log(callback);
        callback();
      }
    };
  };
  CountCall = function() {
    var count = 0;
    return {
      call: function() {
        count++;
      },
      called: function() {
        return count;
      }
    };
  };

  beforeEach(angular.mock.module('op.live-conference'));

  beforeEach(function() {
    inject(function($injector) {
      service = $injector.get('listenerFactory');
    });

    dummyCallback = new DummyCallbackConstructor();
    listen = service(dummyCallback.setCallback);
    emptyFunction = function() { };
  });

  it('should return an object', function(done) {
    expect(listen.addListener).to.be.a('function');
    expect(listen.removeListener).to.be.a('function');
    done();
  });

  describe('addListener function', function() {

    it('should return the last added function', function(done) {
      expect(listen.addListener(emptyFunction)).to.equal(emptyFunction);
      done();
    });

  });

  it('should call each callback once', function(done) {

    var callOnce = new CountCall(), callTwice = new CountCall();

    listen.addListener(callOnce.call);
    listen.addListener(callTwice.call);
    listen.addListener(callTwice.call);

    dummyCallback.callCallback();

    expect(callOnce.called()).to.equal(1);
    expect(callTwice.called()).to.equal(2);
    done();
  });

  it('should be able to remove callbacks', function(done) {
    var callOnce = new CountCall(),
      noCall = new CountCall();

    listen.addListener(noCall.call);
    listen.addListener(noCall.call);
    listen.addListener(noCall.call);

    listen.addListener(callOnce.call);
    listen.removeListener(noCall.call);

    dummyCallback.callCallback();

    expect(callOnce.called()).to.equal(1);
    expect(noCall.called()).to.equal(0);
    done();
  });
});
