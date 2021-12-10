const qs = require('qs')
const parseJson = require('parse-json')
const AWS = require('aws-sdk')
const {v4: uuidv4} = require("uuid");


exports.handler = async (event) => {
    console.log('Request event: ', event);
    
    let eventType = event.event.type;
    let eventSubtype = undefined;
    if(event.event.hasOwnProperty('subtype')){
        eventSubtype = event.event.subtype;
    }
    var stepfunctions = new AWS.StepFunctions();
    
    if(event.hasOwnProperty('event')) { 
        // Coming from Slack events API
        let eventType = event.event.type;
        let eventSubtype = undefined;
        if(event.event.hasOwnProperty('subtype')){
            eventSubtype = event.event.subtype;
        }
        
        if(eventType === 'message' && eventSubtype === undefined) {
            // New message posted in Slack
            
        } else {
            // App added to channel
            let params = {
                stateMachineArn: 'arn:aws:states:us-east-2:579534454884:execution:App-Added-Flow:b42ed7f5-8e1a-8e79-b036-df07a38654b8',
                input: JSON.stringify({})
            }
            
            stepfunctions.startExecution(params, function (err, data) {
                if(err) {
                    console.log("error starting step function");
                    console.log(err);
                } else {
                    console.log("step function started")
                }
            });
        }
    } else {
        // Not coming from Slack events API
        let body = parseJson(qs.parse(event.body).payload)
        if(body.type === 'block_actions') {
            // Button was pressed
            let actionID = body.actions[0].action_id;

            if(actionID.includes('dismiss')) {
                // Dismiss button pressed
                
            } else if (actionID.includes('nothelpful')) {
                // Not Helpful button pressed
                
            } else {
                // Helpful button pressed
            }
            
        } else {
            // Answer was marked
        }
    }
    return buildResponse(200, event);
};

function buildResponse(statusCode, event) {
    if(event.hasOwnProperty('challenge')){
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
            challenge: event.challenge
        }
    } else{
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
        }
    }
}
