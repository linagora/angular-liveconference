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
