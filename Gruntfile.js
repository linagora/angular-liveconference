'use strict';

/* eslint-disable no-process-env, no-console */

module.exports = function(grunt) {
  var testArgs = (function() {
    var opts = ['test', 'chunk'];
    var args = {};
    opts.forEach(function(optName) {
      var opt = grunt.option(optName);
      if (opt) {
        args[optName] = '' + opt;
      }
    });
    return args;
  })();

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ''
      },
      dist: {
        src: ['node_modules/hark/hark.bundle.js', 'src/js/**/*.js'],
        dest: 'dist/live-conference.all.js'
      }
    },
    html2js: {
      options: {
        module: 'op.liveconference-templates',
        singleModule: true,
        useStrict: true,
        jade: {
          doctype: 'html'
        }
      },
      main: {
        src: ['src/templates/*.jade'],
        dest: 'src/js/templates.js'
      }
    },
    eslint: {
      all: {
        src: [
          'Gruntfile.js',
          'Gruntfile-tests.js',
          'test/**/**/*.js',
          'src/**/*.js'
        ]
      },
      quick: {
        src: [],
        options: {
          quiet: true
        }
      },
      options: {
        quiet: true
      }
    },
    lint_pattern: {
      options: {
        rules: [
          { pattern: /(describe|it)\.only/, message: 'Must not use .only in tests' }
        ]
      },
      all: {
        src: ['<%= eslint.all.src %>']
      },
      quick: {
        src: ['<%= eslint.quick.src %>']
      }
    },
    run_grunt: {
      all: {
        options: {
          log: true,
          stdout: function(data) {
            grunt.log.write(data);
          },
          stderr: function(data) {
            grunt.log.error(data);
          },
          args: testArgs,
          process: function(res) {
            if (res.fail) {
              grunt.config.set('esn.tests.success', false);
              grunt.log.writeln('failed');
            } else {
              grunt.config.set('esn.tests.success', true);
              grunt.log.writeln('succeeded');
            }
          }
        },
        src: ['Gruntfile-tests.js']
      },
      frontend: {
        options: {
          log: true,
          stdout: function(data) {
            grunt.log.write(data);
          },
          stderr: function(data) {
            grunt.log.error(data);
          },
          process: function(res) {
            if (res.fail) {
              grunt.config.set('esn.tests.success', false);
              grunt.log.writeln('failed');
            } else {
              grunt.config.set('esn.tests.success', true);
              grunt.log.writeln('succeeded');
            }
          },
          task: ['test-frontend']
        },
        src: ['Gruntfile-tests.js']
      }
    },
    watch: {
      files: ['src/templates/*.jade', 'src/js/*.js'],
      tasks: ['compile']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-html2js');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('@linagora/grunt-lint-pattern');
  grunt.loadNpmTasks('@linagora/grunt-run-grunt');

  grunt.loadTasks('tasks');

  grunt.registerTask('test-frontend', ['run_grunt:frontend']);
  grunt.registerTask('test', ['linters', 'run_grunt:frontend']);
  grunt.registerTask('linters', 'Check code for lint', ['eslint:all', 'lint_pattern']);
  grunt.registerTask('templates', ['html2js']);

  /**
   * Usage:
   *   grunt linters-dev              # Run linters against files changed in git
   *   grunt linters-dev -r 51c1b6f   # Run linters against a specific changeset
   */
  grunt.registerTask('linters-dev', 'Check changed files for lint', ['prepare-quick-lint', 'eslint:quick', 'lint_pattern:quick']);

  grunt.registerTask('default', ['templates', 'linters', 'test-frontend', 'concat:dist']);
  grunt.registerTask('compile', ['templates', 'concat:dist']);
};
