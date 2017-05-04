(function(e){if("function"==typeof bootstrap)bootstrap("hark",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeHark=e}else"undefined"!=typeof window?window.hark=e():global.hark=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
var WildEmitter = require('wildemitter');

function getMaxVolume (analyser, fftBins) {
  var maxVolume = -Infinity;
  analyser.getFloatFrequencyData(fftBins);

  for(var i=4, ii=fftBins.length; i < ii; i++) {
    if (fftBins[i] > maxVolume && fftBins[i] < 0) {
      maxVolume = fftBins[i];
    }
  };

  return maxVolume;
}


var audioContextType = window.AudioContext || window.webkitAudioContext;
// use a single audio context due to hardware limits
var audioContext = null;
module.exports = function(stream, options) {
  var harker = new WildEmitter();


  // make it not break in non-supported browsers
  if (!audioContextType) return harker;

  //Config
  var options = options || {},
      smoothing = (options.smoothing || 0.1),
      interval = (options.interval || 50),
      threshold = options.threshold,
      play = options.play,
      history = options.history || 10,
      running = true;

  //Setup Audio Context
  if (!audioContext) {
    audioContext = new audioContextType();
  }
  var sourceNode, fftBins, analyser;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = smoothing;
  fftBins = new Float32Array(analyser.fftSize);

  if (stream.jquery) stream = stream[0];
  if (stream instanceof HTMLAudioElement || stream instanceof HTMLVideoElement) {
    //Audio Tag
    sourceNode = audioContext.createMediaElementSource(stream);
    if (typeof play === 'undefined') play = true;
    threshold = threshold || -50;
  } else {
    //WebRTC Stream
    sourceNode = audioContext.createMediaStreamSource(stream);
    threshold = threshold || -50;
  }

  sourceNode.connect(analyser);
  if (play) analyser.connect(audioContext.destination);

  harker.speaking = false;

  harker.setThreshold = function(t) {
    threshold = t;
  };

  harker.setInterval = function(i) {
    interval = i;
  };

  harker.stop = function() {
    running = false;
    harker.emit('volume_change', -100, threshold);
    if (harker.speaking) {
      harker.speaking = false;
      harker.emit('stopped_speaking');
    }
    analyser.disconnect();
    sourceNode.disconnect();
  };
  harker.speakingHistory = [];
  for (var i = 0; i < history; i++) {
      harker.speakingHistory.push(0);
  }

  // Poll the analyser node to determine if speaking
  // and emit events if changed
  var looper = function() {
    setTimeout(function() {

      //check if stop has been called
      if(!running) {
        return;
      }

      var currentVolume = getMaxVolume(analyser, fftBins);

      harker.emit('volume_change', currentVolume, threshold);

      var history = 0;
      if (currentVolume > threshold && !harker.speaking) {
        // trigger quickly, short history
        for (var i = harker.speakingHistory.length - 3; i < harker.speakingHistory.length; i++) {
          history += harker.speakingHistory[i];
        }
        if (history >= 2) {
          harker.speaking = true;
          harker.emit('speaking');
        }
      } else if (currentVolume < threshold && harker.speaking) {
        for (var i = 0; i < harker.speakingHistory.length; i++) {
          history += harker.speakingHistory[i];
        }
        if (history == 0) {
          harker.speaking = false;
          harker.emit('stopped_speaking');
        }
      }
      harker.speakingHistory.shift();
      harker.speakingHistory.push(0 + (currentVolume > threshold));

      looper();
    }, interval);
  };
  looper();


  return harker;
}

},{"wildemitter":2}],2:[function(require,module,exports){
/*
WildEmitter.js is a slim little event emitter by @henrikjoreteg largely based
on @visionmedia's Emitter from UI Kit.

Why? I wanted it standalone.

I also wanted support for wildcard emitters like this:

emitter.on('*', function (eventName, other, event, payloads) {

});

emitter.on('somenamespace*', function (eventName, payloads) {

});

Please note that callbacks triggered by wildcard registered events also get
the event name as the first argument.
*/

module.exports = WildEmitter;

function WildEmitter() { }

WildEmitter.mixin = function (constructor) {
    var prototype = constructor.prototype || constructor;

    prototype.isWildEmitter= true;

    // Listen on the given `event` with `fn`. Store a group name if present.
    prototype.on = function (event, groupName, fn) {
        this.callbacks = this.callbacks || {};
        var hasGroup = (arguments.length === 3),
            group = hasGroup ? arguments[1] : undefined,
            func = hasGroup ? arguments[2] : arguments[1];
        func._groupName = group;
        (this.callbacks[event] = this.callbacks[event] || []).push(func);
        return this;
    };

    // Adds an `event` listener that will be invoked a single
    // time then automatically removed.
    prototype.once = function (event, groupName, fn) {
        var self = this,
            hasGroup = (arguments.length === 3),
            group = hasGroup ? arguments[1] : undefined,
            func = hasGroup ? arguments[2] : arguments[1];
        function on() {
            self.off(event, on);
            func.apply(this, arguments);
        }
        this.on(event, group, on);
        return this;
    };

    // Unbinds an entire group
    prototype.releaseGroup = function (groupName) {
        this.callbacks = this.callbacks || {};
        var item, i, len, handlers;
        for (item in this.callbacks) {
            handlers = this.callbacks[item];
            for (i = 0, len = handlers.length; i < len; i++) {
                if (handlers[i]._groupName === groupName) {
                    //console.log('removing');
                    // remove it and shorten the array we're looping through
                    handlers.splice(i, 1);
                    i--;
                    len--;
                }
            }
        }
        return this;
    };

    // Remove the given callback for `event` or all
    // registered callbacks.
    prototype.off = function (event, fn) {
        this.callbacks = this.callbacks || {};
        var callbacks = this.callbacks[event],
            i;

        if (!callbacks) return this;

        // remove all handlers
        if (arguments.length === 1) {
            delete this.callbacks[event];
            return this;
        }

        // remove specific handler
        i = callbacks.indexOf(fn);
        callbacks.splice(i, 1);
        if (callbacks.length === 0) {
            delete this.callbacks[event];
        }
        return this;
    };

    /// Emit `event` with the given args.
    // also calls any `*` handlers
    prototype.emit = function (event) {
        this.callbacks = this.callbacks || {};
        var args = [].slice.call(arguments, 1),
            callbacks = this.callbacks[event],
            specialCallbacks = this.getWildcardCallbacks(event),
            i,
            len,
            item,
            listeners;

        if (callbacks) {
            listeners = callbacks.slice();
            for (i = 0, len = listeners.length; i < len; ++i) {
                if (!listeners[i]) {
                    break;
                }
                listeners[i].apply(this, args);
            }
        }

        if (specialCallbacks) {
            len = specialCallbacks.length;
            listeners = specialCallbacks.slice();
            for (i = 0, len = listeners.length; i < len; ++i) {
                if (!listeners[i]) {
                    break;
                }
                listeners[i].apply(this, [event].concat(args));
            }
        }

        return this;
    };

    // Helper for for finding special wildcard event handlers that match the event
    prototype.getWildcardCallbacks = function (eventName) {
        this.callbacks = this.callbacks || {};
        var item,
            split,
            result = [];

        for (item in this.callbacks) {
            split = item.split('*');
            if (item === '*' || (split.length === 2 && eventName.slice(0, split[0].length) === split[0])) {
                result = result.concat(this.callbacks[item]);
            }
        }
        return result;
    };

};

WildEmitter.mixin(WildEmitter);

},{}]},{},[1])(1)
});
;'use strict';

