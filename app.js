var builder = require('botbuilder');
var restify = require('restify');

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


// var model = '<your models url>';
// var recognizer = new builder.LuisRecognizer(model);
// var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
// bot.dialog('/', dialog);


//=========================================================
// Bots Dialogs
//=========================================================

var intents = new builder.IntentDialog();
bot.dialog('/', intents);


productNameCheck = [
    function (session, args, next) {
        // Resolve product name entity from LUIS
        session.dialogData.productName = builder.EntityRecognizer.findEntity(args.entities, 'productName');

        if (!session.dialogData.productName) {
            // Prompt for product name if not resolved
            builder.Prompts.text(session, "What's the product you would like to sell?");
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            // If user was prompted, set productName with user response
            session.dialogData.productName = results.response;
        }
        // Do we have product in DB?
        var product = ebayDb.collection('product-info').findOne({name: session.dialogData.productName});
        if (!product)
            builder.Prompts.text(session, "Sorry, I don't know much about \"%s\". Would you like to try with another item?");
        else
            session.dialogData.product = product;
    }
];


intents.matches('greeting', [
    function (session) {
        session.send("Ahoy there! How can I help you?");
    }
]);


// Note that "session.dialogData.productName" needs to be replaced with values from the database

intents.matches('sell', productNameCheck.concat([
    function (session) {
        session.send("Sure thing! How can I help you?");
    }
]));


intents.matches('price_check', productNameCheck.concat([
    function (session) {
        session.send("The item is currently being sold in the range of %s-%s eur and the average price is %s.",
            session.dialogData.product['min_price'], session.dialogData.product['max_price'],
            session.dialogData.product['avg_price']);
    }
]));


intents.matches('help_description', productNameCheck.concat([
    function (session) {
        session.send("Here are the typical keywords others are using in their ads: %s",
            session.dialogData.product.keywords.join(', ');
    }
]));


intents.matches('q_current_time_optimal', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        if ('no peak time data available') {
            session.send("Sorry, I couldn't find enough sales data for this item. It's probably new or rare :)");
        }
        else if ('current month is not peak month or non peak month') {
            if ('there is one peak month') {
                session.send("Now is not a bad time to sell, but %s would be even better.", session.dialogData.product.non_peak_months[0]);
            }
            else {
                session.send("Now is not a bad time to sell, but %s and %s would be better.", session.dialogData.product.non_peak_months[0], session.dialogData.product.non_peak_months[1]);
            }
        }
        else if ('current month is peak month') {
            session.send("Hmm, it looks like a lot of people are selling it right now. There would be less competition in %s.", session.dialogData.product.non_peak_months[0]);
        }
        else if ('current month is non peak month') {
            session.send("Now would be a great time to sell, there's less competition than usually!");
        }
        else {
            session.send("Hmm, that didn't work. Could I help you with something else?");
        }
    }
]);


intents.matches('q_optimal_time', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        if ('one non-peak month') {
            session.send("%s would be the best month to sell this item.", session.dialogData.productName);
        }
        else {
            session.send("%s and %s would be the best months to sell this item.", session.dialogData.productName);
        }
    }
]);


// Add something to deal with users sending a freetext message instead of picking from the options
intents.matches('end', [
    function (session) {
        builder.Prompts.choice(session, "Okay. Are you selling anything else?", ["Yes", "No"]);
    },
    function (session, results) {
        if (results.response && results.response.entity == 'Yes') {
            // clear the current conversation context
            session.beginDialog('sell');
        } else {
            session.send("Alright, let me know when you do. Talk to you later!");
        }
    }
]);


intents.matches(/.*sell\s(.*)/i, [
    function (session, results) {
        session.dialogData.productName = results.matched[1];

        ebayDb.collection('product_info').findOne({name: session.dialogData.productName}, {}, function (err, doc) {
            if (!doc)
                session.send("Sorry, I don't know much about \"%s\". Would you like to try with another item?",
                    session.dialogData.productName);
            else {
                session.dialogData.product = doc;
                session.send("%s", session.dialogData.product.keywords.join(', '));
            }
        });
    }
]);



dialog('q_tutorial', [
    function (session) {
        session.send("I can help you figure out the right time to sell, the right price, and what to write in the description. Just go ahead and ask :)");
    }
]);


dialog('test', [
    function (session) {
        session.send("Yup, I'm operational. How can I help you?");
    }
]);


dialog('off_q_who', [
    function (session) {
        session.send("I'm Flex, and my job is to help you sell your stuff. How can I help you today?");
    }
]);


dialog('off_q_ai', [
    function (session) {
        session.send("I'm a bot, although I would love to be a human. How can I help you today?");
    }
]);



intents.onDefault(builder.DialogAction.send("Say what?"));
