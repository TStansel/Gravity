const qs = require("qs");
const parseJson = require("parse-json");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

exports.handler = async (event) => {
  console.log("Request event: ", event);

  let type = event.type;
  if (type === "url_verification") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      challenge: event.challenge,
    };
  }

  let eventType = event.event.type;
  let eventSubtype = undefined;
  if (event.event.hasOwnProperty("subtype")) {
    eventSubtype = event.event.subtype;
  }
  var stepfunctions = new AWS.StepFunctions({ apiVersion: "2016-11-23" });

  if (event.hasOwnProperty("event")) {
    // Coming from Slack events API
    let eventType = event.event.type;
    let eventSubtype = undefined;
    if (event.event.hasOwnProperty("subtype")) {
      eventSubtype = event.event.subtype;
    }

    if (eventType === "message" && eventSubtype === undefined) {
      // New message posted in Slack
    } else {
      // App added to channel
      console.log("app added to channel!");
      let params = {
        stateMachineArn:
          "arn:aws:states:us-east-2:579534454884:stateMachine:App-Added-Flow",
        name: uuidv4(),
        input: JSON.stringify({
          workspaceID: event.team_id,
          channelID: event.event.channel,
        }),
      };
      console.log("try to execute step function");


      
      let res = await stepfunctions.startExecution(params).promise();
      console.log(res);
    }
  } else {
    // Not coming from Slack events API
    let body = parseJson(qs.parse(event.body).payload);
    if (body.type === "block_actions") {
      // Button was pressed
      let actionID = body.actions[0].action_id;

      if (actionID.includes("dismiss")) {
        // Dismiss button pressed
      } else if (actionID.includes("nothelpful")) {
        // Not Helpful button pressed
      } else {
        // Helpful button pressed
      }
    } else {
      // Answer was marked
    }
  }
  console.log("about to return");
  return buildResponse(200, event);
};

function buildResponse(statusCode, event) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  };
}