angular.module('op.live-conference')
  .constant('easyRTCBitRates', {
    low: {
      audio: 20,
      video: 30
    },
    medium: {
      audio: 40,
      video: 60
    },
    nolimit: null
  })
  .constant('easyRTCDefaultBitRate', 'medium')
  .constant('EASYRTC_APPLICATION_NAME', 'LiveConference')
  .constant('MAX_ATTENDEES', 9)
  .constant('LOCAL_VIDEO_ID', 'video-thumb0')
  .constant('REMOTE_VIDEO_IDS', [
    'video-thumb1',
    'video-thumb2',
    'video-thumb3',
    'video-thumb4',
    'video-thumb5',
    'video-thumb6',
    'video-thumb7',
    'video-thumb8'
  ])
  .constant('AUTO_VIDEO_SWITCH_TIMEOUT', 700)
  .constant('EASYRTC_EVENTS', {
    attendeeUpdate: 'attendee:update'
  })
  .constant('DEFAULT_AVATAR_SIZE', 500)
  .constant('MAX_P2P_MESSAGE_LENGTH', 10000);
'use strict';

angular.module('op.live-conference')
  .directive('conferenceVideo', ['$timeout', '$window', '$rootScope', 'drawVideo', 'currentConferenceState', 'LOCAL_VIDEO_ID', 'DEFAULT_AVATAR_SIZE', '$state',
  function($timeout, $window, $rootScope, drawVideo, currentConferenceState, LOCAL_VIDEO_ID, DEFAULT_AVATAR_SIZE, $state) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/conference-video.jade',
      link: function(scope, element) {
        var canvas = {};
        var context = {};
        var mainVideo = {};
        var currentVideoId = LOCAL_VIDEO_ID;
        var stopAnimation = function() {};

        function garbage() {
          stopAnimation();
          canvas = {};
          context = {};
          mainVideo = {};
          stopAnimation = function() {};
        }

        function drawVideoInCanvas() {
          canvas[0].width = mainVideo[0].videoWidth || DEFAULT_AVATAR_SIZE;
          canvas[0].height = mainVideo[0].videoHeight || DEFAULT_AVATAR_SIZE;
          stopAnimation = drawVideo(context, mainVideo[0], canvas[0].width, canvas[0].height);

          $rootScope.$broadcast('localVideoId:ready', mainVideo[0].id);
        }

        $timeout(function() {
          canvas = element.find('canvas#mainVideoCanvas');
          context = canvas[0].getContext('2d');
          mainVideo = currentConferenceState.getVideoElementById(LOCAL_VIDEO_ID);
          if ($state.current.data.hasVideo) {
            drawVideoInCanvas();
          } else {
            mainVideo.on('loadedmetadata', function() {
              $state.current.data.hasVideo = true;
              if ($window.mozRequestAnimationFrame) {
                // see https://bugzilla.mozilla.org/show_bug.cgi?id=926753
                // Firefox needs this timeout.
                $timeout(function() {
                  drawVideoInCanvas();
                }, 500);
              } else {
                drawVideoInCanvas();
              }
            });}
        }, 1000);

        scope.conferenceState = currentConferenceState;
        scope.$on('conferencestate:localVideoId:update', function(event, newVideoId) {
          // Reject the first watch of the mainVideoId
          // when clicking on a new video, loadedmetadata event is not
          // fired.
          if (!mainVideo[0] || newVideoId === currentVideoId) {
            return;
          }
          currentVideoId = newVideoId;
          mainVideo = currentConferenceState.getVideoElementById(newVideoId);
          drawVideoInCanvas();
        });

        scope.streamToMainCanvas = function(index) {
          return scope.conferenceState.updateLocalVideoIdToIndex(index);
        };

        scope.$on('$destroy', garbage);

        $rootScope.$on('paneSize', function(event, paneSize) {
          if (paneSize.width !== undefined) {
            scope.paneStyle = {width: (100 - paneSize.width) + '%'};
          }
          if (paneSize.height !== undefined) {
            scope.paneStyle = {width: (100 - paneSize.height) + '%'};
          }

        });

        $rootScope.$on('attendeesBarSize', function(event, paneSize) {
          if (paneSize.width !== undefined) {
            scope.attendeesBarStyle = {width: (100 - paneSize.width) + '%'};
          }
          if (paneSize.height !== undefined) {
            scope.attendeesBarStyle = {width: (100 - paneSize.height) + '%'};
          }

          if (paneSize.marginRight !== undefined) {
            scope.attendeesBarContentStyle = {'margin-right': paneSize.marginRight};
          }

        });

        angular.element($window).on('orientationchange', drawVideoInCanvas);
      }
    };
  }])
  .directive('conferenceMobileVideo', ['$timeout', '$window', '$rootScope', 'drawVideo', 'currentConferenceState',
    function($timeout, $window, $rootScope, drawVideo, currentConferenceState) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'templates/mobile-video.jade',
        link: function(scope, element) {
          var mainVideo;
          var canvas, context;
          var stopAnimation = function() {};
          canvas = element[0];
          function garbage() {
            stopAnimation();
            canvas = {};
            context = {};
            mainVideo = {};
            stopAnimation = function() {};
          }

          function drawMobileVideo() {
            stopAnimation = drawVideo(context, mainVideo[0], canvas.width, canvas.height);
          }

          $timeout(function() {
            context = canvas.getContext('2d');
            mainVideo = currentConferenceState.getVideoElementById(currentConferenceState.localVideoId);
            $timeout(drawMobileVideo);
          }, 500);

          scope.$on('conferencestate:localVideoId:update', function(event, newVideoId) {
            if (!mainVideo[0]) {
              return;
            }
            mainVideo = currentConferenceState.getVideoElementById(newVideoId);
            $timeout(drawMobileVideo);
          });

          scope.$on('$destroy', garbage);
        }
      };
    }])

  .directive('conferenceAttendee', function() {
    return {
      restrict: 'E',
      templateUrl: 'templates/attendee.jade'
    };
  })

  .directive('conferenceAttendeeVideo', ['webRTCService', 'currentConferenceState', 'matchmedia', '$timeout', 'drawVideo', 'LOCAL_VIDEO_ID', function(webRTCService, currentConferenceState, matchmedia, $timeout, drawVideo, LOCAL_VIDEO_ID) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/attendee-video.jade',
      scope: {
        attendee: '=*',
        videoId: '@',
        onVideoClick: '=',
        videoIndex: '=',
        showReport: '='
      },
      link: function(scope) {

        scope.showReportPopup = function() {
          scope.showReport(scope.attendee);
        };

        scope.toggleAttendeeMute = function() {
          var mute = scope.attendee.localmute;
          webRTCService.muteRemoteMicrophone(scope.attendee.easyrtcid, !mute);
          currentConferenceState.updateLocalMuteFromEasyrtcid(scope.attendee.easyrtcid, !mute);
        };

        scope.isDesktop = matchmedia.isDesktop();

        scope.isMe = scope.videoId === LOCAL_VIDEO_ID;
      }
    };
  }])

  .directive('conferenceUserVideo', ['$modal', 'currentConferenceState', 'matchmedia', 'LOCAL_VIDEO_ID', function($modal, currentConferenceState, matchmedia, LOCAL_VIDEO_ID) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/user-video.jade',
      link: function(scope) {

        var modal = $modal({
          scope: scope,
          animation: 'am-fade-and-scale',
          placement: 'center',
          template: 'templates/mobile-user-video-quadrant-control.jade',
          container: 'div.user-video',
          backdrop: 'static',
          show: false
        });

        scope.onMobileToggleControls = function() {
          if (matchmedia.isDesktop()) {
            return;
          }
          if (currentConferenceState.localVideoId === LOCAL_VIDEO_ID) {
            return;
          }
          modal.$promise.then(modal.toggle);
        };

        var mainVideo = {};
        var videoElement = {};
        var watcher;

        scope.$on('localVideoId:ready', function(event, videoId) {
          if (watcher instanceof Function) {
            // we must unregister previous watcher
            // if it has been initialized first
            watcher();
          }
          mainVideo = currentConferenceState.getVideoElementById(videoId);
          videoElement = mainVideo[0];
          scope.muted = videoElement.muted;

          scope.mute = function() {
            videoElement.muted = !videoElement.muted;
            scope.onMobileToggleControls();
            var attendee = currentConferenceState.getAttendeeByVideoId(videoId);
            if (!attendee) {
              return;
            }
            attendee.mute = !attendee.mute;
          };

          scope.showReportPopup = function() {
            scope.onMobileToggleControls();
            var attendee = currentConferenceState.getAttendeeByVideoId(videoId);
            if (!attendee) {
              return;
            }
            scope.showReport(attendee);
          };

          scope.isMe = videoId === LOCAL_VIDEO_ID;

          watcher = scope.$watch(function() {
            return videoElement.muted;
          }, function() {
            scope.muted = videoElement.muted;
          });
        });
      }
    };
  }])

  .directive('conferenceUserControlBar', function($log, webRTCService) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/user-control-bar.jade',
      scope: {
        showInvitation: '=',
        onLeave: '=',
        conferenceState: '=',
        showEditor: '='
      },
      link: function($scope) {
        $scope.muted = false;
        $scope.videoMuted = false;

        $scope.noVideo = !webRTCService.isVideoEnabled();

        $scope.toggleSound = function() {
          webRTCService.enableMicrophone($scope.muted);

          $scope.muted = !$scope.muted;
          $scope.conferenceState.updateMuteFromIndex(0, $scope.muted);

          webRTCService.broadcastMe();
        };

        $scope.toggleCamera = function() {
          webRTCService.enableCamera($scope.videoMuted);
          webRTCService.enableVideo($scope.videoMuted);

          $scope.videoMuted = !$scope.videoMuted;
          $scope.conferenceState.updateMuteVideoFromIndex(0, $scope.videoMuted);

          webRTCService.broadcastMe();
        };

        $scope.showInvitationPanel = function() {
          $scope.showInvitation();
        };

        $scope.leaveConference = function() {
          $scope.onLeave();
        };
        $scope.toggleEditor = function() {
          $scope.showEditor();
        };
      }
    };
  })
  .directive('scaleToCanvas', ['$interval', '$window', 'cropDimensions', 'drawAvatarIfVideoMuted', 'drawHelper', 'currentConferenceState',
    function($interval, $window, cropDimensions, drawAvatarIfVideoMuted, drawHelper, currentConferenceState) {

    var requestAnimationFrame =
      $window.requestAnimationFrame ||
      $window.mozRequestAnimationFrame ||
      $window.msRequestAnimationFrame ||
      $window.webkitRequestAnimationFrame;

    function link(scope, element, attrs) {

      var widgets = [];
      var toggleAnim = false;
      var stopScaling = false;

      function videoToCanvas(widget) {
        var canvas = widget.canvas,
            ctx = widget.context,
            vid = widget.video,
            width = canvas.width,
            height = canvas.height,
            vHeight = vid.videoHeight,
            vWidth = vid.videoWidth;

        if (!height || !width) {
          return;
        }

        drawAvatarIfVideoMuted(vid.id, ctx, width, height, function() {
          var cropDims = cropDimensions(width, height, vWidth, vHeight);

          drawHelper.drawImage(ctx, vid, cropDims[0], cropDims[1], cropDims[2], cropDims[2], 0, 0, width, height);
        });
      }

      $interval(function cacheWidgets() {
        currentConferenceState.videoElements.forEach(function(vid) {
          var canvas = element.find('canvas[data-video-id=' + vid[0].id + ']').get(0);
          widgets.push({
            video: vid[0],
            canvas: canvas,
            context: canvas.getContext('2d')
          });
        });
      }, 100, 1, false);

      function onAnimationFrame() {
        if ((toggleAnim = !toggleAnim)) {
          widgets.forEach(videoToCanvas);
        }
        if (stopScaling) {
          return;
        }
        requestAnimationFrame(onAnimationFrame);
      }

      function garbage() {
        stopScaling = true;
        widgets = [];
      }

      scope.$on('$destroy', garbage);

      onAnimationFrame();
    }

    return {
      restrict: 'A',
      link: link
    };
  }])
  .directive('localSpeakEmitter', ['$rootScope', 'session', 'currentConferenceState', 'webRTCService', 'speechDetector', function($rootScope, session, currentConferenceState, webRTCService, speechDetector) {
    function link(scope) {
      function createLocalEmitter(stream) {
        var detector = speechDetector(stream);
        scope.$on('$destroy', function() {
          detector.stop();
          detector = null;
        });
        detector.on('speaking', function() {
          currentConferenceState.updateSpeaking(webRTCService.myEasyrtcid(), true);
          webRTCService.broadcastMe();
        });
        detector.on('stopped_speaking', function() {
          currentConferenceState.updateSpeaking(webRTCService.myEasyrtcid(), false);
          webRTCService.broadcastMe();
        });
      }

      var unreg = $rootScope.$on('localMediaStream', function(event, stream) {
        unreg();
        createLocalEmitter(stream);
      });
    }

    return {
      restrict: 'A',
      link: link
    };
  }])
  .directive('autoVideoSwitcher', ['$rootScope', 'AutoVideoSwitcher', 'currentConferenceState', function($rootScope, AutoVideoSwitcher, currentConferenceState) {
    return {
      restrict: 'A',
      link: function() {
        var unreg = $rootScope.$on('localMediaStream', function() {
          unreg();
          new AutoVideoSwitcher(currentConferenceState);
        });
      }
    };
  }])
  .directive('smartFit', ['$rootScope', function($rootScope) {
    return {
      restrict: 'A',
      replace: true,
      link: function(scope, element, attrs) {

        var unregisterRootScopeListener,
            source = angular.element(attrs.from),
            toPreserve = angular.element(attrs.preserve);

        function smartFit() {
          var canvas = element.find('canvas')[0];
          if (!canvas) {
            return;
          }
          var availWidth = source.width(),
            availHeight = source.height(),
            width = canvas.width,
            height = canvas.height,
            videoAspectRatio = width / height,
            containerAspectRatio = availWidth / availHeight;

          function fitWidth() {
            width = availWidth;
            height = Math.floor(width / videoAspectRatio);
          }

          function fitHeight() {
            height = availHeight;
            width = Math.floor(height * videoAspectRatio);
          }

          if (videoAspectRatio > containerAspectRatio) {
            fitWidth();
          } else {
            fitHeight();
          }

          element.css({
            height: height + 'px',
            width: width + 'px'
          });

          if (toPreserve.length) {
            element.css(
              'margin-top',
              Math.max(0, (toPreserve.position().top - height) / 2) + 'px'
            );
          }
        }

        source.resize(smartFit);
        unregisterRootScopeListener = $rootScope.$on('localVideoId:ready', smartFit);

        scope.$on('$destroy', function() {
          source.off('resize', smartFit);
          unregisterRootScopeListener();
        });
      }
    };
  }])
  .directive('userTime', ['attendeeColorsService', '$interval', 'currentConferenceState', 'LOCAL_VIDEO_ID', 'moment', function(attendeeColorsService, $interval, currentConferenceState, LOCAL_VIDEO_ID, moment) {
    function link(scope, element) {
      function formatRemoteTime() {

        var DEFAULT_COLOR = 'black';
        var attendee = currentConferenceState.getAttendeeByVideoId(currentConferenceState.localVideoId);
        if (attendee) {
          var color = attendeeColorsService.getColorForAttendeeAtIndex(attendee.index);
          scope.color = attendee.muteVideo ? color : DEFAULT_COLOR;
        }

        if (angular.isDefined(scope.timezoneOffsetDiff)) {
          scope.remoteHour = moment().add(scope.timezoneOffsetDiff, 'm').format('hh:mm a');
        } else {
          scope.remoteHour = null;
        }

      }

      function onVideoUpdate() {
        var localTimezoneOffset = currentConferenceState.getAttendeeByVideoId(LOCAL_VIDEO_ID).timezoneOffset;
        var remoteTimezoneOffset = currentConferenceState.getAttendeeByVideoId(currentConferenceState.localVideoId).timezoneOffset;
        if (angular.isDefined(localTimezoneOffset) &&
            angular.isDefined(remoteTimezoneOffset) &&
            localTimezoneOffset !== remoteTimezoneOffset) {
          scope.timezoneOffsetDiff = localTimezoneOffset - remoteTimezoneOffset;
        } else {
          scope.timezoneOffsetDiff = undefined;
        }
        formatRemoteTime();
      }

      var removeIntervalLoop = $interval(formatRemoteTime, 60000);

      scope.$on('conferencestate:localVideoId:update', onVideoUpdate);
      scope.$on('$destroy', function() {
        $interval.cancel(removeIntervalLoop);
      });
    }
    return {
      restrict: 'A',
      link: link
    };
  }]);
