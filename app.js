/**
 * Module dependencies.
 */
var router  = require('./router');
var config  = require('./config').values;
var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express3-handlebars');
var app = express();

// add handlebars helper for passing json around
var hbs = handlebars.create();

// Configuration

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', path.join(__dirname, 'views'));
  app.engine('handlebars', hbs.engine);
  app.set('view engine', 'handlebars');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  app.use(express.cookieParser('Pirate Kings Secret Key'));
  app.use(express.session());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

/**
 * Configuration can come from the 'config.js' file
 * and from command line options. 
 * 
 * The --public option removes the 'localhost' reference
 * in the config file allowing remote hosts to connect.
 */

if (process.argv.indexOf('--public') > -1) {
    config.public = true;
}

if (config.public) {
        app.listen(config.port);
}
else {
        app.listen(config.port, config.host);
}

router.setup(app);

console.log("Express server listening on port %d in %s mode", 
	    config.port, app.settings.env);
