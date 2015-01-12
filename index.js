/*jshint node:true */

'use strict';

var gutil = require('gulp-util');
var es = require('event-stream');
var extend = require('xtend');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var tmp = require('tmp');

var karmaPlugin = function(options) {
  var child;
  var stream;
  var files = [];

  options = extend({
    action: 'run'
  }, options);

  var action = options.action;

  // Remove option in case Karma uses it in the future
  delete options.action;

  if (action === 'watch') {
    // Never set singleRun in background mode
    options.singleRun = false;

    // Enable watching
    options.autoWatch = true;
  }
  else if (action === 'run') {
    // Tell Karma to run once and exit
    options.singleRun = true;

    // Disable watching
    options.autoWatch = false;
  }

  if (options.configFile) {
    options.configFile = path.resolve(options.configFile);
  }

  function done(code) {
    // Stop the server if it's running
    if (child) {
      child.kill();
    }

    // End the stream if it exists
    if (stream) {
      if (code) {
        stream.emit('error', new gutil.PluginError('gulp-karma', 'karma exited with code ' + code));
      }
      else {
        stream.emit('end');
      }
    }
  }

  function startKarmaServer() {
    gutil.log('Starting Karma server...');
    // Run Karma from the same instance of node that was used to start the process
    var nodePath = process.execPath;

    // Write to temp file to avoid ENAMETOOLONG error with large `options` input
    tmp.setGracefulCleanup();
    tmp.file(function _tempFileCreated(err, tmpPath, fd, cleanupCallback) {
      if (err) throw err;
      fs.writeFile(tmpPath, JSON.stringify(options), function (err) {
        if (err) throw err;
      });

      // Start the server
      child = spawn(
        nodePath,
        [
          path.join(__dirname, 'lib', 'background.js'),
          tmpPath
        ],
        {
          stdio: 'inherit'
        }
      );

      // Cleanup when the child process exits
      child.on('exit', function(code) {
        // gutil.log('Karma child process ended');
        cleanupCallback();
        done(code);
      });
    });
  }

  function queueFile(file) {
    if (file) {
      // gutil.log('Queueing file '+file.path);
      files.push(file.path);
    }
    else {
      stream.emit('error', new Error('Got undefined file'));
    }
  }

  function endStream() {
    // Override files if they were piped
    // This doesn't work with the runner, but works fine with singleRun and autoWatch
    if (files.length) {
      options.files = files;
    }

    // Start the server
    // If options.singleRun: Server starts, tests run, task completes
    // If options.background: Server starts, tests run, files watched
    startKarmaServer();
  }

  stream = es.through(queueFile, endStream);

  return stream;
};

module.exports = karmaPlugin;
