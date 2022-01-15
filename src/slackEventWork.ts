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
  ResultSuccess
} from "./slackEventClasses";
import { buildResponse } from "./slackFunctions";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log(event);

  if(event.Records.length !== 1){
    // Access Denied
    return;
  }

  if(!event.hasOwnProperty("body")){
      // Access Denied
      return;
  }
  
  let slackEvent = event.Records[0];

  let classResult = determineClass(JSON.parse(slackEvent.body as string));

  if(classResult.type === "error"){
      console.log(classResult.error.message);
      return;
  }
  // classResult is now one of the 6 objects

  let workResult = await classResult.value.doWork();

  if(workResult.type === "error"){
      // Network Call in Class failed
      throw workResult.error;
  }
  console.log(workResult.value)
  // Successful Call
  return;
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
