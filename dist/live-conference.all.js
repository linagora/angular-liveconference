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

function WildEmitter() {
    this.callbacks = {};
}

// Listen on the given `event` with `fn`. Store a group name if present.
WildEmitter.prototype.on = function (event, groupName, fn) {
    var hasGroup = (arguments.length === 3),
        group = hasGroup ? arguments[1] : undefined,
        func = hasGroup ? arguments[2] : arguments[1];
    func._groupName = group;
    (this.callbacks[event] = this.callbacks[event] || []).push(func);
    return this;
};

// Adds an `event` listener that will be invoked a single
// time then automatically removed.
WildEmitter.prototype.once = function (event, groupName, fn) {
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
WildEmitter.prototype.releaseGroup = function (groupName) {
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
WildEmitter.prototype.off = function (event, fn) {
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
    return this;
};

/// Emit `event` with the given args.
// also calls any `*` handlers
WildEmitter.prototype.emit = function (event) {
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
            if (listeners[i]) {
                listeners[i].apply(this, args);
            } else {
                break;
            }
        }
    }

    if (specialCallbacks) {
        len = specialCallbacks.length;
        listeners = specialCallbacks.slice();
        for (i = 0, len = listeners.length; i < len; ++i) {
            if (listeners[i]) {
                listeners[i].apply(this, [event].concat(args));
            } else {
                break;
            }
        }
    }

    return this;
};

