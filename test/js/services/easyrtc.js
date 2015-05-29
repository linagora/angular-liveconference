'use strict';

/* global chai: false */

var expect = chai.expect;
var CountCall = function() {
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


var DummyCallbackConstructor = function() {
  var callback;
  return {
    setCallback: function(cb) {
      callback = cb;
    },
    callCallback: function() {
      callback.apply(this, arguments);
    }
  };
};

describe('easyRTCService service', function() {
  var service, tokenAPI, session, webrtcFactory, easyrtc, currentConferenceState, disconnectCallback, $rootScope, $scope;

  beforeEach(angular.mock.module('op.live-conference'));

  beforeEach(function() {
    var dummyDataOpenListener = new DummyCallbackConstructor(),
      dummyDataCloseListener = new DummyCallbackConstructor(),
      dummyPeerListener = new DummyCallbackConstructor();
    currentConferenceState = {};

    easyrtc = {
      setGotMedia: function() {},
      setDataChannelOpenListener: dummyDataOpenListener.setCallback,
      setDataChannelCloseListener: dummyDataCloseListener.setCallback,
      setPeerListener: dummyPeerListener.setCallback,
      setRoomOccupantListener: function() {},
      setRoomEntryListener: function() {},
      addDataChannelOpenListener: function() {},
      addDataChannelCloseListener: function() {},
      setCallCancelled: function() {},
      setOnStreamClosed: function() {},
      getVideoSourceList: function() {},
      enableDataChannels: function() {},
      useThisSocketConnection: function() {},
      setOnError: function() {},
      setVideoDims: function() {},
      setOnCall: function() {},
      setOnHangup: function() {},
      setDisconnectListener: function(callback) { disconnectCallback = callback; },
      myEasyrtcid: 'myself',
      extra: {
        callDataChannelOpenListener: dummyDataOpenListener.callCallback,
        callDataChannelCloseListener: dummyDataCloseListener.callCallback,
        callPeerListener: dummyPeerListener.callCallback
      }
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
      $provide.value('ioSocketConnection', {
        isConnected: function() { return true; },
        addConnectCallback: function() {},
        getSio: function() { return {}; }
      });
      $provide.value('ioConnectionManager', {});
      $provide.value('currentConferenceState', currentConferenceState);
    });

    inject(function($injector, _$rootScope_) {
      service = $injector.get('easyRTCService');
      $rootScope = _$rootScope_;
      $scope = $rootScope.$new();
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

  [
    {
      name: 'DataChannelOpen listener',
      remove: 'removeDataChannelOpenListener',
      add: 'addDataChannelOpenListener',
      call: 'callDataChannelOpenListener'
    },
    {
      name: 'DataChannelClose listener',
      add: 'addDataChannelCloseListener',
      remove: 'removeDataChannelCloseListener',
      call: 'callDataChannelCloseListener'
    },
    {
      name: 'peer listener',
      add: 'addPeerListener',
      remove: 'removePeerListener',
      call: 'callPeerListener'
      }
  ].forEach(function(listener) {
      describe('add/remove ' + listener.name + ' functions', function() {
        it('should call the function on each event', function(done) {
          var callMe = new CountCall(), callMeToo = new CountCall();
          service[listener.add](callMe.call);
          service[listener.add](callMeToo.call);

          expect(callMe.called()).to.equal(0);
          expect(callMeToo.called()).to.equal(0);

          easyrtc.extra[listener.call]();
          expect(callMe.called()).to.equal(1);
          expect(callMeToo.called()).to.equal(1);

          easyrtc.extra[listener.call]();
          expect(callMe.called()).to.equal(2);

            done();
        });

        it('should remove listener', function(done) {
          var callMe = new CountCall(), removeMe;
          removeMe = service[listener.add](callMe.call);
          expect(callMe.called()).to.equal(0);

          easyrtc.extra[listener.call]();
          expect(callMe.called()).to.equal(1);

          service[listener.remove](removeMe);
          easyrtc.extra[listener.call]();
          expect(callMe.called()).to.equal(1);

            done();
        });
      });
    });

  describe('addPeerListener', function() {

    it('should only accept one type of message', function(done) {
      var callMe = new CountCall(), goodMsgType = 'foo',
        badMsgType = 'bar';
      service.addPeerListener(callMe.call, goodMsgType);
      easyrtc.extra.callPeerListener('someRtcId', goodMsgType,
        'some data', 'someRtcId as target');
      easyrtc.extra.callPeerListener('someRtcId', badMsgType,
        'some data', 'someRtcId as target');
      expect(callMe.called()).to.equal(1);
      done();
    });

  });

  describe('connection promise', function() {
    var callMe, dontCallMe;

    beforeEach(function() {
      callMe = new CountCall();
      dontCallMe = new CountCall();
      currentConferenceState = {
          conference: {
            _id: null
          },
        pushAttendee: function() {},
        updateMuteVideoFromIndex: function() {}
      };
      easyrtc.roomJoin = [];
      easyrtc.joinRoom = function() {};
    });

    it('should do nothing if no connection starts', function(done) {
      service.connection().then(callMe.call, dontCallMe.call);

      expect(callMe.called()).to.equal(0);
      expect(dontCallMe.called()).to.equal(0);

      done();
      });

    it('should fullfill a lately defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connect(currentConferenceState);
      service.connection().then(function() { done(); },
        function() { });

      $scope.$apply();
    });

    it('should fullfill a previous promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connection().then(function() { done();},
        function() {});
      service.connect(currentConferenceState);

      $scope.$apply();
    });

    it('should fail a lately defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginFailure('Some error');
      };

      service.connect(currentConferenceState);
      service.connection().then(function() { },
        function() { done(); });

      $scope.$apply();
    });

    it('should fail a previously defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginFailure('Some error');
      };

      service.connection().then(function() { },
        function() { done(); });
      service.connect(currentConferenceState);

      $scope.$apply();
    });

    it('should accept multiple callbacks', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connection().then(callMe.call, dontCallMe.call);
      service.connect(currentConferenceState);
      service.connection().then(callMe.call, dontCallMe.call);


      $scope.$apply();


      expect(callMe.called()).to.equal(2);
      expect(dontCallMe.called()).to.equal(0);

      done();

    });
  });

  describe('getOpenedDataChannels function', function() {

    it('should list all opened data channels', function(done) {
      var peerList = ['myself', 'other1', 'other2', 'other3'];
      easyrtc.getRoomOccupantsAsArray = function() { return peerList; };
      easyrtc.doesDataChannelWork = function(peer) {
        if (peerList.indexOf(peer) < 2) {
          return true;
        } else {
          return false;
        }
      };

      var channels = service.getOpenedDataChannels();
      expect(channels.length).to.equal(2);
      done();
    });

  });
});

describe('listenerFactory factory', function() {
  var service, dummyCallback, listen, emptyFunction;

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
      callTwice = new CountCall();

    listen.addListener(callTwice.call);
    listen.addListener(callTwice.call);
    listen.addListener(callTwice.call);

    listen.addListener(callOnce.call);
    listen.removeListener(callTwice.call);

    dummyCallback.callCallback();

    expect(callOnce.called()).to.equal(1);
    expect(callTwice.called()).to.equal(2);
    done();
  });
});
