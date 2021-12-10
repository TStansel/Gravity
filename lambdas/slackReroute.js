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
      
      let params = {
        stateMachineArn:
          "arn:aws:states:us-east-2:579534454884:stateMachine:New-Message-Posted",
        name: uuidv4(),
        input: JSON.stringify({
          workspaceID: event.team_id,
          channelID: event.event.channel,
        }),
      };
      
      stepfunctions.startExecution(params, (err, data) => {
        if (err) {
          console.log(err);
          const response = {
            statusCode: 500,
            body: JSON.stringify({
              message: "There was an error",
            }),
          };
          callback(null, response);
        } else {
          console.log(data);
          const response = {
            statusCode: 200,
            body: JSON.stringify({
              message: "Step function worked",
            }),
          };
          callback(null, response);
        }
      });
      
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
      stepfunctions.startExecution(params, (err, data) => {
        if (err) {
          console.log(err);
          const response = {
            statusCode: 500,
            body: JSON.stringify({
              message: "There was an error",
            }),
          };
          callback(null, response);
        } else {
          console.log(data);
          const response = {
            statusCode: 200,
            body: JSON.stringify({
              message: "Step function worked",
            }),
          };
          callback(null, response);
        }
      });

      
      // let res = await stepfunctions
      //   .startExecution(params, (err, data) => {
      //     if (err) {
      //       console.log("error starting step function");
      //       console.log(err);
      //     } else {
      //       console.log("step function started");
      //     }
      //   })
      //   .send();
      // console.log(res);
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