'use strict';

angular.module('op.live-conference')
  .factory('attendeeColorsService', ['MAX_ATTENDEES', function(MAX_ATTENDEES) {
    var colors = [
      '#EF5350',
      '#5C6BC0',
      '#26A69A',
      '#FFEE58',
      '#FF7043',
      '#00B0FF',
      '#9CCC65',
      '#BDBDBD',
      '#FFA726'
    ];

    function getColorForAttendeeAtIndex(index) {
      return colors[index % MAX_ATTENDEES];
    }

    return {
      getColorForAttendeeAtIndex: getColorForAttendeeAtIndex
    };
  }]);
'use strict';

angular.module('op.live-conference')

  .factory('currentConferenceState', ['session', 'ConferenceState', function(session, ConferenceState) {
    return new ConferenceState(session.conference);
  }])

  .factory('newImage', [function() {
    return function() {
      return new Image();
    };
  }])

  .factory('ConferenceState', ['$rootScope', 'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'newImage', function($rootScope, LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, newImage) {
    /*
     * Store a snapshot of current conference status and an array of attendees describing
     * current visible attendees of the conference by their index as position.
     * attendees : [{
     *   videoId:
     *   id:
     *   easyrtcid:
     *   displayName:
     *   avatar:
     * }]
     */
    function ConferenceState(conference) {
      this.conference = conference;
      this.attendees = [];
      this.localVideoId = LOCAL_VIDEO_ID;
      this.videoIds = [LOCAL_VIDEO_ID].concat(REMOTE_VIDEO_IDS);
      this.videoElements = this.videoIds.map(function(id) { return angular.element('<video id="' + id + '" autoplay="autoplay" style="display:none;"/>'); });
      this.avatarCache = [];
    }

    ConferenceState.prototype.getAttendeeByEasyrtcid = function(easyrtcid) {
      return this.attendees.filter(function(attendee) {
          return attendee && attendee.easyrtcid === easyrtcid;
        })[0] || null;
    };

    ConferenceState.prototype.getAttendeeByVideoId = function(videoId) {
      return this.attendees.filter(function(attendee) {
          return attendee && attendee.videoId === videoId;
        })[0] || null;
    };

    function updateAttendee(attendee, properties) {
      if (!attendee) {
        return;
      }

      var oldProperties = {
        speaking: attendee.speaking,
        mute: attendee.mute,
        muteVideo: attendee.muteVideo,
        localmute: attendee.localmute
      };

      Object.keys(properties).forEach(function(property) {
        attendee[property] = properties[property];
      });

      $rootScope.$applyAsync();
      $rootScope.$broadcast('conferencestate:attendees:update', attendee);

      Object.keys(oldProperties).forEach(function(property) {
        if (oldProperties[property] !== attendee[property]) {
          $rootScope.$broadcast('conferencestate:' + property, (function(o) { o[property] = attendee[property]; return o; })({ id: attendee.easyrtcid }));
        }
      });
    }

    ConferenceState.prototype.updateAttendeeByIndex = function(index, properties) {
      updateAttendee(this.attendees[index], properties);
    };

    ConferenceState.prototype.updateAttendeeByEasyrtcid = function(easyrtcid, properties) {
      updateAttendee(this.getAttendeeByEasyrtcid(easyrtcid), properties);
    };

    ConferenceState.prototype.pushAttendee = function(index, easyrtcid, id, displayName) {
      var attendee = {
        index: index,
        videoId: this.videoIds[index],
        id: id,
        easyrtcid: easyrtcid,
        displayName: displayName,
        // This needs to be served by the webapp embedding angular-liveconference
        avatar: '/images/avatar/default.png',
        localmute: false
      };
      this.attendees[index] = attendee;
      $rootScope.$broadcast('conferencestate:attendees:push', attendee);
    };

    ConferenceState.prototype.removeAttendee = function(index) {
      var attendee = this.attendees[index];
      this.attendees[index] = null;
      this.avatarCache[index] = null;
      $rootScope.$broadcast('conferencestate:attendees:remove', attendee);
    };

    ConferenceState.prototype.updateLocalVideoId = function(videoId) {
      this.localVideoId = videoId;
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateLocalVideoIdToIndex = function(index) {
      this.localVideoId = this.videoIds[index];
      $rootScope.$broadcast('conferencestate:localVideoId:update', this.localVideoId);
    };

    ConferenceState.prototype.updateSpeaking = function(easyrtcid, speaking) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { speaking: speaking });
    };

    ConferenceState.prototype.updateMuteFromIndex = function(index, mute) {
      this.updateAttendeeByIndex(index, { mute: mute });
    };

    ConferenceState.prototype.updateMuteFromEasyrtcid = function(easyrtcid, mute) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { mute: mute });
    };

    ConferenceState.prototype.updateMuteVideoFromIndex = function(index, mute) {
      this.updateAttendeeByIndex(index, { muteVideo: mute });
    };

    ConferenceState.prototype.updateTimezoneOffsetFromIndex = function(index, timezoneOffset) {
      this.updateAttendeeByIndex(index, { timezoneOffset: timezoneOffset });
    };

    ConferenceState.prototype.updateMuteVideoFromEasyrtcid = function(easyrtcid, mute) {
      this.updateAttendeeByEasyrtcid(easyrtcid, { muteVideo: mute });
    };

    ConferenceState.prototype.getAvatarImageByIndex = function(index, callback) {
      var attendee = this.attendees[index];

      if (!attendee) {
        return callback(new Error('No attendee at index ' + index));
      }

      if (!this.avatarCache[index]) {
        var self = this;

        this.avatarCache[index] = newImage();
        this.avatarCache[index].src = attendee.avatar;
        this.avatarCache[index].onload = function() {
          callback(null, self.avatarCache[index]);
        };
      } else {
        callback(null, this.avatarCache[index]);
      }
    };

    ConferenceState.prototype.updateLocalMuteFromEasyrtcid = function(easyrtcid, mute) {
      this.updateAttendeeByEasyrtcid(easyrtcid, {localmute: mute});
    };

    ConferenceState.prototype.getAttendees = function() {
      return angular.copy(this.attendees);
    };

    ConferenceState.prototype.getVideoElementById = function(id) {
      return this.videoElements[this.videoIds.indexOf(id)];
    };

    return ConferenceState;
  }]);
