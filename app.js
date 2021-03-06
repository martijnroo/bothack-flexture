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


server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'index.html'
}));


var model = 'https://api.projectoxford.ai/luis/v2.0/apps/fddcc5a7-1631-470a-ab6c-4eb224d7678d?subscription-key=0f3140ca7abd4016920f59de748262b7&verbose=true';
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({recognizers: [recognizer]});
bot.dialog('/', intents);

var azureDataMarketClientId = process.env.AZURE_MARKET_ID;
var azureDataMarketClientSecret = process.env.AZURE_MARKET_SECRET;
var speechTranslateUrl = 'wss://dev.microsofttranslator.com/text/translate?api-version=1.0&from=en&to=de';


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
        session.send("Alright, I'm happy to help! %s other people are also selling that right now.", session.dialogData.product.no_of_ads);
        session.send("What would you like to know?");
    }
]));


// for medium confidence rate: "Would you like to get a pricecheck for 'item'?"
intents.matches('price_check',
    productNameCheck.concat([
        function (session) {
            session.send("The item is currently being sold in the range of %s-%s eur and the average price is %s.",
                session.dialogData.product['min_price'], session.dialogData.product['max_price'],
                session.dialogData.product['avg_price']);
        }
    ]));

// Add something to deal with users sending a freetext message instead of picking from the options
// for medium confidence rate: "Would you like me to help you with your item description?"
intents.matches('help_description', productNameCheck.concat([
    function (session) {
        session.send("Here are the typical keywords others are using in their ads: %s",
            session.dialogData.product.keywords.join(', '));
        builder.Prompts.confirm(session, "Would you like me to have a look at your description?");
    },
    function (session, results) {
        if (results.response) {
            builder.Prompts.text(session, "Alright then, just write it to the text box and send it to me :)");
        } else {
            session.endDialog("Alright, no problem. What else can I help you with?");
        }
    },
    function (session, results) {
        var options = {
            url: 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/languages',
            headers: {
                'Host': 'westus.api.cognitive.microsoft.com',
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': 'ef87e866137b4f4083f825a609420920'
            },
            json: true,
            body: {
                "documents": [
                    {
                        "id": "string",
                        "text": results.response,
                        "numberOfLanguagesToDetect": 1
                    }
                ]
            }
        };
        // call the language detection API
        request.post(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(JSON.stringify(body));

                var language = body.documents[0].detectedLanguages[0].name;


                if (language == "English") {
                    session.send("Pro tip: In addition to %s, it would be a great idea to translate it to German as well :)", language);
//                     var options = {
//                         url: 'https://api.cognitive.microsoft.com/bing/v5.0/spellcheck/?mode=proof&mkt=en-us',
//                         headers: {
//                             'Host': 'api.cognitive.microsoft.com',
//                             'Content-Type': 'application/x-www-form-urlencoded',
//                             'Ocp-Apim-Subscription-Key': '0bef649434b542cba1d3053f36910e91'
//                         },
//                         body: "Text=" + results.response
//                     };
//
//                     request.post(options, function (error, response, body) {
//                         if (!error && response.statusCode == 200) {
//                             console.log(JSON.stringify(body));
//                             // if there were corrections
//                             if (body.flaggedTokens) {
//                                 session.send("I caught some spelling errors, here's the corrected text:");
//                                 var correctedText = correctText(results.response, body.flaggedTokens);
//                                 session.send('"%s"', correctedText);
//                             } else {
//                                 // if there weren't corrections
//                                 session.send("Looks good!");
//                             }
//                             builder.Prompts.confirm(session, "It would be a great idea to also have that in German, so I translated it for you. Wanna see? :)");
//                         }
//                     });
                } else if (language == "German") {
                    session.send("Looks good! Just keep those keywords in mind and take a few good pictures of the item, and you're all set :)");
                } else {
                    // languages other than English and German
                    session.send("Pro tip: instead of %s, it would be a great idea to translate it to German :)", language);
                }
            }
            session.send("Can I help you with anything else?");
            // else {
            //     session.send("Oops, something exploded! Can I help you with anything else?");
            // }
        })
        ;
    }
// // calling the translation API if the user wanted to
//     function (session, results) {
//         if (results.response) {
//             session.send("Here you go!");
//
//             // get Azure Data Market Access Token
//             // request.post(
//             //     'https://datamarket.accesscontrol.windows.net/v2/OAuth2-13',
//             //     {
//             //         form : {
//             //             grant_type : 'client_credentials',
//             //             client_id : azureDataMarketClientId,
//             //             client_secret : azureDataMarketClientSecret,
//             //             scope : 'http://api.microsofttranslator.com'
//             //         }
//             //     },
//             //
//             //     // once we get the access token, we hook up the necessary websocket events for sending audio and processing the response
//             //     function (error, response, body) {
//             //         if (!error && response.statusCode == 200) {
//             //
//             //             // parse and get the acces token
//             //             var accessToken = JSON.parse(body).access_token;
//             //
//             //
//             //             session.send('"%s"', translatedText);
//             //         }
//             //     }
//             // );
//         }
//         else {
//             session.send("Okay, no problem.");
//         }
//         builder.Prompts.confirm(session, "Would you like to hear some more tips for optimising your ad?");
//     }
]));


// For medium confidence rate: "Do you want to know if now is a good time to sell?"
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


// For medium confidence rate: "Do you want to know when would be a good time to sell?"
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

intents.matches('acknowledgement', [
    function (session) {
        session.send("Glad you like it :) Can I help you with anything else?");
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

intents.matches('insult', [
    function (session) {
        session.send("Aww :(");
    }
]);


intents.onDefault(function (session) {
    session.send(['Say what?', 'I didn’t quite get that.', 'Sorry, I didn’t understand that.', 'I don’t get it, please rephrase :)']);
});


function correctText(original, mistakes) {
    return original;
}
