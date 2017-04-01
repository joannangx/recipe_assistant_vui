//Heavily edited Reindeer Games

'use strict';

var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient();

//DB SET UP
var TABLE_NAME = "RecipeList",
 INGREDIENT_NAME = "IngredientsList",
 DIRECTION_NAME = "PrepDirections",
 RECIPE_NAME = "RecipeName";

exports.handler = function (event, context) {
    try {
        //console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // add any session init logic here
}

function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

    getWelcomeResponse(callback);
}

function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // handle yes/no intent after the user has been prompted
    if (session.attributes && session.attributes.userPromptedToContinue) {
        delete session.attributes.userPromptedToContinue;
        if ("AMAZON.NoIntent" === intentName) {
            handleFinishSessionRequest(intent, session, callback);
        } else if ("AMAZON.YesIntent" === intentName) {
            handleRepeatRequest(intent, session, callback);
        }
    }
    
        //******Set up Intents vvv *******
    if ("RecipeSearchIntent" === intentName) {
        handleRecipeSearch(intent, session, callback);
        //******Ingredient Intents vvv ********
    } else if ("IngredientRequestIntent" === intentName) {
        handleIngredientRequest(intent, session, callback);
    } else if ("IncrementalIngredientRequestIntent" === intentName) {
        handleIncrementIngredientRequest(intent, session, callback);
    } else if ("AllIngredientsRequestIntent" === intentName) {
        handleAllIngredientRequest(intent, session, callback);
        //******Directions Intents vvv ********
    } else if ("DirectionsRequestIntent" === intentName) {
        handleDirectionsRequest(intent, session, callback);
    } else if ("IncrementalDirectionsRequestIntent" === intentName) {
        handleIncrementDirectionsRequest(intent, session, callback);
    } else if ("AllDirectionsRequestIntent" === intentName) {
        handleAllDirectionsRequest(intent, session, callback);
        //******StartOver Intent vvv ********
    } else if ("RestartListIntent" === intentName) {
        handleRestartListRequest(intent, session, callback);
        //******Helper Intents vvv ********
    } else if ("AMAZON.StartOverIntent" === intentName) {
        restartRequest(callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        handleRepeatRequest(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        handleGetHelpRequest(intent, session, callback);
    } else if ("ExamplesIntent" === intentName) {
        handleExamplesRequest(intent, session, callback);
    }else if ("AMAZON.StopIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else if ("AMAZON.CancelIntent" === intentName) {
        restartRequest(callback);
    } else {
        throw "Invalid intent";
    }
}

function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

// ------- Skill specific business logic -------
var CARD_TITLE = "Recipe Assistant";

function getWelcomeResponse(callback) {
    var sessionAttributes = {},
        speechOutput = CARD_TITLE
            + ", what recipe would you like to make?";
            
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": null,
        "ingredientNumber": 0,
        "recipeNumber": 0,
        "recipe": {"Items" : []}
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function restartRequest(callback) {
    var sessionAttributes = {},
    speechOutput = "You're back to the start. What would you like to make?";
    
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": null,
        "ingredientNumber": 0,
        "recipeNumber": 0,
        "recipe": {"Items" : []}
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function searchRecipe(searchedRecipe) {
    var lowercase = searchedRecipe.toLowerCase(),
        uppercase = searchedRecipe.toUpperCase(),
        titlecase = toTitleCase(searchedRecipe, false),
        capitalizefirst = toTitleCase(searchedRecipe, true);
    var params = {
        ScanFilter: {
            "RecipeName": {
                ComparisonOperator: "IN",
                AttributeValueList: [searchedRecipe, lowercase, uppercase, titlecase],
            },
        },
        TableName: TABLE_NAME,
    };

    return docClient.scan(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log("GetItem succeeded:", data);
        }
    });
}

function handleRecipeSearch(intent, session, callback) {
    var speechOutput = "";
    var sessionAttributes = {};
    var recipeInfo;
    var recipeName = intent.slots.food.value;
    var response = searchRecipe(recipeName);

    response.on('success', function(response) {
        recipeInfo = response.data;
        if (recipeInfo.Items.length === 0) {
            var reprompt = session.attributes.speechOutput;
            speechOutput = "I couldn't find " + recipeName + ". ";
            callback(session.attributes,
                buildSpeechletResponse(CARD_TITLE, speechOutput, reprompt, false));
        } else {
            speechOutput += "Ok, I found " + recipeName;
            if (recipeInfo.Items[0][INGREDIENT_NAME]) {
                speechOutput += ". You will need: ";
                var ingredients = recipeInfo.Items[0][INGREDIENT_NAME].split("\n");
                for (var num = 0; num < ingredients.length; num++) {
                    if (num != ingredients.length - 1) {
                        speechOutput += ingredients[num] + ", ";
                    } else {
                        speechOutput += "and " + ingredients[num];
                    }
                }
                speechOutput += ". Do you need any of that repeated? Or are you ready for the preparation directions?"
            } else {
                speechOutput += ". I didn't find any ingredients. Are you ready for the preparation directions?";
            }

            sessionAttributes = {
                "speechOutput": speechOutput,
                "repromptText": speechOutput,
                "ingredientORdirection": "ingredient",
                "ingredientNumber": 0,
                "recipeNumber": 0,
                "recipe": recipeInfo
            };
            callback(sessionAttributes,
                buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
        }
    });
}

function handleIngredientRequest(intent, session, callback) {
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe,
        numberRequest;
    var intentName = intent.name;

    if (intentName === "RestartListIntent") {
        numberRequest = 0;
    } else {
        if (intent.slots.place.value) {
            numberRequest = intent.slots.place.value;
            numberRequest = numberRequest.slice(0,-2);
            numberRequest--;
        } else if (intent.slots.number.value) {
            numberRequest = intent.slots.number.value -1;
        } else {
            numberRequest = 0;
        }
    }

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
        numberRequest = 0;
    } else {
        var recipeIngredients = recipe.Items[0][INGREDIENT_NAME].split("\n");
        if (recipeIngredients == []) {
            speechOutput = "Sorry, there don't seem to be any ingredients for this recipe."
            numberRequest = 0;
        } else if (numberRequest >= recipeIngredients.length || numberRequest < 0) {
            speechOutput = "I'm sorry, I don't know what ingredient you're referring to"
            numberRequest = 0;
        } else {
            var ingredient = recipeIngredients[numberRequest];
            if (numberRequest === 0) {
                speechOutput = "The first ingredient is " + ingredient;
            } else {
                speechOutput = "Ok. You need " + ingredient;
            }
            numberRequest++;
            if (numberRequest >= recipeIngredients.length) numberRequest = 0;
        }
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "ingredient",
        "ingredientNumber": numberRequest,
        "recipeNumber": session.attributes.recipeNumber,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleIncrementIngredientRequest(intent, session, callback){
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe;

    var nextORlast = intent.slots.increment.value,
        numberRequest = session.attributes.ingredientNumber;
    var verb;

    if (nextORlast === "next" || nextORlast === "Next") {
        numberRequest++;
        verb = "is";
    } else if (nextORlast === "last" || nextORlast === "Last") {
        numberRequest--;
        verb = "was";
    }

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
        numberRequest = 0;
    } else {
        var recipeIngredients = recipe.Items[0][INGREDIENT_NAME].split("\n");
        if (recipeIngredients == []) {
            speechOutput = "Sorry, there don't seem to be any ingredients for this recipe.";
            numberRequest = 0;
        } else if (numberRequest > recipeIngredients.length) {
            speechOutput = "There are no more ingredients for this recipe. When you are ready for the recipe steps, please say 'start'";
        } else if (numberRequest < 0) {
            speechOutput = "Sorry, cannot find ingredient number " + numberRequest;
        } else if (numberRequest === 0 && nextORlast == "last") {
            speechOutput = "Sorry, there are no ingredients before the first ingredient.";
        } else {
            var ingredient = recipeIngredients[numberRequest-1];
            speechOutput = "The " + nextORlast + " ingredient " + verb + " " + ingredient;
            if (numberRequest == recipeIngredients.length) {
                speechOutput += ". That was the last ingredient. When you are ready for the recipe steps, please say 'start'"
            }
        }
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "ingredient",
        "ingredientNumber": numberRequest,
        "recipeNumber": session.attributes.recipeNumber,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleAllIngredientRequest(intent, session, callback){
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe,
    numberRequest = 0;

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
    } else {
        var recipeIngredients = recipe.Items[0][INGREDIENT_NAME].split("\n");
        if (recipeIngredients.length === 0) {
            speechOutput = "There doesn't seem to be any ingredients for this recipe.";
        } else {
            speechOutput = "Here are the ingredients: "
            for (var i = 0; i < recipeIngredients.length; i++) {
                if (i != recipeIngredients.length - 1) {
                    speechOutput += recipeIngredients[i] + ", ";
                } else {
                    speechOutput += "and " + recipeIngredients[i];
                }
            }
                speechOutput += ". Those are all the ingredients for " + recipe.Items[0]["RecipeName"]
                    + ". What would you like to do now?"
        }
    }
    
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "ingredient",
        "ingredientNumber": numberRequest,
        "recipeNumber": session.attributes.recipeNumber,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleDirectionsRequest(intent, session, callback){
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe,
        numberRequest = 0;
    var intentName = intent.name;

    if (intentName === "RestartListIntent") {
        numberRequest = 0;
    } else {
        if (intent.slots.place.value) {
            numberRequest = intent.slots.place.value;
            numberRequest = numberRequest.slice(0,-2);
            numberRequest--;
        } else if (intent.slots.number.value) {
            numberRequest = intent.slots.number.value -1;
        }  else {
            numberRequest = 0;
        }
    }

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
        numberRequest = 0;
    } else {
        var recipeDirections = recipe.Items[0][DIRECTION_NAME].split("\n");
        if (recipeDirections.length === 0) {
            speechOutput = "Sorry, there doesn't seem to be any directions for this recipe."
            numberRequest = 0;
        } else if (numberRequest >= recipeDirections.length || numberRequest < 0) {
            speechOutput = "I'm sorry. I'm not finding that direction."
            numberRequest = 0;
        } else {
            var direction = recipeDirections[numberRequest];
            if (numberRequest === 0) {
                speechOutput = "The first step is " + direction;
            } else {
                speechOutput = "Ok. You need " + direction;
            }
            numberRequest++;

            if (numberRequest >= recipeDirections.length) numberRequest = 0;
        }
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "direction",
        "ingredientNumber": session.attributes.ingredientNumber,
        "recipeNumber": numberRequest,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleIncrementDirectionsRequest(intent, session, callback) {
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe;

    var nextORlast = intent.slots.increment.value,
        numberRequest = session.attributes.recipeNumber;
    var verb;

    if (nextORlast === "next" || nextORlast === "Next") {
        numberRequest++;
        verb = "is";
    } else if (nextORlast === "last" || nextORlast === "Last") {
        numberRequest--;
        verb = "was";
    }

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
        numberRequest = 0;
    } else{
      var recipeDirections = recipe.Items[0][DIRECTION_NAME].split("\n");
       if (recipeDirections.length === 0) {
            speechOutput = "Sorry, there don't seem to be any directions for this recipe.";
            numberRequest = 0;
        } else if (numberRequest > recipeDirections.length) {
            speechOutput = "There are no more steps for this recipe."
        } else if (numberRequest < 0) {
            speechOutput = "Sorry, cannot find step number " + numberRequest;
        } else if (numberRequest === 0 && nextORlast == "last") {
            speechOutput = "Sorry, there is no step before the first step.";
        }
        else {
            var direction = recipeDirections[numberRequest-1];
            speechOutput = "The " + nextORlast + " step " + verb + " " + direction;
        }
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "direction",
        "ingredientNumber": session.attributes.ingredientNumber,
        "recipeNumber": numberRequest,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

/*Intent Handler
* Returns all of the ingredients
* sets ingredientNumber to 0
*/
function handleAllDirectionsRequest(intent, session, callback){
    var speechOutput = "";
    var sessionAttributes = {};
    var recipe = session.attributes.recipe,
        numberRequest = 0;

    if (recipe.Items.length === 0) {
        speechOutput = "I'm sorry I don't know what we are making.";
    } else {

    var recipeDirections = recipe.Items[0][DIRECTION_NAME].split("\n");
    if (recipeDirections.length === 0) {
        speechOutput = "There doesn't seem to be any directions for this recipe.";
    } else {
        speechOutput = "Here are the directions: "
        for (var i = 0; i < recipeDirections.length; i++) {
            if (i != recipeDirections.length - 1) {
                speechOutput += recipeDirections[i] + ", ";
            } else {
                speechOutput += "and " + recipeDirections[i];
            }
        }
        speechOutput += ". Those are all the directions for " + recipe.Items[0]["RecipeName"]
            + ". What would you like to do now?"
        }
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": speechOutput,
        "ingredientORdirection": "direction",
        "ingredientNumber": session.attributes.ingredientNumber,
        "recipeNumber": numberRequest,
        "recipe": recipe
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleRepeatRequest(intent, session, callback) {
  //if attributes haven't been set up repeat Welcome
  //else repeat the last thing said
    if (!session.attributes || !session.attributes.speechOutput) {
        getWelcomeResponse(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponse(CARD_TITLE, session.attributes.speechOutput, session.attributes.repromptText, false));
    }
}

function handleRestartListRequest(intent, session, callback) {
    if (session.attributes.ingredientORdirection == "ingredient") {
        handleIngredientRequest(intent, session, callback);
    } else if (session.attributes.ingredientORdirection == "direction") {
        handleDirectionsRequest(intent, session, callback);
    } else {
        var speechOutput = "Sorry, there is nothing to start over.";
        callback(session.attributes,
            buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
    }
}

function handleGetHelpRequest(intent, session, callback) {
    // Ensure that session.attributes has been initialized
    if (!session.attributes) {
        session.attributes = {};
    }
    var recipe = session.attributes.recipe,
      speechOutput;

    // Do not edit the help dialogue. This has been created by the Alexa team to demonstrate best practices.

    if (recipe) {
      speechOutput = "You are currently making " + recipe.Items[0][RECIPE_NAME] +
        ". Ask for directions or ingredients. We can also make something else if you'd like.";
    } else {
      speechOutput = "You aren't making anything right now. Let me know what you want to make!";
    }
        var shouldEndSession = false;
    callback(session.attributes,
        buildSpeechletResponseWithoutCard(speechOutput, "", shouldEndSession));
}

function handleExamplesRequest(intent,session,callback){
  var ingNum, dirNum,
    speechOutput = "You may tell me what you would like to make. " +
              "Then you can ask for the ingredients or directions, all at once, in series, or just a specific one. " +
              "Finally you can ask me to repeat myself, to quit or ask for more help.";

  session.attributes.speechOutput = speechOutput;

  callback(session.attributes,
      //buildSpeechletResponseWithoutCard(speechOutput, "", false));
      buildSpeechletResponse(CARD_TITLE, speechOutput, "", false));
}

function handleFinishSessionRequest(intent, session, callback) {
    // End the session with a "Good bye!" if the user wants to quit the game
    callback(session.attributes,
        //buildSpeechletResponseWithoutCard("Good bye!", "", true));
        buildSpeechletResponse(CARD_TITLE, "Good bye!", "", true));
}

// ------- Helper functions to build responses -------
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}

// ------- MISC. functions to build responses -------
function contains(arr, obj) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == obj) {
            return true;
        }
    }
    return false;
}

function toTitleCase(str, capitalizeAll) {
    var split = str.split(' '),
        dontCapitalize = [];

    if (!capitalizeAll) {
        dontCapitalize = ["and", "of", "the", "over", "in", "with"];
    }

    for (var i = 0; i < split.length; i++) {
        if (!contains(dontCapitalize, split[i].toLowerCase())) {
            split[i] = split[i].charAt(0).toUpperCase() + split[i].substring(1).toLowerCase();
        } else {
            split[i] = split[i].toLowerCase();
        }

    }
    return split.join(' ');
}