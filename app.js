var builder = require('botbuilder');
var restify = require('restify');
var request = require('request');

var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

// Connection URL
var url = 'mongodb://localhost:27017/ebay-k';
var ebayDb;
// Use connect method to connect to the server
MongoClient.connect(url, function (err, db) {
    assert.equal(null, err);
    ebayDb = db;
});


//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());


var model = 'https://api.projectoxford.ai/luis/v2.0/apps/fddcc5a7-1631-470a-ab6c-4eb224d7678d?subscription-key=0f3140ca7abd4016920f59de748262b7&verbose=true';
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({recognizers: [recognizer]});
bot.dialog('/', intents);


//=========================================================
// Bots Dialogs
//=========================================================

productNameCheck = [
    function (session, args, next) {
        // Resolve product name entity from LUIS
        var productName = builder.EntityRecognizer.findEntity(args.entities, 'item_name');

        if (productName) {
            session.dialogData.productName = productName.entity;
            next();
        } else if (!session.dialogData.productName) {
            // Prompt for product name if not resolved
            builder.Prompts.text(session, "What's the product you would like to sell?");
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            // If user was prompted, set productName with user response
            session.dialogData.productName = results.response;
        }

        ebayDb.collection('product_info').findOne({name: session.dialogData.productName}, {}, function (err, doc) {
            if (!doc) {
                session.endDialog("Sorry, I don't know much about \"%s\". Would you like to try with another item?",
                    session.dialogData.productName);
            } else {
                session.dialogData.product = doc;
                next();
            }
        });
    }
];


intents.matches('greeting', [
    function (session) {
        session.send(['Ahoy there!', 'Hi!', 'Hello!']);
        session.send("How can I help you?");
    }
]);


intents.matches('sell', productNameCheck.concat([
    function (session) {
        session.send("Sure thing! How can I help you?");
    }
]));


intents.matches('price_check',
    productNameCheck.concat([
        function (session) {
            session.send("The item is currently being sold in the range of %s-%s eur and the average price is %s.",
                session.dialogData.product['min_price'], session.dialogData.product['max_price'],
                session.dialogData.product['avg_price']);
        }
    ]));


intents.matches('help_description', productNameCheck.concat([
    function (session) {
        session.send("Here are the typical keywords others are using in their ads: %s",
            session.dialogData.product.keywords.join(', '));
    },
    function (session) {
        builder.Prompts.choice(session, "Would you like me to have a look at your description?", ["Yes", "No"]);
    },
    function (session, results) {
    }
]));


intents.matches('q_current_time_optimal', productNameCheck.concat([
    function (session) {

        var monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        var currentMonth = monthNames[new Date().getMonth()];

        // if there's no peak time data
        if (session.dialogData.product.non_peak_months.length == 0) {
            session.send("Sorry, I couldn't find enough sales data for this item. It's probably new or rare :)");
        } else if (session.dialogData.product.non_peak_months.indexOf(currentMonth) == -1 &&
            session.dialogData.product.peak_months.indexOf(currentMonth) == -1) {
            // one peak month
            if (session.dialogData.product.non_peak_months.length == 1) {
                session.send("Now is not a bad time to sell, but %s would be even better.", session.dialogData.product.non_peak_months[0]);
            }
            // two or more peak months
            else {
                session.send("Now is not a bad time to sell, but %s and %s would be better.",
                    session.dialogData.product.non_peak_months[0], session.dialogData.product.non_peak_months[1])
            }
        }
        else if (session.dialogData.product.peak_months.indexOf(currentMonth) != -1) {
            session.send("Hmm, it looks like a lot of people are selling it right now. There would be less competition in %s.", session.dialogData.product.non_peak_months[0]);
        }
        else if (session.dialogData.product.non_peak_months.indexOf(currentMonth) != -1) {
            session.send("Now would be a great time to sell, there's less competition than usually!");
        }
    }
]));


intents.matches('q_optimal_time', productNameCheck.concat([
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        if (session.dialogData.product.non_peak_months.length == 0) {
            session.send("Sorry, I couldn't find enough sales data for this item. It's probably new or rare :)");
        } else if (session.dialogData.product.non_peak_months.length == 1) {
            session.send("%s would be the best month to sell this item.", session.dialogData.product.non_peak_months[0]);
        } else if (session.dialogData.product.non_peak_months.length == 2) {
            session.send("%s and %s would be the best months to sell this item.", session.dialogData.product.non_peak_months[0],
                session.dialogData.product.non_peak_months[1]);
        }
        else {
            var non_peak = session.dialogData.product.non_peak_months;
            session.send("%s and %s would be the best months to sell this item.",
                non_peak.slice(0, non_peak.length - 1).join(', '), non_peak[non_peak.length - 1]);
        }
    }
]));


// Add something to deal with users sending a freetext message instead of picking from the options
intents.matches('end', [
    function (session) {
        builder.Prompts.confirm(session, "Okay. Are you selling anything else?");
    },
    function (session, results) {
        if (results.response) {
            // clear the current conversation context
            session.send("Sure thing! How can I help you?");
        } else {
            session.send("Alright, let me know when you do. Talk to you later!");
        }
    }
]);


intents.matches('q_tutorial', [
    function (session) {
        session.send("I can help you figure out the right time to sell, the right price, and what to write in the description. Just go ahead and ask :)");
    }
]);


intents.matches('test', [
    function (session) {
        session.send("Yup, I'm operational. How can I help you?");
    }
]);


intents.matches('off_q_who', [
    function (session) {
        session.send("I'm Flex, and my job is to help you sell your stuff. How can I help you today?");
    }
]);


intents.matches('off_q_ai', [
    function (session) {
        session.send("I'm a bot, although I would love to be a human. How can I help you today?");
    }
]);


intents.onDefault(function (session) {
    session.send(['Say what?', 'I didn’t quite get that.', 'Sorry, I didn’t understand that.', 'I don’t get it, please rephrase :)']);
});
