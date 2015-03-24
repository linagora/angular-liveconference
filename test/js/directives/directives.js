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

  });

});
