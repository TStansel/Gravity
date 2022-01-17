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

  let verifySQSResult = verifySQSEvent(event);

  if(verifySQSResult.type === "error"){
    console.log(verifySQSResult.error.message);
    return;
  }

  let slackEvent = event.Records[0];

  let slackJson = JSON.parse(slackEvent.body as string) as JSON;

  let classResult = determineClass(slackJson);

  if (classResult.type === "error") {
    console.log(classResult.error.message);
    return;
  }

  let vectorResult = verifyVectors(slackJson);

  if (vectorResult.type === "error") {
    console.log(vectorResult.error.message);
    return;
  }

  //Class Result should be either a new message, app added, or marked answer
  console.log("Slack Result:", classResult.value);

  let workResult = classResult.value.doMLWork(
    slackJson["vector" as keyof JSON] as string | JSON[]
  );

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

function verifyVectors(slackJson: JSON): Result<string> {
  if (!slackJson.hasOwnProperty("vectors")) {
    return {
      type: "error",
      error: new Error("JSON is missing property 'vectors'."),
    };
  }

  switch (slackJson["type" as keyof JSON]) {
    case "APPADDEDEVENT": {
      if (typeof slackJson["vectors" as keyof JSON] !== "string") {
        return {
          type: "error",
          error: new Error("Vectors type does not match SlackEvent Type"),
        };
      }
    }
    case "NEWMESSAGEEVENT": {
      if (!Array.isArray(slackJson["vectors" as keyof JSON])) {
        return {
          type: "error",
          error: new Error("Vectors type does not match SlackEvent Type"),
        };
      }
    }
    case "MARKEDANSWEREVENT":
      {
        if (typeof slackJson["vectors" as keyof JSON] !== "string") {
          return {
            type: "error",
            error: new Error("Vectors type does not match SlackEvent Type"),
          };
        }
      }
      break;
  }

  return { type: "success", value: "Vectors matches SlackEvent Type" };
}

function verifySQSEvent(event: SQSEvent): Result<string> {
  if (event.Records.length !== 1) {
    // Access Denied
    return {
      type: "error",
      error: new Error("No events in the SQS record"),
    };
  }

  if (!event.Records[0].hasOwnProperty("body")) {
    // Access Denied
    return {
      type: "error",
      error: new Error("SQSEvent does not have a body"),
    };
  }

  return { type: "success", value: "SQSEvent has needed parameters" };
}
