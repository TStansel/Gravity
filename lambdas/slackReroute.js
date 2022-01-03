const qs = require("qs");
const parseJson = require("parse-json");
const { v4: uuidv4 } = require("uuid");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const crypto = require("crypto");

exports.handler = async (event) => {
  console.log("Request event: ", event);

  // First verify that the request is actually coming from Slack
  if (!verifyRequestIsFromSlack(event)) {
    console.log("verification failed!");
    // Hashes did not match, return 401 Unauthorized response
    return buildResponse(401, event); // TODO: reformat all responses to comply with lambda proxy integration
  }

  console.log("request verified!");

  if (event.headers["Content-Type"] === "application/json") {
    event = parseJson(event.body);
  } // else if(event.headers["Content-Type"] === 'application/x-www-form-urlencoded')

  if (event.hasOwnProperty("type")) {
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
        userID: event.event.user,
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
      console.log("New Message:", response);
    } else if (eventSubtype === "channel_join") {
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
      console.log("App Added:", response);
    }
  } else {
    // Not coming from Slack events API
    let body = parseJson(qs.parse(event.body).payload);
    if (body.type === "block_actions") {
      // Button was pressed
      let actionID = body.actions[0].action_id;

      if (actionID.includes("dismiss")) {
        // Dismiss button pressed

        let input = {
          stateMachineArn:
            "arn:aws:states:us-east-2:579534454884:stateMachine:Dismiss-Button-Flow",
          name: uuidv4(),
          input: JSON.stringify({
            responseURL: body.response_url,
          }),
        };
        const command = new StartExecutionCommand(input);
        const response = await client.send(command);
        console.log("Dismiss Button:", response);
      } else if (actionID.includes("nothelpful")) {
        // Not Helpful button pressed

        let payload = {
          responseURL: body.response_url,
          oldQuestionUUID: body.actions[0].value.split(" ")[0],
          messageTS: body.actions[0].value.split(" ")[1],
        };

        let input = {
          stateMachineArn:
            "arn:aws:states:us-east-2:579534454884:stateMachine:Not-Helpful-Flow",
          name: uuidv4(),
          input: JSON.stringify({
            payload: payload,
          }),
        };
        const command = new StartExecutionCommand(input);
        const response = await client.send(command);
        console.log("Not Helpful Button:", response);
      } else {
        // Helpful button pressed

        let payload = {
          responseURL: body.response_url,
          oldQuestionUUID: body.actions[0].value.split(" ")[0],
          messageTS: body.actions[0].value.split(" ")[1],
          userID: body.user.id,
          channelID: body.channel.id,
        };

        let input = {
          stateMachineArn:
            "arn:aws:states:us-east-2:579534454884:stateMachine:Helpful-Button-Flow",
          name: uuidv4(),
          input: JSON.stringify({
            payload: payload,
          }),
        };
        const command = new StartExecutionCommand(input);
        const response = await client.send(command);
        console.log("Helpful Button:", response);
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
      console.log("Answer Marked:", response);
    }
  }
  console.log("about to return");
  return buildResponse(200, event);
};

function verifyRequestIsFromSlack(event) {
  let slackTimestamp = event.headers["X-Slack-Request-Timestamp"];

  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - slackTimestamp) >
    60 * 5
  ) {
    // Request was sent over 5 minutes ago
    console.log("request over 5 min old, rejecting");
    return false;
  }
  let slackSignature = event.headers["X-Slack-Signature"];
  let slackBody = event.body;

  let baseString = "v0:" + slackTimestamp + ":" + slackBody;
  const slackSigningSecret = process.env.OSMOSIX_SLACK_SIGNING_SECRET;

  let mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", slackSigningSecret)
      .update(baseString, "utf8")
      .digest("hex");

  if (
    crypto.timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(slackSignature, "utf8")
    )
  ) {
    return true;
  } else {
    return false;
  }
}

function buildResponse(statusCode, event) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  };
}
