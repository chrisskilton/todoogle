var http = require('http');
var express = require('express');
var app = express();
var consolidate = require('consolidate');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var session = require('express-session');
var redis = require('redis');
var bodyParser = require('body-parser');
var args = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var config = fs.existsSync('./config.json') ? JSON.parse(fs.readFileSync('./config.json')) : {};

app.engine('html', consolidate.hogan);
app.set('view engine', 'html');

var server = http.createServer(app);

app.use(express.static(__dirname + '/public'));

app.use(bodyParser());

passport.use(new GoogleStrategy({
    callbackURL: (config.host || args.host) + '/auth/google/return',
    clientID: config.clientId || args.clientId,
    clientSecret: config.clientSecret || args.clientSecret,
    realm: config.host || args.host
}, function(accessToken, refreshToken, profile, done) {
    done(null, profile.id);
}));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.use(session({
    secret: 'my-google-auth-shiz'
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/logout', function(req, res) {
    req.logout();

    res.redirect('/login');
});

app.get('/login', function(req, res) {
    if(req.user) {
        req.logout();
    }

    res.render('login.html');
});

app.get('/auth/google', passport.authenticate('google', {
    scope: 'https://www.googleapis.com/auth/plus.login'
}));

app.get('/auth/google/return', passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

app.use(function(req, res, next) {
    if(!req.user) {
        return res.redirect('/login');
    }

    next();
});

app.get('/', function(req, res) {
    var client = redis.createClient();

    client.on('error', function(error) {
        console.log(error);
    });

    client.on('connect', function() {
        client.get(req.user, function(err, items) {
            try {
                items = JSON.parse(items);
            } catch(e) {
                items = [];
            }

            client.quit();

            res.render('index.html', {
                items: items
            });
        });
    });
});

app.post('/item', function(req, res) {
    var item = req.body.item;
    var client = redis.createClient();

    client.on('error', function(error) {
        console.log(error);
    });

    client.on('connect', function() {
        client.get(req.user, function(err, items) {
            try {
                items = JSON.parse(items) || [];
            } catch(e) {
                items = [];
            }

            items.push({
                name: item
            });

            client.set(req.user, JSON.stringify(items));

            client.quit();

            res.redirect('/');
        });
    });
});

server.listen(3000);