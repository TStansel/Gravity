import { SQSEvent, SQSHandler } from "aws-lambda";
import {
  SlackEvent,
  MachineLearningIsWorkable,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedEvent,
  Result,
  ResultError,
  ResultSuccess,
} from "./slackEventClasses";
import { buildResponse } from "./slackFunctions";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log("Ml Output: ", event);

  if (event.Records.length !== 1) {
    // Access Denied
    console.log("No events in the record");
    return;
  }
  let slackEvent = event.Records[0];

  if (!slackEvent.hasOwnProperty("body")) {
    // Access Denied
    console.log("Event does not have a body");
    return;
  }

  if(!slackEvent.hasOwnProperty("vectors")){
    console.log("Event does not have vectors");
    return;
  }

  let classResult = determineClass(JSON.parse(slackEvent.body as string));
  //Class Result should be either a new message, app added, or marked answer

  if (classResult.type === "error") {
    console.log(classResult.error.message);
    return;
  }
  console.log("Slack Result:", classResult.value);
  
  

  // Successful Call
  return;
};

function determineClass(slackJson: JSON): Result<MachineLearningIsWorkable> {
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
    case "MARKEDANSWEREVENT":
      {
        if (!slackJson.hasOwnProperty("vector")) {
          return {
            type: "error",
            error: new Error("JSON is missing property 'vector'."),
          };
        }

        if (slackJson["vector" as keyof JSON].length != 1) {
          return {
            type: "error",
            error: new Error("Marked Answer: Too many vectors passed in"),
          };
        }

        return MarkedAnswerEvent.fromJSON(slackJson);
      }
      break;
  }

  return {
    type: "error",
    error: new Error("JSON did not match class types"),
  };
}
