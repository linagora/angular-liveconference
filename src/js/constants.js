'use strict';

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
  });