'use strict';

angular.module('op.live-conference')

  .factory('drawHelper', function() {

    function drawImage(context) {
      // see https://bugzilla.mozilla.org/show_bug.cgi?id=879717
      // Sometimes Firefox drawImage before it is even available.
      // Thus we ignore this error.

      var argumentsArray = [];
      for (var i = 1; i < arguments.length; i++) {
        argumentsArray.push(arguments[i]);
      }

      try {
        context.drawImage.apply(context, argumentsArray);
      } catch (e) {
        if (e.name !== 'NS_ERROR_NOT_AVAILABLE') {
          throw e;
        }
      }
    }

    return {
      drawImage: drawImage
    };
  })

  .factory('drawVideo', ['$window', '$interval', 'drawAvatarIfVideoMuted', 'drawHelper', function($window, $interval, drawAvatarIfVideoMuted, drawHelper) {
    var requestAnimationFrame =
      $window.requestAnimationFrame ||
      $window.mozRequestAnimationFrame ||
      $window.msRequestAnimationFrame ||
      $window.webkitRequestAnimationFrame;

    var VIDEO_FRAME_RATE = 1000 / 30;
    var promise;

    function draw(context, video, width, height) {
      drawAvatarIfVideoMuted(video.id, context, width, height, function() {
        drawHelper.drawImage(context, video, 0, 0, width, height);
      });
    }

    return function(context, video, width, height) {
      function stopCurrentAnimation() {
        if (promise) {
          $interval.cancel(promise);
        }
      }

      stopCurrentAnimation();

      promise = $interval(function() {
        requestAnimationFrame(function() {
          draw(context, video, width, height);
        });
      }, VIDEO_FRAME_RATE, 0, false);

      return stopCurrentAnimation;
    };
  }])
  .factory('cropDimensions', function() {
    var valuesCache = {};

    function cropSide(cSide, vSide, vReferenceSide) {
      var diff = vSide - vReferenceSide;
      var start = Math.round(diff / 2);
      return start;
    }

    /*
     The goal of this function is to get the coordinate to crop the
     camera image to a square.
     width & height are the target canvas width & height
     vWidth & vHeight are the video width and height

     Read  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images
     the "Slicing" part

     This method sends back an array, where:
     the first element of the array is sx , the second element is sy,
     and the third element is sWidth & sHeight (yeah, bc it's a square)
     */
    function cropDimensions(width, height, vWidth, vHeight) {
      var key = width + ':' + height + ':' + vWidth + ':' + vHeight;
      if (valuesCache[key]) {
        return valuesCache[key];
      }
      var back = [0, 0, 0];
      if (vWidth < vHeight) {
        back[1] = cropSide(height, vHeight, vWidth);
        back[2] = vWidth;
      } else {
        back[0] = cropSide(width, vWidth, vHeight);
        back[2] = vHeight;
      }
      valuesCache[key] = back;
      return back;
    }

    return cropDimensions;

  })

  .factory('getCoordinatesOfCenteredImage', function() {
    return function(width, height, childSize) {
      var scale = Math.min(Math.min(width, height) / childSize, 1);

      return {
        x: (width - childSize * scale) / 2,
        y: (height - childSize * scale) / 2,
        size: childSize * scale
      };
    };
  })

  .factory('drawAvatarIfVideoMuted', ['currentConferenceState', 'attendeeColorsService', 'getCoordinatesOfCenteredImage', '$log', 'drawHelper',
    function(currentConferenceState, attendeeColorsService, getCoordinatesOfCenteredImage, $log, drawHelper) {
    return function(videoId, context, width, height, otherwise) {
      var attendee = currentConferenceState.getAttendeeByVideoId(videoId);

      if (!attendee) {
        return;
      }

      var canvas = context.canvas;

      if (attendee.muteVideo) {
        if (canvas.drawnAvatarVideoId === videoId) {
          return;
        }

        currentConferenceState.getAvatarImageByIndex(attendee.index, function(err, image) {
          if (err) {
            return $log.error('Failed to get avatar image for attendee with videoId %s: ', videoId, err);
          }

          if (!image.width) {
            return;
          }

          var coords = getCoordinatesOfCenteredImage(width, height, image.width);

          context.clearRect(0, 0, width, height);
          context.fillStyle = attendeeColorsService.getColorForAttendeeAtIndex(attendee.index);
          context.fillRect(coords.x, coords.y, coords.size, coords.size);
          drawHelper.drawImage(context, image, coords.x, coords.y, coords.size, coords.size);

          canvas.drawnAvatarVideoId = videoId;
        });
      } else {
        otherwise(videoId, context, width, height);
        canvas.drawnAvatarVideoId = null;
      }
    };
  }]);

