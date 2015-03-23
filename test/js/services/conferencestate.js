'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The ConferenceState module', function() {
  beforeEach(angular.mock.module('op.live-conference'));

  describe('ConferenceState service', function() {
    var ConferenceState, conference, conferenceState, $rootScopeExpect, apply;

    beforeEach(function() {
      apply = false;
      var $rootScope = {
        $broadcast: function(event, attendee) {
          $rootScopeExpect(event, attendee);
        },
        $applyAsync: function() {
          apply = true;
        }
      };
      module(function($provide) {
        $provide.value('$rootScope', $rootScope);
      });
      inject(function($injector) {
        ConferenceState = $injector.get('ConferenceState');
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
    });

    describe('getAttendeeByEasyrtcid method', function() {
      it('should return the correct attendee', function() {
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }, null];
        expect(conferenceState.getAttendeeByEasyrtcid('easyrtcid')).to.deep.equal({ easyrtcid: 'easyrtcid' });
        expect(conferenceState.getAttendeeByEasyrtcid('easyrtcid3')).to.be.null;
      });
    });

    describe('updateAttendee method', function() {
      it('should update the good attendee, $rootScope.$applyAsync() and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, attendee) {
          expect(event).to.equal('conferencestate:attendees:update');
          expect(attendee).to.deep.equal({
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName'
          });
          expect(conferenceState.attendees[0]).to.deep.equal({
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName'
          });
          expect(apply).to.be.true;
          done();
        };
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }];
        conferenceState.updateAttendee('easyrtcid', 'id', 'displayName');
      });
    });

    describe('pushAttendee method', function() {
      it('should push the good attendee and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, attendee) {
          expect(event).to.equal('conferencestate:attendees:push');
          expect(attendee).to.deep.equal({
            videoIds: 'video-thumb0',
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName'
          });
          expect(conferenceState.attendees[0]).to.deep.equal({
            videoIds: 'video-thumb0',
            easyrtcid: 'easyrtcid',
            id: 'id',
            displayName: 'displayName'
          });
          done();
        };
        conferenceState.attendees = [];
        conferenceState.pushAttendee(0, 'easyrtcid', 'id', 'displayName');
      });
    });

    describe('updateAttendee method', function() {
      it('should remove the good attendee and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, attendee) {
          expect(event).to.equal('conferencestate:attendees:remove');
          expect(attendee).to.deep.equal({ easyrtcid: 'easyrtcid2' });
          expect(conferenceState.attendees[1]).to.be.null;
          done();
        };
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid' }, { easyrtcid: 'easyrtcid2' }];
        conferenceState.removeAttendee(1);
      });
    });

    describe('updateLocalVideoId method', function() {
      it('should update local video id and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, videoid) {
          expect(event).to.equal('conferencestate:localVideoId:update');
          expect(videoid).to.deep.equal('newlocalvideo');
          expect(conferenceState.localVideoId).to.deep.equal('newlocalvideo');
          done();
        };
        conferenceState.updateLocalVideoId('newlocalvideo');
      });
    });

    describe('updateLocalVideoIdToIndex method', function() {
      it('should update local video id by index and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, videoid) {
          expect(event).to.equal('conferencestate:localVideoId:update');
          expect(videoid).to.deep.equal('video-thumb2');
          expect(conferenceState.localVideoId).to.deep.equal('video-thumb2');
          done();
        };
        conferenceState.updateLocalVideoIdToIndex(2);
      });
    });

    describe('updateSpeaking method', function() {
      it('should do nothing if the attendee is not found', function() {
        $rootScopeExpect = function() {
          throw new Error('should not be here');
        };
        conferenceState.attendees.push({
          easyrtcid: 'easyrtcid',
          id: 'id',
          displayName: 'displayName'
        });
        conferenceState.updateSpeaking('easyrtcid2', true);
      });

      it('should update speaking,  $rootScope.$applyAsync and $rootScope.$broadcast', function(done) {
        $rootScopeExpect = function(event, data) {
          expect(event).to.equal('conferencestate:speaking');
          expect(data).to.deep.equal({id: 'easyrtcid2', speaking: true});
          expect(conferenceState.attendees[1].speaking).to.be.true;
          done();
        };
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
      })
    });

    describe('updateMuteFromEasyrtcid method', function() {
      it('should update mute property of attendee and $rootScope.$broadcast', function() {
        conferenceState.attendees = [{ easyrtcid: 'easyrtcid', videoIds: 'videoId'}];
        conferenceState.updateMuteFromEasyrtcid('easyrtcid', true);
        expect(conferenceState.attendees).to.deep.equal([{ easyrtcid: 'easyrtcid', videoIds: 'videoId', mute: true}]);
      });
    });

    describe('updateMuteFromIndex method', function() {
      it('should update mute property of attendee', function() {
        conferenceState.attendees = [{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoIds: 'videoId'}];
        conferenceState.updateMuteFromIndex(1, true);
        expect(conferenceState.attendees).to.deep.equal([{easyrtcid: 'user1'}, { easyrtcid: 'easyrtcid', videoIds: 'videoId', mute: true}]);
      });
    });
  });

  describe('easyRTCService service', function() {
    var service, $q, $rootScope, $log, tokenAPI, session, webrtcFactory;

    beforeEach(function() {
      tokenAPI = {};
      $log = {
        debug: function() {}
      };
      session = {
        getUsername: function() {
          return 'Wooot';
        },
        getUserId: function() {
          return 2;
        },
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
          return {
            setRoomOccupantListener: function() {},
            setRoomEntryListener: function() {},
            setDisconnectListener: function() {},
            joinRoom: function() {},
            easyApp: function() {},
            hangupAll: function() {},
            setOnCall: function() {},
            setOnHangup: function() {},
            useThisSocketConnection: function() {},
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };
        }
      };

      var ioSocketConnection = {
        isConnected: function() {
          return true;
        },
        getSio: function() {
          return this.sio;
        },
        addConnectCallback: function(callback) {
          this.connectCallback = callback;
        },
        addDisconnectCallback: function() {}
      };
      this.ioSocketConnection = ioSocketConnection;

      var ioConnectionManager = {
      };
      this.ioConnectionManager = ioConnectionManager;

      module(function($provide) {
        $provide.value('$log', $log);
        $provide.value('tokenAPI', tokenAPI);
        $provide.value('session', session);
        $provide.value('webrtcFactory', webrtcFactory);
        $provide.value('ioSocketConnection', ioSocketConnection);
        $provide.value('ioConnectionManager', ioConnectionManager);
      });
    });

    it('$scope.performCall should hangupAll', function(done) {
      webrtcFactory = {
        get: function() {
          return {
            hangupAll: function() {
              done();
            },
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };
        }
      };

      module(function($provide) {
        $provide.value('webrtcFactory', webrtcFactory);
      });

      inject(function($injector) {
        service = $injector.get('easyRTCService');
      });

      service.performCall('YOLO');
    });

    it('$scope.performCall should call the given user id', function(done) {
      var user_id = 123;

      webrtcFactory = {
        get: function() {
          return {
            hangupAll: function() {},
            call: function(id) {
              expect(id).to.equal(user_id);
              done();
            },
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };

        }
      };

      module(function($provide) {
        $provide.value('webrtcFactory', webrtcFactory);
      });

      inject(function($injector) {
        service = $injector.get('easyRTCService');
      });

      service.performCall(user_id);
    });

    it('$scope.connect should create the easyRTC app when the socketIO connection becomes available', function(done) {
      this.ioSocketConnection.sio = {};
      this.ioSocketConnection.isConnected = function() {
        return false;
      };

      webrtcFactory = {
        get: function() {
          return {
            setRoomOccupantListener: function() {},
            setRoomEntryListener: function() {},
            setDisconnectListener: function() {},
            joinRoom: function() {},
            useThisSocketConnection: function() {},
            easyApp: function() {
              done();
            },
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };
        }
      };

      module(function($provide) {
        $provide.value('webrtcFactory', webrtcFactory);
      });

      inject(function($injector, _$q_, _$rootScope_) {
        service = $injector.get('easyRTCService');
        $q = _$q_;
        $rootScope = _$rootScope_;
      });

      var conferenceState = {
        conference: {
          conference: { _id: 123 }
        },
        pushAttendee: function() {},
        removeAttendee: function() {}
      };
      service.connect(conferenceState);
      expect(this.ioSocketConnection.connectCallback).to.be.a('function');
      this.ioSocketConnection.connectCallback();
    });

    it('$scope.connect should give the socketIO instance to easyrtc', function(done) {
      var self = this;
      this.ioSocketConnection.isConnected = function() {
        return true;
      };
      this.ioSocketConnection.sio = {websocket: true};

      webrtcFactory = {
        get: function() {
          return {
            setRoomOccupantListener: function() {},
            setRoomEntryListener: function() {},
            setDisconnectListener: function() {},
            joinRoom: function() {},
            useThisSocketConnection: function(sio) {
              expect(sio).to.deep.equal(self.ioSocketConnection.sio);
              done();
            },
            easyApp: function() {
            },
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };
        }
      };

      module(function($provide) {
        $provide.value('webrtcFactory', webrtcFactory);
      });

      inject(function($injector, _$q_, _$rootScope_) {
        service = $injector.get('easyRTCService');
        $q = _$q_;
        $rootScope = _$rootScope_;
      });

      var conferenceState = {
        conference: {
          conference: { _id: 123 }
        },
        pushAttendee: function() {},
        removeAttendee: function() {}
      };
      service.connect(conferenceState);
    });

    it('$scope.connect should create the easyRTC app if the socketIO connection is available', function(done) {
      var self = this;
      this.ioSocketConnection.sio = {};
      this.ioSocketConnection.isConnected = function() {
        self.ioSocketConnection.addConnectCallback = function(cb) {
          return done(new Error('I should not be called ' + cb));
        };
        return true;
      };

      webrtcFactory = {
        get: function() {
          return {
            setRoomOccupantListener: function() {},
            setRoomEntryListener: function() {},
            setDisconnectListener: function() {},
            joinRoom: function() {},
            useThisSocketConnection: function() {},
            easyApp: function() {
              done();
            },
            enableDataChannels: function() {},
            setPeerListener: function() {}
          };
        }
      };

      module(function($provide) {
        $provide.value('webrtcFactory', webrtcFactory);
      });

      inject(function($injector, _$q_, _$rootScope_) {
        service = $injector.get('easyRTCService');
        $q = _$q_;
        $rootScope = _$rootScope_;
      });

      var conferenceState = {
        conference: {
          conference: { _id: 123 }
        },
        pushAttendee: function() {},
        removeAttendee: function() {}
      };
      service.connect(conferenceState);
      expect(this.ioSocketConnection.connectCallback).to.be.a('function');
      this.ioSocketConnection.connectCallback();
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
