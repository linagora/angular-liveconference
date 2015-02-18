# OpenPaas Angular Live Conference

## Installation

1. clone the repository

        git clone https://ci.open-paas.org/stash/scm/opangmod/angular-liveconference.git

2. install node.js

3. install the npm dependencies

        npm install -g mocha grunt-cli bower karma-cli
    
4. install the gjslint dependency

        easy_install http://closure-linter.googlecode.com/files/closure_linter-latest.tar.gz

    more informations [can be found here](https://developers.google.com/closure/utilities/docs/linter_howto)
    
5. Go into the project directory and install project dependencies

        npm install
        bower install

## Testing

You can check that everything works by launching the test suite:

    grunt

Some specialized Grunt tasks are available :

    grunt linters # launch hinter and linter against the codebase
    grunt test-frontend # only run the fontend unit tests
    grunt test # launch all the testsuite

Licence
-------

[Affero GPL v3](http://www.gnu.org/licenses/agpl-3.0.html)
