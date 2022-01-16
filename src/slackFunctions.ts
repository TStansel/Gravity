import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  SlackEvent,
  HelpfulButton,
  NotHelpfulButton,
  DismissButton,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedEvent,
  Result,
} from "./slackEventClasses";

export function buildResponse(
  status: number,
  body: string,
  slackNoRetry = false,
  isSlackInteractivity = false
): APIGatewayProxyStructuredResultV2 {
  let sendHeaders: { [key: string]: string } = {
    "content-type": "application/json",
  };
  if (slackNoRetry) {
    sendHeaders["X-Slack-No-Retry"] = "1";
  }

  if (isSlackInteractivity) {
    const logResponse = {
      isBase64Encoded: false,
      statusCode: status,
      headers: sendHeaders,
      body: body,
    };
    console.log(logResponse);
    const response = {
      statusCode: status,
      headers: sendHeaders,
    };
    return response;
  }

  const response = {
    isBase64Encoded: false,
    statusCode: status,
    headers: sendHeaders,
    body: body,
  };
  console.log(response);
  return response;
}

export function determineClass(slackJson: JSON): Result<SlackEvent> {
  if (!slackJson.hasOwnProperty("type")) {
    return {
      type: "error",
      error: new Error("JSON is missing property 'type'."),
    };
  }

  switch (slackJson["type" as keyof JSON]) {
    case "APPADDEDEVENT": {
      return AppAddedEvent.fromJSON(slackJson);
    }
    case "NEWMESSAGEEVENT": {
      return NewMessageEvent.fromJSON(slackJson);
    }
    case "MARKEDANSWEREVENT": {
      return MarkedAnswerEvent.fromJSON(slackJson);
    }
    case "HELPFULBUTTON": {
      return HelpfulButton.fromJSON(slackJson);
    }
    case "NOTHELPFULBUTTON": {
      return NotHelpfulButton.fromJSON(slackJson);
    }
    case "DISMISSBUTTON": {
      return DismissButton.fromJSON(slackJson);
    }
  }

  return {
    type: "error",
    error: new Error("JSON did not match class types"),
  };
}