// Helper for for finding special wildcard event handlers that match the event
WildEmitter.prototype.getWildcardCallbacks = function (eventName) {
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
  .constant('DEFAULT_AVATAR_SIZE', 500);
'use strict';

angular.module('op.live-conference')
  .directive('conferenceVideo', ['$timeout', '$window', '$rootScope', 'drawVideo', 'currentConferenceState', 'LOCAL_VIDEO_ID', 'DEFAULT_AVATAR_SIZE',
  function($timeout, $window, $rootScope, drawVideo, currentConferenceState, LOCAL_VIDEO_ID, DEFAULT_AVATAR_SIZE) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'templates/conference-video.jade',
      link: function(scope, element) {
        var canvas = {};
        var context = {};
        var mainVideo = {};
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
          mainVideo = element.find('video#' + LOCAL_VIDEO_ID);
          mainVideo.on('loadedmetadata', function() {
            if ($window.mozRequestAnimationFrame) {
              // see https://bugzilla.mozilla.org/show_bug.cgi?id=926753
              // Firefox needs this timeout.
              $timeout(function() {
                drawVideoInCanvas();
              }, 500);
            } else {
              drawVideoInCanvas();
            }
          });
        }, 1000);

        scope.conferenceState = currentConferenceState;

        scope.$on('conferencestate:localVideoId:update', function(event, newVideoId) {
          // Reject the first watch of the mainVideoId
          // when clicking on a new video, loadedmetadata event is not
          // fired.
          if (!mainVideo[0]) {
            return;
          }
          mainVideo = element.find('video#' + newVideoId);
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

        angular.element($window).on('orientationchange', drawVideoInCanvas);
      }
    };
  }])

  .directive('conferenceAttendee', function() {
    return {
      restrict: 'E',
      templateUrl: 'templates/attendee.jade'
    };
  })

  .directive('conferenceAttendeeVideo', ['easyRTCService', 'currentConferenceState', 'matchmedia', function(easyRTCService, currentConferenceState, matchmedia) {
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
          easyRTCService.muteRemoteMicrophone(scope.attendee.easyrtcid, !mute);
          currentConferenceState.updateLocalMuteFromEasyrtcid(scope.attendee.easyrtcid, !mute);
        };

        scope.isDesktop = matchmedia.isDesktop();
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
        var watcher = {};

        scope.$on('localVideoId:ready', function(event, videoId) {
          if (watcher instanceof Function) {
            // we must unregister previous watcher
            // if it has been initialized first
            watcher();
          }
          mainVideo = $('video#' + videoId);
          videoElement = mainVideo[0];
          scope.muted = videoElement.muted;

          scope.mute = function() {
            videoElement.muted = !videoElement.muted;
            scope.onMobileToggleControls();
          };

          scope.showReportPopup = function() {
            scope.onMobileToggleControls();
            var attendee = currentConferenceState.getAttendeeByVideoId(videoId);
            if (!attendee) {
              return;
            }
            scope.showReport(attendee);
          };

          watcher = scope.$watch(function() {
            return videoElement.muted;
          }, function() {
            scope.muted = videoElement.muted;
          });
        });
      }
    };
  }])

  .directive('conferenceUserControlBar', function($log, easyRTCService) {
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

        $scope.noVideo = !easyRTCService.isVideoEnabled();

        $scope.toggleSound = function() {
          easyRTCService.enableMicrophone($scope.muted);

          $scope.muted = !$scope.muted;
          $scope.conferenceState.updateMuteFromIndex(0, $scope.muted);

          easyRTCService.broadcastMe();
        };

        $scope.toggleCamera = function() {
          easyRTCService.enableCamera($scope.videoMuted);
          easyRTCService.enableVideo($scope.videoMuted);

          $scope.videoMuted = !$scope.videoMuted;
          $scope.conferenceState.updateMuteVideoFromIndex(0, $scope.videoMuted);

          easyRTCService.broadcastMe();
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
  .directive('scaleToCanvas', ['$interval', '$window', 'cropDimensions', 'drawAvatarIfVideoMuted', 'drawHelper',
    function($interval, $window, cropDimensions, drawAvatarIfVideoMuted, drawHelper) {

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
        element.find('video').each(function(index, vid) {
          var canvas = element.find('canvas[data-video-id=' + vid.id + ']').get(0);
          widgets.push({
            video: vid,
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
  .directive('localSpeakEmitter', ['$rootScope', 'session', 'currentConferenceState', 'easyRTCService', 'speechDetector', function($rootScope, session, currentConferenceState, easyRTCService, speechDetector) {
    function link(scope) {
      function createLocalEmitter(stream) {
        var detector = speechDetector(stream);
        scope.$on('$destroy', function() {
          detector.stop();
          detector = null;
        });
        detector.on('speaking', function() {
          currentConferenceState.updateSpeaking(easyRTCService.myEasyrtcid(), true);
          easyRTCService.broadcastMe();
        });
        detector.on('stopped_speaking', function() {
          currentConferenceState.updateSpeaking(easyRTCService.myEasyrtcid(), false);
          easyRTCService.broadcastMe();
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
        if (element[0].tagName !== 'CANVAS') {
          throw new Error('The smartFit directive can only be applied to a HTML Canvas.');
        }

        var unregisterRootScopeListener,
            source = angular.element(attrs.from),
            toPreserve = angular.element(attrs.preserve);

        function smartFit() {
          var canvas = element[0],
            availWidth = source.width(),
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

          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';

          if (toPreserve.length) {
            canvas.style['margin-top'] = Math.max(0, (toPreserve.position().top - height) / 2) + 'px';
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
  .factory('listenerFactory', ['$log', function($log) {
    return function(addListenerFunction, callbackName) {
      var callbacks = [];
      return {
        addListener: function(pushedCallback) {
          callbacks.push(pushedCallback);

          addListenerFunction(function() {
            var listenerArguments = arguments;
            if (callbackName) {
              $log.debug('Added callback for ' + callbackName);
            }
            callbacks.forEach(function(callback) {
              callback.apply(this, listenerArguments);
            });
          });
          return pushedCallback;
        },
        removeListener: function(removeCallback) {
          if (callbackName) {
            $log.debug('Deleted callback for ' + callbackName);
          }
          var index = callbacks.indexOf(removeCallback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    };
  }])
  .factory('easyRTCService', ['$rootScope', '$log', 'webrtcFactory', 'tokenAPI', 'session',
    'ioSocketConnection', 'ioConnectionManager', '$timeout', 'easyRTCBitRates', 'currentConferenceState',
    'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'EASYRTC_APPLICATION_NAME', 'EASYRTC_EVENTS', '$q', 'listenerFactory',
    function($rootScope, $log, webrtcFactory, tokenAPI, session, ioSocketConnection, ioConnectionManager, $timeout, easyRTCBitRates, currentConferenceState,
             LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, EASYRTC_APPLICATION_NAME, EASYRTC_EVENTS, $q, listenerFactory) {
      var easyrtc = webrtcFactory.get();
      easyrtc.enableDataChannels(true);

      var bitRates, room, disconnectCallbacks = [];
      var videoEnabled = true;

      var checkFirefoxEnumerateDevices = navigator.mozGetUserMedia && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices;
      var isChromeBrowser = window.webrtcDetectedBrowser === 'chrome';
      var canEnumerateDevices = checkFirefoxEnumerateDevices || isChromeBrowser;

      easyrtc.getVideoSourceList(function(results) {
        if (isChromeBrowser) {
          if (results.length === 0) {
            videoEnabled = false;
            easyrtc.enableVideo(false);
          }
        }

        if (checkFirefoxEnumerateDevices) { // only for firefox >= 39
          navigator.mediaDevices.enumerateDevices().then(function(devices) {
            videoEnabled = devices.some(function(device) {
              return device.kind === 'videoinput';
            });
            easyrtc.enableVideo(videoEnabled);
          });
        }
      });

      function removeDisconnectCallback(id) {
        if (!id) {
          return false;
        }

        disconnectCallbacks.splice(id, 1);
      }

      function addDisconnectCallback(callback) {
        if (!callback) {
          return false;
        }

        return disconnectCallbacks.push(callback) - 1;
      }

      easyrtc.setDisconnectListener(function() {
        disconnectCallbacks.forEach(function(callback) {
          callback();
        });
      });

      addDisconnectCallback(function() {
        $log.info('Lost connection to signaling server');
      });

      function stopLocalStream() {
        var stream = easyrtc.getLocalStream();
        if (stream) {
          stream.stop();
        }
      }

      function leaveRoom(conference) {
        stopLocalStream();
        easyrtc.leaveRoom(conference._id, function() {
          $log.debug('Left the conference ' + conference._id);
          $rootScope.$emit('conference:left', {conference_id: conference._id});
        }, function() {
          $log.error('Error while leaving conference');
        });
      }

      function performCall(otherEasyrtcid) {
        $log.debug('Calling ' + otherEasyrtcid);
        easyrtc.hangupAll();

        function onSuccess() {
          $log.debug('Successfully connected to ' + otherEasyrtcid);
        }

        function onFailure() {
          $log.error('Error while connecting to ' + otherEasyrtcid);
        }

        easyrtc.call(otherEasyrtcid, onSuccess, onFailure);
      }

      // This function will be called when the connection has occured
      var ret = (function() {
          var callback,
            connected = false, failed = false;

          function onConnectionCallbackHelper(newCallback) {
            if (connected && failed === false) {
              newCallback();
            } else if (!connected && failed === false) {
              callback = newCallback;
            } else {
              newCallback(failed);
            }
          }
          function callOnConnectedSuccess() {
            connected = true;
            if (callback !== undefined) {
              callback();
            }
          }
          function callOnConnectedError(errorCode, message) {
            failed = {errorCode: errorCode, message: message};
            if (callback !== undefined) {
              callback(failed);
            }
          }
          return {
            onConnectionCallback: listenerFactory(onConnectionCallbackHelper).addListener,
            callOnConnectedSuccess: callOnConnectedSuccess,
            callOnConnectedError: callOnConnectedError
          };
        })(),
        onConnectionCallback = ret.onConnectionCallback,
        callOnConnectedSuccess = ret.callOnConnectedSuccess,
        callOnConnectedError = ret.callOnConnectedError;

      function connect(conferenceState, callback) {

        function entryListener(entry, roomName) {
          if (entry) {
            $log.debug('Entering room ' + roomName);
            room = roomName;
          } else {
            $log.debug('Leaving room ' + roomName);
            room = null;
          }
        }

        function roomOccupantListener(roomName, data, isPrimary) {
          easyrtc.setRoomOccupantListener(null); // so we're only called once.
          $log.debug('New user(s) in room ' + roomName);
          $log.debug('Room data ', data);

          function onSuccess() {
            $log.info('Successfully connected to user');
          }

          function onFailure() {
            $log.error('Error while connecting to user');
          }

          for (var easyrtcid in data) {
            $log.debug('Calling: ' + easyrtc.idToName(easyrtcid));
            easyrtc.call(easyrtcid, onSuccess, onFailure);
          }
        }

        if (bitRates) {
          var localFilter = easyrtc.buildLocalSdpFilter({audioRecvBitrate: bitRates.audio, videoRecvBitrate: bitRates.video});
          var remoteFilter = easyrtc.buildRemoteSdpFilter({audioSendBitrate: bitRates.audio, videoSendBitrate: bitRates.video});
          easyrtc.setSdpFilters(localFilter, remoteFilter);
        }

        easyrtc.setRoomOccupantListener(roomOccupantListener);
        easyrtc.setRoomEntryListener(entryListener);

        var conference = conferenceState.conference;
        if (!(conference._id in easyrtc.roomJoin)) {
          easyrtc.joinRoom(conference._id, null,
            function() {
              $log.debug('Joined room ' + conference._id);
            },
            function() {
              $log.debug('Error while joining room ' + conference._id);
            }
          );
        }

        easyrtc.username = session.getUserId();

        easyrtc.debugPrinter = function(message) {
          $log.debug(message);
        };

        function onWebsocket() {
          var sio = ioSocketConnection.getSio();
          sio.socket = {connected: true};
          easyrtc.useThisSocketConnection(sio);

          function onLoginSuccess(easyrtcid) {
            $log.debug('Successfully logged: ' + easyrtcid);
            conferenceState.pushAttendee(0, easyrtcid, session.getUserId(), session.getUsername());
            $rootScope.$apply();
            if (!videoEnabled) {
              conferenceState.updateMuteVideoFromIndex(0, true);
            }
            if (callback) {
              callback(null);
            }
            callOnConnectedSuccess();
          }

          function onLoginFailure(errorCode, message) {
            $log.error('Error while connecting to the webrtc signaling service ' + errorCode + ' : ' + message);
            if (callback) {
              callback(errorCode);
            }
            callOnConnectedError(errorCode, message);
          }

          easyrtc.setOnError(function(errorObject) {
            $log.error('setOnError with error: ' + errorObject.errorText + ' [error=' + JSON.stringify(errorObject) + ']');
          });

          easyrtc.setVideoDims();

          easyrtc.easyApp(
            EASYRTC_APPLICATION_NAME,
            LOCAL_VIDEO_ID,
            REMOTE_VIDEO_IDS,
            onLoginSuccess,
            onLoginFailure);

          easyrtc.setOnCall(function(easyrtcid, slot) {
            $log.debug('SetOnCall', easyrtcid);
            conferenceState.pushAttendee(slot + 1, easyrtcid);
            $rootScope.$apply();
          });

          addDataChannelOpenListener(function(easyrtcid) {
            var data = {
              id: session.getUserId(),
              displayName: session.getUsername(),
              mute: conferenceState.attendees[0].mute,
              muteVideo: conferenceState.attendees[0].muteVideo
            };

            $log.debug('Data channel open, sending %s event with data: ', EASYRTC_EVENTS.attendeeUpdate, data);
            easyrtc.sendData(easyrtcid, EASYRTC_EVENTS.attendeeUpdate, data);
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            conferenceState.removeAttendee(slot + 1);
            $rootScope.$apply();
          });

          addPeerListener(function(easyrtcid, msgType, msgData) {
            $log.debug('Event %s received from %s with data: ', EASYRTC_EVENTS.attendeeUpdate, easyrtcid, msgData);
            conferenceState.updateAttendeeByEasyrtcid(easyrtcid, msgData);
          }, EASYRTC_EVENTS.attendeeUpdate);
        }

        if (ioSocketConnection.isConnected()) {
          onWebsocket();
        } else {
          ioSocketConnection.addConnectCallback(onWebsocket);
        }

      }

      function enableMicrophone(muted) {
        easyrtc.enableMicrophone(muted);
      }

      function enableCamera(videoMuted) {
        easyrtc.enableCamera(videoMuted);
      }

      function enableVideo(videoChoice) {
        videoEnabled = videoChoice;
        easyrtc.enableVideo(videoChoice);
      }

      function isVideoEnabled() {
        return videoEnabled;
      }

      function muteRemoteMicrophone(easyrtcid, mute) {
        var stream = easyrtc.getRemoteStream(easyrtcid);
        if (stream && stream.getAudioTracks) {
          var tracks = stream.getAudioTracks();
          if (tracks) {
            tracks.forEach(function(track) {
              track.enabled = !mute;
            });
          }
        }
      }

      function sendDataP2P(easyrtcid, msgType, data) {
        easyrtc.sendDataP2P(easyrtcid, msgType, JSON.stringify(data));
      }

      function sendDataWS(easyrtcid, msgType, data, ackhandler) {
        easyrtc.sendDataWS(easyrtcid, msgType, JSON.stringify(data), ackhandler);
      }

      function sendData(easyrtcid, msgType, data, ackhandler) {
        easyrtc.sendData(easyrtcid, msgType, JSON.stringify(data), ackhandler);
      }

      function getP2PConnectionStatus(easyrtcid) {
        return easyrtc.getConnectStatus(easyrtcid);
      }

      function doesDataChannelWork(easyrtcid) {
        return easyrtc.doesDataChannelWork(easyrtcid);
      }

      function setPeerListener(handler, msgType) {
        $log.warn('If you use setPeerListener, only the last handler will be executed!');
        easyrtc.setPeerListener(handler, msgType);
      }

      function configureBandwidth(rate) {
        if (rate) {
          bitRates = easyRTCBitRates[rate];
        }
        else {
          bitRates = null;
        }
      }

      function myEasyrtcid() {
        return easyrtc.myEasyrtcid;
      }

      function prepareAttendeeForBroadcast(attendee) {
        return {
          id: attendee.id,
          easyrtcid: attendee.easyrtcid,
          displayName: attendee.displayName,
          avatar: attendee.avatar,
          mute: attendee.mute,
          muteVideo: attendee.muteVideo,
          speaking: attendee.speaking
        };
      }

      function broadcastData(msgType, data) {
        var occupants = easyrtc.getRoomOccupantsAsArray(room);

        if (!occupants) {
          return;
        }

        occupants.forEach(function(easyrtcid) {
          if (easyrtcid === myEasyrtcid()) {
            return;
          }

          easyrtc.sendData(easyrtcid, msgType, data);
        });
      }

      function broadcastMe() {
        var attendee = currentConferenceState.getAttendeeByEasyrtcid(myEasyrtcid());

        if (!attendee) {
          return;
        }

        broadcastData(EASYRTC_EVENTS.attendeeUpdate, prepareAttendeeForBroadcast(attendee));
      }

      easyrtc.setDataChannelCloseListener(function(easyrtcid) {
        $log.debug('MEET-255 Data channel closed with ' + easyrtcid);
      });

      easyrtc.setCallCancelled(function(easyrtcid, explicitlyCancelled) {
        if (explicitlyCancelled) {
          $log.debug('MEET-255 ' + easyrtc.idToName(easyrtcid) + ' stopped trying to reach you');
        } else {
          $log.debug('MEET-255 Implicitly called ' + easyrtc.idToName(easyrtcid));
        }
      });

      easyrtc.setOnStreamClosed(function(easyrtcid, stream, streamName) {
        $log.debug('MEET-255 ' + easyrtc.idToName(easyrtcid) + ' closed stream ' + stream.id + ' ' + streamName);
      });

      function setGotMedia(cb) {
        easyrtc.setGotMedia(cb);
      }

      function connection() {
        var defer = $q.defer();
        onConnectionCallback(function(errorCode, message) {
          if (!errorCode) {
            defer.resolve();
          } else {
            defer.reject(errorCode);
          }
        });
        return defer.promise;
      }

      function getOpenedDataChannels() {
        return (easyrtc.getRoomOccupantsAsArray(room) || []).filter(function(peer) {
          return easyrtc.doesDataChannelWork(peer);
        });
      }

      var tmp;
      tmp = listenerFactory(easyrtc.setDataChannelOpenListener, 'dataChannelOpenListener');
      var addDataChannelOpenListener = tmp.addListener,
        removeDataChannelOpenListener = tmp.removeListener;
      tmp = (function() {
        var listener = listenerFactory(easyrtc.setPeerListener, 'peerListener');
        return {
          addListener: function(callback, acceptMsgType) {
            var decoratedCallback = function(easyrtcid, msgType, msgData, targeting) {
              if (acceptMsgType === undefined || msgType === acceptMsgType) {
                callback.apply(this, arguments);
              }
            };
            listener.addListener(decoratedCallback);
            return decoratedCallback;
          },
          removeListener: function(callback) {
            listener.removeListener(callback);
          }
        };
      })();
      var addPeerListener = tmp.addListener,
        removePeerListener = tmp.removeListener;
      tmp = listenerFactory(easyrtc.setDataChannelCloseListener, 'dataChanelCloseListener');
      var addDataChannelCloseListener = tmp.addListener,
        removeDataChannelCloseListener = tmp.removeListener;

      return {
        leaveRoom: leaveRoom,
        performCall: performCall,
        connect: connect,
        canEnumerateDevices: canEnumerateDevices,
        enableMicrophone: enableMicrophone,
        muteRemoteMicrophone: muteRemoteMicrophone,
        enableCamera: enableCamera,
        enableVideo: enableVideo,
        isVideoEnabled: isVideoEnabled,
        configureBandwidth: configureBandwidth,
        setPeerListener: setPeerListener,
        myEasyrtcid: myEasyrtcid,
        broadcastData: broadcastData,
        broadcastMe: broadcastMe,
        addDisconnectCallback: addDisconnectCallback,
        removeDisconnectCallback: removeDisconnectCallback,
        sendDataP2P: sendDataP2P,
        sendDataWS: sendDataWS,
        sendData: sendData,
        getP2PConnectionStatus: getP2PConnectionStatus,
        doesDataChannelWork: doesDataChannelWork,
        setGotMedia: setGotMedia,
        NOT_CONNECTED: easyrtc.NOT_CONNECTED,
        BECOMING_CONNECTED: easyrtc.BECOMING_CONNECTED,
        IS_CONNECTED: easyrtc.IS_CONNECTED,
        addDataChannelOpenListener: addDataChannelOpenListener,
        addDataChannelCloseListener: addDataChannelCloseListener,
        removeDataChannelOpenListener: removeDataChannelOpenListener,
        removeDataChannelCloseListener: removeDataChannelCloseListener,
        addPeerListener: addPeerListener,
        removePeerListener: removePeerListener,
        connection: connection,
        getOpenedDataChannels: getOpenedDataChannels
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
angular.module('op.liveconference-templates', []).run(['$templateCache', function($templateCache) {
  "use strict";
  $templateCache.put("templates/application.jade",
    "<div class=\"conference-container\"><div class=\"container-fluid\"><div class=\"row\"><div ng-view></div></div></div></div>");
  $templateCache.put("templates/attendee-settings-dropdown.jade",
    "<ul role=\"menu\" class=\"dropdown-menu attendee-settings-dropdown\"><li role=\"presentation\" ng-class=\"{'disabled': attendee.mute &amp;&amp; !attendee.localmute}\"><a href=\"\" ng-click=\"toggleAttendeeMute()\" role=\"menuitem\" target=\"_blank\"><i ng-class=\"{'fa-microphone': !attendee.mute &amp;&amp; !attendee.localmute, 'fa-microphone-slash': attendee.mute || attendee.localmute}\" class=\"fa fa-fw conference-mute-button\"></i><span ng-if=\"attendee.localmute\">Unmute</span><span ng-if=\"!attendee.localmute\">Mute</span></a></li><li role=\"presentation\"><a href=\"\" ng-click=\"showReportPopup()\" role=\"menuitem\" target=\"_blank\"><i class=\"fa fa-fw fa-exclamation-triangle conference-report-button\"></i>&nbsp;Report</a></li></ul>");
  $templateCache.put("templates/attendee-video.jade",
    "<div class=\"attendee-video\"><canvas data-video-id=\"{{videoId}}\" width=\"150\" height=\"150\" ng-click=\"onVideoClick(videoIndex)\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = false\" ng-init=\"count=0\" ng-class=\"{thumbhover: thumbhover, speaking: attendee.speaking &amp;&amp; (!attendee.mute &amp;&amp; !attendee.localmute)}\" class=\"conference-attendee-video-multi\"></canvas><video id=\"{{videoId}}\" autoplay=\"autoplay\"></video><a href=\"\" target=\"_blank\" ng-show=\"videoId !== 'video-thumb0' &amp;&amp; thumbhover\" ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = true\" ng-class=\"{'hidden': !isDesktop}\" class=\"hidden-xs\"><i data-placement=\"right-bottom\" data-html=\"true\" data-animation=\"am-flip-x\" bs-dropdown template=\"templates/attendee-settings-dropdown.jade\" class=\"fa fa-2x fa-cog conference-settings-button\"></i></a><i ng-show=\"attendee.mute || attendee.localmute\" class=\"fa fa-2x fa-microphone-slash conference-secondary-mute-button\"></i><i ng-show=\"false\" class=\"fa fa-2x fa-eye-slash conference-secondary-toggle-video-button\"></i><p class=\"text-center conference-attendee-name ellipsis\">{{attendee.displayName}}</p></div>");
  $templateCache.put("templates/attendee.jade",
    "<div class=\"col-xs-12 media nopadding conference-attendee\"><a href=\"#\" class=\"pull-left\"><img src=\"/images/user.png\" ng-src=\"/api/users/{{user._id}}/profile/avatar\" class=\"media-object thumbnail\"></a><div class=\"media-body\"><h6 class=\"media-heading\">{{user.firstname}} {{user.lastname}}</h6><button type=\"submit\" ng-disabled=\"invited\" ng-click=\"inviteCall(user); invited=true\" class=\"btn btn-primary nopadding\">Invite</button></div><div class=\"horiz-space\"></div></div>");
  $templateCache.put("templates/conference-video.jade",
    "<div id=\"multiparty-conference\" local-speak-emitter auto-video-switcher ng-style=\"paneStyle\" class=\"conference-video fullscreen\"><conference-user-video></conference-user-video><div class=\"conference-attendees-bar\"><ul scale-to-canvas class=\"content\"><li ng-repeat=\"id in conferenceState.videoIds\" ng-hide=\"!conferenceState.attendees[$index]\"><conference-attendee-video video-index=\"$index\" on-video-click=\"streamToMainCanvas\" video-id=\"{{id}}\" attendee=\"conferenceState.attendees[$index]\" show-report=\"showReport\"></conference-attendee-video></li></ul></div><conference-user-control-bar show-invitation=\"showInvitation\" on-leave=\"onLeave\" conference-state=\"conferenceState\"></conference-user-control-bar></div>");
  $templateCache.put("templates/invite-members.jade",
    "<div class=\"aside\"><div class=\"aside-dialog\"><div class=\"aside-content\"><div class=\"aside-header\"><h4>Members</h4></div><div class=\"aside-body\"><div ng-repeat=\"user in users\" class=\"row\"><conference-attendee></conference-attendee></div></div></div></div></div>");
  $templateCache.put("templates/live.jade",
    "<div class=\"col-xs-12\"><conference-video easyrtc=\"easyrtc\"></conference-video><conference-notification conference-id=\"{{conference._id}}\"></conference-notification></div>");
  $templateCache.put("templates/mobile-user-video-quadrant-control.jade",
    "<ul class=\"list-inline mobile-user-video-control\"><li><a href=\"\" ng-click=\"mute()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-5x fa-fw\"></i></a></li><li><a href=\"\" ng-click=\"onMobileToggleControls()\"><i class=\"fa fa-5x fa-fw fa-times\"></i></a></li><li><a href=\"\" ng-click=\"showReportPopup()\"><i class=\"fa fa-5x fa-fw fa-exclamation-triangle\"></i></a></li></ul>");
  $templateCache.put("templates/user-control-bar.jade",
    "<div class=\"conference-user-control-bar text-center\"><ul class=\"list-inline\"><li><a href=\"\" ng-click=\"showInvitationPanel()\"><i class=\"fa fa-users fa-2x conference-toggle-invite-button conference-light-button\"></i></a></li><li ng-class=\"{'hidden': noVideo}\"><a href=\"\" ng-click=\"toggleCamera()\"><i ng-class=\"{'fa-eye': !videoMuted, 'fa-eye-slash': videoMuted}\" class=\"fa fa-2x conference-toggle-video-button conference-light-button\"></i></a></li><li><a href=\"\" ng-click=\"toggleSound()\"><i ng-class=\"{'fa-microphone': !muted, 'fa-microphone-slash': muted}\" class=\"fa fa-2x conference-mute-button conference-light-button\"></i></a></li><li><a href=\"\" ng-click=\"leaveConference()\"><i class=\"fa fa-phone fa-2x conference-toggle-terminate-call-button conference-light-button\"></i></a></li><editor-toggle-element></editor-toggle-element><chat-toggle-element></chat-toggle-element></ul></div>");
  $templateCache.put("templates/user-video.jade",
    "<div ng-mouseenter=\"thumbhover = true\" ng-mouseleave=\"thumbhover = false\" class=\"user-video\"><canvas smart-fit from=\"#multiparty-conference\" preserve=\".conference-attendees-bar\" id=\"mainVideoCanvas\" ng-click=\"onMobileToggleControls()\" class=\"conference-main-video-multi\"></canvas></div>");
}]);
