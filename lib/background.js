var fs     = require('fs');
var server = require('karma').server;

fs.readFile(process.argv[2], function (err, optionsData) {
  if(err) throw err;
  server.start(JSON.parse(optionsData));
});
