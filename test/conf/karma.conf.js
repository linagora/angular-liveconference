'use strict';

module.exports = function(config) {
  config.set({
    basePath: '../../',

    files: [
      'test/conf/phantom-bind-polyfill.js',
      'bower_components/jquery/dist/jquery.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-route/angular-route.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/underscore/underscore.js',
      'bower_components/restangular/dist/restangular.js',
      'bower_components/chai/chai.js',
      'bower_components/angular-sanitize/angular-sanitize.min.js',
      'test/module.js',
      'src/**/*.js',
      'test/**/*.js',

      // fixtures
      'test/fixtures/**'
    ],

    frameworks: ['mocha'],
    colors: true,
    singleRun: true,
    autoWatch: true,
    browsers: ['PhantomJS', 'Chrome', 'Firefox'],
    reporters: ['coverage', 'spec'],
    preprocessors: {
      'frontend/js/**/*.js': ['coverage']
    },

    plugins: [
      'karma-phantomjs-launcher',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-coverage',
      'karma-spec-reporter'
    ],

    junitReporter: {
      outputFile: 'test_out/unit.xml',
      suite: 'unit-frontend'
    },

    coverageReporter: {type: 'text', dir: '/tmp'}
  });
};
