'use strict';

angular.module('op.live-conference')
  .factory('attendeeColorsService', ['MAX_ATTENDEES', function(MAX_ATTENDEES) {
    var colors = [
      '#F44336',
      '#9C27B0',
      '#673AB7',
      '#2196F3',
      '#00968',
      '#CDDC39',
      '#FFEB3B',
      '#FF9800',
      '#4CAF50'
    ];

    function getColorForAttendeeAtIndex(index) {
      return colors[index % MAX_ATTENDEES];
    }

    return {
      getColorForAttendeeAtIndex: getColorForAttendeeAtIndex
    };
  }]);
