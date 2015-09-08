var storage = require('node-persist');
var q       = require('kew');
var random  = require('./random');
var Slack   = require('slack-node');

var CONFIG = require('./config');

var slack = new Slack(CONFIG.SLACK_TOKEN);

var CHANNEL;
var USERS;

/**
 * @param {string} apiString
 * @param {object} data
 * @returns {!Promise}
 */
function requestSlackAPI(apiString, data) {
    var deferred = q.defer();

    slack.api(
        apiString,
        data,
        function (err, res) {
            if (err) {
                deferred.reject({
                    err : err,
                    res : res
                });
            } else {
                deferred.resolve(res);
            }
        });

    return deferred;
}

// API interface

function chatPostMessage(text) {
    var message = {
        text     : '```\n' + text + '\n```',
        channel  : CHANNEL,
        username : CONFIG.BOT_NAME
    };

    return requestSlackAPI('chat.postMessage', message);
}

function chatPostMessageAttachment(text, attachment) {
    var message = {
        text        : text,
        attachments : JSON.stringify([attachment]),
        channel     : CHANNEL,
        username    : CONFIG.BOT_NAME
    };

    return requestSlackAPI('chat.postMessage', message);
}

function channelsList() {
    return requestSlackAPI('channels.list', {});
}

function channelsHistory(count) {
    return requestSlackAPI('channels.history', { channel : CHANNEL, count : count });
}

function usersList() {
    return requestSlackAPI('users.list');
}

// API response transforms

function getUserNameById(id) {
    var theUser = USERS.filter(function (user) { return id === user.id; })[0];
    if (theUser) {
        return theUser.name;
    }
}

function getChannelIdByName(name) {
    return channelsList()
        .then(function (res) {
            return res.channels
                .map(function (channel) {
                    return channel.name === name ? channel : null;
                })
                .filter(Boolean)[0].id;
        });
}

var persisted = null;

function initStorage() {
    var persisted_defaults = {
        timestamp : 0
    };

    storage.initSync();

    persisted = storage.getItem('persisted') || persisted_defaults;

    return q.resolve(true);
}

var theWord = '';

/**
 * Dictionary of reactions: keys are the Regexes and the values are reaction functions.
 */
var TRIGGERS = [
    {
        example : 'gimme an A',
        regex   : /gimme an* [A-z].*/gi,
        react   : function (msg) {
            var theLetter = msg.text
                .replace(/^gimme an* /gi, '')
                .match(/^[A-z]/gi)[0];

            theLetter = theLetter.toUpperCase();

            theWord += theLetter;

            return chatPostMessage(theLetter + random.exclamation());
        }
    },
    {
        example : 'what does that spell',
        regex   : /^what (does that (say|spell)|do you get).*/gi,
        react   : function () {
            var oldWord = theWord;
            theWord     = '';
            return chatPostMessage(oldWord + random.exclamation());
        }
    }
];

/** @param {Object[]} messages */
function reactToTriggers(messages) {
    var reactions = '';
    var dateString;

    messages.forEach(function (msg) {
        TRIGGERS.forEach(function matchAndReact(trigger) {
            if (trigger.regex.test(msg.text)) {
                reactions += '!';
                trigger
                    .react(msg)
                    .fail(console.log.bind(console, '[ERROR]  '));
            }
        });
    });

    if (messages.length) {
        dateString = (new Date()).toLocaleString();
        console.log(messages.length + ' incoming message(s) on ' + dateString + reactions);
    }

}

function botLoop() {
    return channelsHistory(10)
        .then(function (res) {
            var latest = res.messages.filter(function (msg) {
                return (
                    parseFloat(msg.ts) > persisted.timestamp &&
                    msg.subtype !== 'bot_message'
                );
            });
            if (latest[0]) {
                persisted.timestamp = parseFloat(latest[0].ts);
            }
            storage.setItem('persisted', persisted);

            latest = latest.map(function (msg) {
                return {
                    text : msg.text,
                    id   : msg.user
                };
            });

            return latest;
        })
        .then(reactToTriggers);
}

// Bot entry-point
initStorage()
    .then(getChannelIdByName.bind(null, CONFIG.CHANNEL_TO_JOIN))
    .then(function setChannel(channelId) {
        CHANNEL = channelId;
    })
    .then(usersList)
    .then(function (res) {
        USERS = res.members;
    })
    .then(chatPostMessage.bind(
        null,
        CONFIG.BOT_NAME + ' has entered the building'
    ))
    .then(function () {
        console.log('Connected to Slack...');
        setInterval(botLoop, CONFIG.POLL_INTERVAL);
    });

function onExit() {
    chatPostMessage(CONFIG.BOT_NAME + ' has left the building')
        .then(process.exit.bind(process));
}

// Listen for Ctrl + C event
process.on('SIGINT', onExit);