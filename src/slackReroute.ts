import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as crypto from "crypto";
import * as qs from "qs";
import {
  SlackEvent,
  HelpfulButton,
  NotHelpfulButton,
  DismissButton,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedEvent,
  Result,
  ResultError,
  ResultSuccess
} from "./slackEventClasses";
import {
  buildResponse,
} from "./slackFunctions";

const client = new SQSClient({});

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log(event);
  // Inspect the event passed from API gateway to determine what action to perform
  // If the request did not constitute a valid action return null

  let slackEventResult = determineEvent(event);
  if (slackEventResult.type === "error") {
    console.log(`Could not determine event type: ${slackEventResult.error.message}`);
    return buildResponse(401, "Access Denied", true);
  }

  let slackEvent = slackEventResult.value;
  if (slackEvent instanceof UrlVerificationEvent) {
    return buildResponse(200, slackEvent.challenge);
  }

  const command = new SendMessageCommand({
    MessageBody: JSON.stringify(slackEvent),
    QueueUrl: process.env.REVERSE_PROXY_SQS_URL,
  });

  try {
    const response = await client.send(command);
  } catch (e) {
    console.log(`failed to send to SQS! error: ${e}`);
    return buildResponse(500, "Failed to queue for processing");
  }

  return buildResponse(200, "request queued for processing");
};

/* --------  Classes -------- */

// Special event type, does not inherit from SlackEvent becuase no workspaceID or channelID are sent
class UrlVerificationEvent {
  constructor(public challenge: string) {}
}

/* --------  Functions -------- */

function determineEvent(
  event: APIGatewayProxyEventV2
): Result<SlackEvent> | Result<UrlVerificationEvent> {
  console.log("determining route");

  // Determine if request is from Slack
  let verifyResult = verifyRequestIsFromSlack(event);
  if (verifyResult.type === "error") {
    return verifyResult;
  }
  console.log("request verified");

  let urlVerificationResult = isUrlVerification(event);
  if (urlVerificationResult.type === "success") {
    // Event is a url verification challenge from Slack
    return urlVerificationResult;
  }
  console.log(urlVerificationResult.error);

  let fromSlackEventsApiResult = fromSlackEventsApi(event);
  if (fromSlackEventsApiResult.type === "success") {
    // Event is from Slack Events API
    return fromSlackEventsApiResult;
  }
  console.log(fromSlackEventsApiResult.error);

  let fromSlackInteractivityResult = fromSlackInteractivity(event);
  if (fromSlackInteractivityResult.type === "success") {
    // Event is from Slack interaction
    return fromSlackInteractivityResult;
  }

  return fromSlackInteractivityResult;
}

function verifyRequestIsFromSlack(
  event: APIGatewayProxyEventV2
): Result<boolean> {
  if (
    !event.headers["X-Slack-Request-Timestamp"] ||
    !event.headers["X-Slack-Signature"] ||
    !event.body
  ) {
    return { type: "error", error: Error("Event object missing attributes") };
  }

  const slackTimestamp = +event.headers["X-Slack-Request-Timestamp"];

  // TODO: check if this logic is bug-proof
  // Check if timestamp is current
  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - slackTimestamp) >
    60 * 5
  ) {
    return { type: "error", error: Error("timestamp is not current") };
  }

  const slackSignature = event.headers["X-Slack-Signature"];
  const slackBody = event.body;

  const baseString = "v0:" + slackTimestamp + ":" + slackBody;

  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (!slackSigningSecret) {
    return {
      type: "error",
      error: Error("could not get slack signing secret"),
    };
  }

  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", slackSigningSecret)
      .update(baseString, "utf8")
      .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(slackSignature, "utf8")
    )
  ) {
    return { type: "error", error: Error("Hashes do not match") };
  }

  return { type: "success", value: true };
}