'use strict';

angular.module('op.live-conference')
  .factory('newCanvas', [function() {
    return function(width, height) {
      var canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      return canvas;
    };
  }])
  .factory('localCameraScreenshot', ['LOCAL_VIDEO_ID', 'DEFAULT_AVATAR_SIZE', 'currentConferenceState', 'newCanvas', 'newImage',
    function(LOCAL_VIDEO_ID, DEFAULT_AVATAR_SIZE, currentConferenceState, newCanvas, newImage) {
      function shoot(screenshotEdgePx) {
        var attendee = currentConferenceState.getAttendeeByVideoId(LOCAL_VIDEO_ID);

        if (!attendee || attendee.muteVideo) {
          return null;
        }

        var size = screenshotEdgePx || DEFAULT_AVATAR_SIZE,
            thumbnail = angular.element('canvas[data-video-id=' + LOCAL_VIDEO_ID + ']');

        if (!thumbnail.length) {
          return null;
        }

        var canvas = newCanvas(size, size),
            image = newImage();

        canvas.getContext('2d').drawImage(thumbnail[0], 0, 0, size, size);
        image.src = canvas.toDataURL();

        return image;
      }

      return {
        shoot: shoot
      };
    }]);
'use strict';

angular.module('op.live-conference')

  .factory('speechDetector', function() {
    /**
     * https://github.com/otalk/hark
     *
     * returns a hark instance
     *
     * detector.on('speaking', function() {...});
     * detector.on('stopped_speaking', function() {...});
     *
     * don't forget to call detector.stop();
     */
    /* global hark */
    return function(stream, options) {
      var opts = options || {};
      opts.play = false;
      var speechEvents = hark(stream, opts);
      stream = null;
      return speechEvents;
    };
  })

  .factory('AutoVideoSwitcher', ['$rootScope', '$timeout', 'AUTO_VIDEO_SWITCH_TIMEOUT', 'LOCAL_VIDEO_ID',
    function($rootScope, $timeout, AUTO_VIDEO_SWITCH_TIMEOUT, LOCAL_VIDEO_ID) {

      function AutoVideoSwitcher(conferenceState) {
        this.conferenceState = conferenceState;
        this.timeouts = {};
        var self = this;
        $rootScope.$on('conferencestate:speaking', function(event, data) {
          if (data.speaking) {
            self.onSpeech(event, data);
          } else {
            self.onSpeechEnd(event, data);
          }
        });
      }

      AutoVideoSwitcher.prototype.onSpeech = function(evt, data) {
        var member = this.getMemberFromData(data);
        if (!member || this.timeouts[member.easyrtcid] || member.videoId === LOCAL_VIDEO_ID || member.mute || member.videoId === this.conferenceState.localVideoId) {
          return;
        }
        var easyrtcid = member.easyrtcid;

        this.timeouts[easyrtcid] = $timeout(function() {
          var member = this.getMemberFromData(data);
          if (!member) {
            return;
          }

          this.conferenceState.updateLocalVideoId(member.videoId);
        }.bind(this), AUTO_VIDEO_SWITCH_TIMEOUT, false);
      };

      AutoVideoSwitcher.prototype.onSpeechEnd = function(evt, data) {
        var member = this.getMemberFromData(data);
        if (!member || !this.timeouts[member.easyrtcid] || member.videoId === LOCAL_VIDEO_ID) {
          return;
        }
        $timeout.cancel(this.timeouts[member.easyrtcid]);
        this.timeouts[member.easyrtcid] = null;
      };

      AutoVideoSwitcher.prototype.getMemberFromData = function(data) {
        return this.conferenceState.getAttendeeByEasyrtcid(data.id);
      };

      return AutoVideoSwitcher;
    }]);
