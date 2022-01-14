import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  SlackEvent,
  HelpfulButton,
  NotHelpfulButton,
  DismissButton,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedEvent,
} from "./slackEventClasses";
import { buildResponse } from "./slackFunctions";

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log(event);
  // Inspect the event passed from API gateway to determine what action to perform
  // If the request did not constitute a valid action return null

  return buildResponse(200, "request queued for processing");
};

/* ------- Functions ------- */

function determineClass(slackJson: JSON) {
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
}
