const qs = require("qs");
const parseJson = require("parse-json");
const { v4: uuidv4 } = require("uuid");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");

exports.handler = async (event) => {
  console.log("Request event: ", event);
  
  if(event.headers["Content-Type"] === 'application/json'){
    event = parseJson(event.body);
  }// else if(event.headers["Content-Type"] === 'application/x-www-form-urlencoded')

  if(event.hasOwnProperty("type")){
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
  }

  const client = new SFNClient(); // Used to start Step Function workflows

  if (event.hasOwnProperty("event")) {
    // Coming from Slack events API
    let eventType = event.event.type;
    let eventSubtype = undefined;
    if (event.event.hasOwnProperty("subtype")) {
      eventSubtype = event.event.subtype;
    }

    if (eventType === "message" && eventSubtype === undefined) {
      // New message posted in Slack
      
      let data = {
        text: event.event.text,
        channelID: event.event.channel,
        messageID: event.event.ts,
        userID: event.event.user
      };
      
      let input = {
        stateMachineArn:
          "arn:aws:states:us-east-2:579534454884:stateMachine:New-Message-Posted",
        name: uuidv4(),
        input: JSON.stringify({
          payload: data,
        }),
      };
      const command = new StartExecutionCommand(input);
      const response = await client.send(command);
      console.log("New Message:",response);
    } else {
      // App added to channel
      let input = {
        stateMachineArn:
          "arn:aws:states:us-east-2:579534454884:stateMachine:App-Added-Flow",
        name: uuidv4(),
        input: JSON.stringify({
          workspaceID: event.team_id,
          channelID: event.event.channel,
        }),
      };
      const command = new StartExecutionCommand(input);
      const response = await client.send(command);
      console.log("App Added:",response);
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
      
      let input = {
        stateMachineArn:
          "arn:aws:states:us-east-2:579534454884:stateMachine:Marked-Answer-Flow",
        name: uuidv4(),
        input: JSON.stringify({
          payload: body,
        }),
      };
      const command = new StartExecutionCommand(input);
      const response = await client.send(command);
      console.log("New Message:",response);
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
