var builder = require('botbuilder');
var restify = require('restify');

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

intents.matches('greeting', function (session) {

});

intents.matches('sell', [

]);

// has user given product name?
bot.dialog('/product', [
    function (session) {

    }
    // do we have product in database?
]);

intents.onDefault(builder.DialogAction.send("I'm sorry I didn't understand/ je ne comprends pas."));


// Jenni's dialogs
// Note that "session.dialogData.productName" needs to be replaced with values from the database

// Add something to deal with users sending a freetext message instead of picking from the options
dialog('sell', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    session.send("Sure thing! How can I help you?");
    
    // Jenni's semi-successful semi-failure of an attempt to build in some logic for dealing with lack of entities and lack of database matches
    /*function (session) {
        if ('no item name extracted, there is already something fetched from database') {
            builder.Prompts.choice(session, "Sure thing! Would you still like to talk about your %s or do you have something else you'd like to sell?", ["%s", "Something else"], session.dialogData.productName);
        }
        else if ('no item name extracted, nothing fetched from database') {
            builder.Prompts.text(session, "Sure thing! What would you like to sell?");
        }
        else if ('item name extracted, can be found in database') {
            session.send("Sure thing! How can I help you?");
            // exit this dialog
        }
        else {
            session.send("Sorry, I don't have information about that item.");
            // exit this dialog
        }  
    },
    function (session, results) {
        if (results.response && results.response.entity == dialogData.productName) {
            session.send("How can I help you?");
        } 
        else if (results.response && results.response.entity == "Something else") {
            builder.Prompts.text(session, "Sure thing! What would you like to sell?");
        }
        else {
            
        }
    }*/
]);

dialog('price_check', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        session.send("The item is currently being sold in the range of %s-%s eur and the average price is %s.", session.dialogData.productName);
    }
]);


dialog('ask_help_description', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        session.send("Here are the typical keywords others are using in their ads: %s", session.dialogData.productName);
    }
]);


dialog('current_time_check', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
    function (session) {
        if ('no peak time data available') {
            session.send("Sorry, I couldn't find enough sales data for this item. It's probably new or rare :)");
        }
        else if ('current month is not peak month or non peak month') {
            if ('there is one peak month'){
                session.send("Now is not a bad time to sell, but %s would be even better.", session.dialogData.productName);
            }
            else {
                session.send("Now is not a bad time to sell, but %s and %s would be better.", session.dialogData.productName);
            }
        }
        else if ('current month is peak month') {
            session.send("Hmm, it looks like a lot of people are selling it right now. There would be less competition in %s.", session.dialogData.productName);
        }
        else if ('current month is non peak month') {
            session.send("Now would be a great time to sell, there's less competition than usually!", session.dialogData.productName);
        }
        else {
            session.send("Hmm, that didn't work. Could I help you with something else?");
        }
    }
]);


dialog('q_optimal_time', [
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
dialog('end', [
    // insert logic for checking if there's an entity and checking if we can fetch something from the database
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


