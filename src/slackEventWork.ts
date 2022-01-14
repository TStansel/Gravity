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
  Result,
  ResultError,
  ResultSuccess
} from "./slackEventClasses";
import { buildResponse } from "./slackFunctions";

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log(event);

  if(!event.hasOwnProperty("body")){
      return buildResponse(401, "Access Denied")
  }
  
  let classResult = determineClass(JSON.parse(event.body as string));

  if(classResult.type === "error"){
      return buildResponse(401,classResult.error.message)
  }
  // classResult is now one of the 6 objects

  return buildResponse(200, "request queued for processing");
};

/* ------- Functions ------- */

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
  }

  return {
      type: "error",
      error: new Error("JSON did not match class types")
  }
}