'use strict';

angular.module('op.live-conference')
  .factory('webRTCService', ['easyRTCAdapter', function(easyRTCAdapter) {
    var adapter = easyRTCAdapter;

    return {
        leaveRoom: adapter.leaveRoom,
        performCall: adapter.performCall,
        connect: adapter.connect,
        canEnumerateDevices: adapter.canEnumerateDevices,
        enableMicrophone: adapter.enableMicrophone,
        muteRemoteMicrophone: adapter.muteRemoteMicrophone,
        enableCamera: adapter.enableCamera,
        enableVideo: adapter.enableVideo,
        isVideoEnabled: adapter.isVideoEnabled,
        configureBandwidth: adapter.configureBandwidth,
        setPeerListener: adapter.setPeerListener,
        myEasyrtcid: adapter.myEasyrtcid,
        broadcastData: adapter.broadcastData,
        broadcastMe: adapter.broadcastMe,
        addDisconnectCallback: adapter.addDisconnectCallback,
        removeDisconnectCallback: adapter.removeDisconnectCallback,
        sendDataP2P: adapter.sendDataP2P,
        sendDataWS: adapter.sendDataWS,
        sendData: adapter.sendData,
        getP2PConnectionStatus: adapter.getP2PConnectionStatus,
        doesDataChannelWork: adapter.doesDataChannelWork,
        setGotMedia: adapter.setGotMedia,
        NOT_CONNECTED: adapter.NOT_CONNECTED,
        BECOMING_CONNECTED: adapter.BECOMING_CONNECTED,
        IS_CONNECTED: adapter.IS_CONNECTED,
        addDataChannelOpenListener: adapter.addDataChannelOpenListener,
        addDataChannelCloseListener: adapter.addDataChannelCloseListener,
        removeDataChannelOpenListener: adapter.removeDataChannelOpenListener,
        removeDataChannelCloseListener: adapter.removeDataChannelCloseListener,
        addPeerListener: adapter.addPeerListener,
        removePeerListener: adapter.removePeerListener,
        connection: adapter.connection,
        getOpenedDataChannels: adapter.getOpenedDataChannels
    };
  }]);
