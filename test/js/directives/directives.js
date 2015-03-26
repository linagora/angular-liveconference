'use strict';

/* global chai: false */

var expect = chai.expect;

describe('Directives', function() {

  beforeEach(function() {
    window.URI = function() {};

    module('op.live-conference');
    module('op.liveconference-templates');
  });

  describe('conferenceUserVideo', function() {

    var element, scope, conferenceState, $modal, matchmedia, callback;

    beforeEach(module(function($provide) {
      conferenceState = {};
      $modal = function() {
        return {
          $promise: {
            then: function() {
              callback();
            }
          }
        };
      };
      matchmedia = {
        isDesktop: function() {}
      };
      $provide.value('currentConferenceState', conferenceState);
      $provide.value('$modal', $modal);
      $provide.value('matchmedia', matchmedia);
      $provide.constant('LOCAL_VIDEO_ID', 'video0');
    }));

    beforeEach(inject(function($compile, $rootScope) {
      scope = $rootScope.$new();
      element = $compile('<conference-user-video/>')(scope);
      $rootScope.$digest();
    }));

    it('should not show modal if currentConferenceState.localVideoId === LOCAL_VIDEO_ID', function() {
      callback = function() {
        throw new Error('should not be here');
      };
      conferenceState.localVideoId = 'video0';
      scope.$digest();
      scope.onMobileToggleControls();
    });

    it('should show modal if currentConferenceState.localVideoId !== LOCAL_VIDEO_ID', function(done) {
      callback = done;
      conferenceState.localVideoId = 'video1';
      scope.$digest();
      scope.onMobileToggleControls();
    });

    describe('The showReportPopup fn', function() {
      window.$ = function() {return [{}];};

      it('should hide modal when called', function(done) {
        callback = done();
        scope.$emit('localVideoId:ready', 1);
        scope.$digest();
        scope.showReportPopup();
      });

      it('should call scope.showReport when attendee is found', function(done) {
        var attendee = {id: 1};
        var localVideoId = 'video1';

        scope.showReport = function(attendee) {
          expect(attendee).to.deep.equal(attendee);
          done();
        };
        callback = function() {};
        conferenceState.getAttendeeByVideoId = function() {
          return attendee;
        };

        scope.$emit('localVideoId:ready', localVideoId);
        scope.$digest();
        scope.showReportPopup();
      });

      it('should not call scope.showReport when attendee is not found', function(done) {
        var localVideoId = 'video1';

        scope.showReport = function() {
          done(new Error());
        };
        callback = function() {};
        conferenceState.getAttendeeByVideoId = function() {
        };

        scope.$emit('localVideoId:ready', localVideoId);
        scope.$digest();
        scope.showReportPopup();
        done();
      });
    });
  });

});
