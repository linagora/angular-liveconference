'use strict';

/* global chai: false */

var expect = chai.expect;

describe('easyRTCService service', function () {
  var service, $log, tokenAPI, session, webrtcFactory, easyrtc;

  beforeEach(angular.mock.module('op.live-conference'));

  beforeEach(function () {
    easyrtc = {
      enableDataChannels: function() {},
      myEasyrtcid: 'myself'
    };
    tokenAPI = {};
    $log = { debug: function () {} };
    session = {
      getUsername: function () { return 'Wooot'; },
      getUserId: function () { return 2; },
      user: {
        _id: 2,
        emails: ['test@openpaas.io']
      },
      domain: {
        _id: 123
      }
    };
    webrtcFactory = {
      get: function () {
        return easyrtc;
      }
    };

    module(function ($provide) {
      $provide.value('$log', $log);
      $provide.value('tokenAPI', {});
      $provide.value('session', session);
      $provide.value('webrtcFactory', webrtcFactory);
      $provide.value('ioSocketConnection', {});
      $provide.value('ioConnectionManager', {});
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

});