function isUrlVerification(
  event: APIGatewayProxyEventV2
): Result<UrlVerificationEvent> {
  if (!(event.headers["Content-Type"] === "application/json") || !event.body) {
    console.log("event not encoded as json/has no event.body");
    return {
      type: "error",
      error: new Error("event not encoded as json/has no event.body"),
    };
  }

  const slackEvent = JSON.parse(event.body);

  let hasUrlVerificationProperties = checkObjHasProperties(slackEvent, [
    "token",
    "type",
    "challenge",
  ]);

  if (hasUrlVerificationProperties.type === "error") {
    return hasUrlVerificationProperties;
  }

  if (!(slackEvent.type === "url_verification")) {
    return {
      type: "error",
      error: new Error("did not have url_verification type"),
    };
  }

  let urlVerificationEvent = new UrlVerificationEvent(
    slackEvent.challenge as string
  );
  return { type: "success", value: urlVerificationEvent };
}

function fromSlackEventsApi(event: APIGatewayProxyEventV2): Result<SlackEvent> {
  if (!(event.headers["Content-Type"] === "application/json") || !event.body) {
    console.log("event not encoded as json/has no event.body");
    return {
      type: "error",
      error: new Error("event not encoded as json/has no event.body"),
    };
  }

  const slackEvent = JSON.parse(event.body);

  let hasEventsApiProperties = checkObjHasProperties(slackEvent, [
    "token",
    "team_id",
    "api_app_id",
    "event",
    "type",
    "authorizations",
    "event_context",
    "event_id",
    "event_time",
  ]);

  if (hasEventsApiProperties.type === "error") {
    return hasEventsApiProperties;
  }
  if (slackEvent.event.type === "member_joined_channel") {
    let hasMemberJoinedChannelProperties = checkObjHasProperties(
      slackEvent.event,
      ["user", "channel", "team"]
    );

    if (hasMemberJoinedChannelProperties.type === "error") {
      return hasMemberJoinedChannelProperties;
    }

    let appAddedEvent = new AppAddedEvent(
      slackEvent.event.channel as string,
      slackEvent.event.team as string,
      slackEvent.event.user as string
    );

    return { type: "success", value: appAddedEvent };
  } else if (slackEvent.event.type === "message") {
    let hasMessageProperties = checkObjHasProperties(slackEvent.event, [
      "text",
      "channel",
      "ts",
      "user",
    ]);

    if (hasMessageProperties.type === "error") {
      return hasMessageProperties;
    }

    let newMessageEvent = new NewMessageEvent(
      slackEvent.event.channel as string,
      slackEvent.event.team as string,
      slackEvent.event.ts as string,
      slackEvent.event.user as string,
      slackEvent.event.text as string
    );

    return { type: "success", value: newMessageEvent };
  }

  return {
    type: "error",
    error: new Error("incoming slack Events API event did not match any path"),
  };
}