angular.module('op.liveconference-templates', []).run(['$templateCache', function ($templateCache) {
  "use strict";
  $templateCache.put("templates/application.jade",
    "<div class=\"conference-container\"><div class=\"container-fluid\"><div class=\"row\"><div ng-view></div></div></div></div>");
  $templateCache.put("templates/attendee-settings-dropdown.jade",
    "<ul role=\"menu\" class=\"dropdown-menu attendee-settings-dropdown\"><li role=\"presentation\" ng-class=\"{'disabled': attendee.mute &amp;&amp; !attendee.localmute}\"><a href=\"\" ng-click=\"toggleAttendeeMute()\" role=\"menuitem\" target=\"_blank\"><i ng-class=\"{'fa-microphone': !attendee.mute &amp;&amp; !attendee.localmute, 'fa-microphone-slash': attendee.mute || attendee.localmute}\" class=\"fa fa-fw conference-mute-button\"></i><span ng-if=\"attendee.localmute\">Unmute</span><span ng-if=\"!attendee.localmute\">Mute</span></a></li><li role=\"presentation\"><a href=\"\" ng-click=\"showReportPopup()\" role=\"menuitem\" target=\"_blank\"><i class=\"fa fa-fw fa-exclamation-triangle conference-report-button\"></i>&nbsp;Report</a></li></ul>");
  $templateCache.put("templates/attendee-video.jade",
    "<div dynamic-directive=\"attendee-video\" class=\"attendee-video\"><canvas data-video-id=\"{{videoId}}\" width=\"150\" height=\"150\" ng-click=\"onVideoClick(videoIndex)\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = false\" ng-init=\"count=0\" ng-class=\"{thumbhover: thumbhover, speaking: attendee.speaking &amp;&amp; (!attendee.mute &amp;&amp; !attendee.localmute), mirror: isMe}\" class=\"conference-attendee-video-multi\"></canvas><a href=\"\" target=\"_blank\" ng-show=\"videoId !== 'video-thumb0' &amp;&amp; thumbhover\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = true\" ng-class=\"{'hidden': !isDesktop}\" class=\"hidden-xs\"><i data-placement=\"right-bottom\" data-html=\"true\" data-animation=\"am-flip-x\" bs-dropdown template=\"templates/attendee-settings-dropdown.jade\" class=\"fa fa-2x fa-cog conference-settings-button\"></i></a><i ng-show=\"attendee.mute || attendee.localmute\" class=\"fa fa-2x fa-microphone-slash conference-secondary-mute-button\"></i><i ng-show=\"false\" class=\"fa fa-2x fa-eye-slash conference-secondary-toggle-video-button\"></i><p class=\"text-center conference-attendee-name ellipsis\">{{attendee.displayName}}</p></div>");
  $templateCache.put("templates/attendee.jade",
    "<div class=\"col-xs-12 media nopadding conference-attendee\"><a href=\"#\" class=\"pull-left\"><img src=\"/images/user.png\" ng-src=\"/api/users/{{user._id}}/profile/avatar\" class=\"media-object thumbnail\"></a><div class=\"media-body\"><h6 class=\"media-heading\">{{user.firstname}} {{user.lastname}}</h6><button type=\"submit\" ng-disabled=\"invited\" ng-click=\"inviteCall(user); invited=true\" class=\"btn btn-primary nopadding\">Invite</button></div><div class=\"horiz-space\"></div></div>");
  $templateCache.put("templates/conference-video.jade",
    "<div id=\"multiparty-conference\" local-speak-emitter auto-video-switcher ng-style=\"paneStyle\" dynamic-directive=\"conference-video\" class=\"conference-video fullscreen\"><conference-user-video></conference-user-video><div ng-style=\"attendeesBarStyle\" class=\"conference-attendees-bar\"><ul scale-to-canvas ng-style=\"attendeesBarContentStyle\" class=\"content\"><li ng-repeat=\"id in conferenceState.videoIds\" ng-hide=\"!conferenceState.attendees[$index]\" dynamic-directive=\"attendee-thumbail-container\"><conference-attendee-video video-index=\"$index\" on-video-click=\"streamToMainCanvas\" video-id=\"{{id}}\" attendee=\"conferenceState.attendees[$index]\" show-report=\"showReport\"></conference-attendee-video></li></ul></div><conference-user-control-bar show-invitation=\"showInvitation\" on-leave=\"onLeave\" conference-state=\"conferenceState\"></conference-user-control-bar></div>");
  $templateCache.put("templates/invite-members.jade",
    "<div class=\"aside\"><div class=\"aside-dialog\"><div class=\"aside-content\"><div class=\"aside-header\"><h4>Members</h4></div><div class=\"aside-body\"><div ng-repeat=\"user in users\" class=\"row\"><conference-attendee></conference-attendee></div></div></div></div></div>");
  $templateCache.put("templates/live.jade",
    "<div class=\"col-xs-12\"><conference-video easyrtc=\"easyrtc\"></conference-video><conference-notification conference-id=\"{{conference._id}}\"></conference-notification></div>");
  $templateCache.put("templates/mobile-user-video-quadrant-control.jade",
    "<ul class=\"list-inline mobile-user-video-control\"><li><a href=\"\" ng-click=\"mute()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-5x fa-fw\"></i></a></li><li><a href=\"\" ng-click=\"onMobileToggleControls()\"><i class=\"fa fa-5x fa-fw fa-times\"></i></a></li><li><a href=\"\" ng-click=\"showReportPopup()\"><i class=\"fa fa-5x fa-fw fa-exclamation-triangle\"></i></a></li></ul>");
  $templateCache.put("templates/mobile-video.jade",
    "<canvas local-speak-emitter auto-video-switcher id=\"mobileVideo\" width=\"150\" height=\"150\"></canvas>");
  $templateCache.put("templates/user-control-bar.jade",
    "<div class=\"conference-user-control-bar text-center\"><ul dynamic-directive=\"live-conference-control-bar-items\" class=\"list-inline\"><li><a href=\"\" ng-click=\"toggleSound()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-2x conference-mute-button conference-light-button\"></i></a></li><li ng-class=\"{'hidden': noVideo}\"><a href=\"\" ng-click=\"toggleCamera()\"><i ng-class=\"{'fa-eye': !videoMuted, 'fa-eye-slash': videoMuted}\" class=\"fa fa-2x conference-toggle-video-button conference-light-button\"></i></a></li><li><a href=\"\" ng-click=\"leaveConference()\"><i class=\"fa fa-phone fa-2x conference-toggle-terminate-call-button conference-light-button\"></i></a></li><li><a href=\"\" ng-click=\"showInvitationPanel()\"><i class=\"fa fa-users fa-2x conference-toggle-invite-button conference-light-button\"></i></a></li><editor-toggle-element></editor-toggle-element></ul></div>");
  $templateCache.put("templates/user-video.jade",
    "<div class=\"user-video\"><div smart-fit from=\"#multiparty-conference\" class=\"canvas-container\"><canvas id=\"mainVideoCanvas\" ng-click=\"onMobileToggleControls()\" ng-class=\"{mirror: isMe}\" class=\"conference-main-video-multi\"></canvas><div user-time ng-show=\"remoteHour\" ng-style=\"{'color' : color}\" class=\"user-time\">{{remoteHour}}</div></div></div>");
}]);
