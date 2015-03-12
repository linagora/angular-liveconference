'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The live-conference Angular module', function() {
  beforeEach(angular.mock.module('op.live-conference'));

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
            useThisSocketConnection: function() {}
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
            }
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
            }
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
            }
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

      service.connect({ _id: 123 }, {}, []);
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
            }
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

      service.connect({ _id: 123 }, {}, []);
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
            }
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

      service.connect({ _id: 123 }, {}, []);
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
