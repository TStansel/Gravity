import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
  SQSEvent,
  SQSHandler,
} from "aws-lambda";
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
  ResultSuccess,
} from "./slackEventClasses";
import { buildResponse, customLog } from "./slackFunctions";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  customLog(event, "DEBUG");

  if (event.Records.length !== 1) {
    // Access Denied
    customLog("No events in the record", "ERROR");
    return;
  }
  let slackEvent = event.Records[0];

  if (!slackEvent.hasOwnProperty("body")) {
    // Access Denied
    customLog("Event does not have a body", "ERROR");
    return;
  }

  let classResult = determineClass(JSON.parse(slackEvent.body as string));

  if (classResult.type === "error") {
    customLog(classResult.error.message, "ERROR");
    return;
  }
  // classResult is now one of the 6 objects
  customLog(classResult.value, "WARN");
  let workResult = await classResult.value.doWork();

  if (workResult.type === "error") {
    // Network Call in Class failed
    throw workResult.error;
  }
  customLog(workResult.value, "DEBUG");
  // Successful Call
  return;
};

function determineClass(slackJson: JSON): Result<SlackEvent> {
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
    break;
  }

  return {
    type: "error",
    error: new Error("JSON did not match class types"),
  };
}