function fromSlackInteractivity(
  event: APIGatewayProxyEventV2
): Result<SlackEvent> {
  if (!(event.headers["Content-Type"] === "application/json") || !event.body) {
    return {
      type: "error",
      error: new Error("event not encoded as json/has no event.body"),
    };
  }

  const slackEvent = JSON.parse(event.body);

  let hasPayloadProperty = checkObjHasProperties(slackEvent, ["payload"]);

  if (hasPayloadProperty.type === "error") {
    return hasPayloadProperty;
  }

  let slackPayload = qs.parse(slackEvent.payload);

  // check that the slackPayload has all properties common to an interactive slack event
  let hasInteractivityProperties = checkObjHasProperties(slackPayload, [
    "type",
    "callback_id",
    "channel",
    "message",
    "user",
    "team",
  ]);

  if (hasInteractivityProperties.type === "error") {
    return hasInteractivityProperties;
  }

  if (slackPayload.type === "message_action") {
    if (slackPayload.callback_id === "marked_as_answer") {
      // This checks for properties needed to continue, is weird because of qs.parse() return types
      if (
        (<qs.ParsedQs>slackPayload.channel).id &&
        (<qs.ParsedQs>slackPayload.message).ts &&
        (<qs.ParsedQs>slackPayload.message).text &&
        (<qs.ParsedQs>slackPayload.user).id &&
        (<qs.ParsedQs>slackPayload.team).id
      ) {
        // thread_ts is dealt with as such because its final value depends on its existance
        let thread_ts: string | undefined;
        if ((<qs.ParsedQs>slackPayload.message).thread_ts) {
          thread_ts = (<qs.ParsedQs>slackPayload.message).thread_ts as string;
        } else {
          thread_ts = undefined;
        }
        // Reason for the ugly casting is due to qs type weirdness and the above checks not
        // narrowing the type down. Normally code after the above checks would infer the correct
        // Types, but for some reason it didn't, so had to recast
        let markedAnswerEvent = new MarkedAnswerEvent(
          (<qs.ParsedQs>slackPayload.channel).id as string,
          (<qs.ParsedQs>slackPayload.team).id as string,
          thread_ts,
          (<qs.ParsedQs>slackPayload.message).ts as string,
          (<qs.ParsedQs>slackPayload.user).id as string,
          (<qs.ParsedQs>slackPayload.message).text as string
        );
        return { type: "success", value: markedAnswerEvent };
      }
      return {
        type: "error",
        error: new Error(
          "marked_as_answer interactive event missing properties"
        ),
      };
    }
    return {
      type: "error",
      error: new Error(
        "incoming message_action interactivity event did not match any message_action callback_id path"
      ),
    };
  } else if (slackPayload.type === "block_actions") {
    if (
      slackPayload.actions &&
      (slackPayload.actions as qs.ParsedQs[]).length > 0 &&
      (slackPayload.actions as qs.ParsedQs[])[0].action_id &&
      (slackPayload.actions as qs.ParsedQs[])[0].value &&
      (<qs.ParsedQs>slackPayload.channel).id &&
      (<qs.ParsedQs>slackPayload.team).id &&
      (<qs.ParsedQs>slackPayload.user).id &&
      slackPayload.response_url
    ) {
      let buttonID = ((slackPayload.actions as qs.ParsedQs[])[0] as qs.ParsedQs)
        .action_id as string;
      let value = (
        ((slackPayload.actions as qs.ParsedQs[])[0] as qs.ParsedQs)
          .value as string
      ).split(" ");
      // TODO: the following check assumes all interactive message buttons will have .value
      // of the format we defined that splits into oldQuestionUUID and messageID. There might
      // be a better way to do this to future proof
      if (value.length !== 2) {
        return {
          type: "error",
          error: new Error(
            "value in actions[0].value did not split into two values"
          ),
        };
      }
      let oldQuestionUUID = value[0];
      let messageID = value[1];
      switch (buttonID) {
        case "helpful": {
          let helpfulButton = new HelpfulButton(
            (<qs.ParsedQs>slackPayload.channel).id as string,
            (<qs.ParsedQs>slackPayload.team).id as string,
            slackPayload.response_url as string,
            messageID,
            oldQuestionUUID,
            (<qs.ParsedQs>slackPayload.user).id as string
          );
          return { type: "success", value: helpfulButton };
          break;
        }
        case "nothelpful": {
          let notHelpfulButton = new NotHelpfulButton(
            (<qs.ParsedQs>slackPayload.channel).id as string,
            (<qs.ParsedQs>slackPayload.team).id as string,
            slackPayload.response_url as string,
            messageID,
            oldQuestionUUID
          );
          return { type: "success", value: notHelpfulButton };
          break;
        }
        case "dismiss": {
          let dismissButton = new DismissButton(
            (<qs.ParsedQs>slackPayload.channel).id as string,
            (<qs.ParsedQs>slackPayload.team).id as string,
            slackPayload.response_url as string,
            messageID
          );
          return { type: "success", value: dismissButton };
          break;
        }
      }
      return {
        type: "error",
        error: new Error(
          "incoming block_actions interactivity event did not match any buttonID path"
        ),
      };
    }
  }

  return {
    type: "error",
    error: new Error(
      "incoming slack interactivity event did not match any type path"
    ),
  };
}

// This function exists so when a request fails the parameter check we get a list of which
// parameters it was missing
function checkObjHasProperties(
  obj: any,
  properties: string[]
): Result<boolean> {
  let missingProperties = [];
  for (const prop of properties) {
    if (!(prop in obj)) {
      missingProperties.push(prop);
    }
  }
  if (missingProperties.length > 0) {
    return {
      type: "error",
      error: new Error(`object missing properties: ${missingProperties}`),
    };
  }
  return { type: "success", value: true };
}
