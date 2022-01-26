import { SQSEvent, SQSHandler } from "aws-lambda";
import {
  SlackEvent,
  MachineLearningIsWorkable,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedMessageProcessing,
  Result,
  ResultError,
  ResultSuccess,
} from "./slackEventClasses";
import { buildResponse,customLog } from "./slackFunctions";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  customLog("Ml Output: "+ event,"DEBUG");

  let verifySQSResult = verifySQSEvent(event);

  if (verifySQSResult.type === "error") {
    customLog("Verifying SQS Result:"+verifySQSResult.error.message,"ERROR");
    return;
  }

  let slackEvent = event.Records[0];

  let slackJson = JSON.parse(slackEvent.body as string) as JSON;
  customLog("Slack JSON: "+slackJson,"DEBUG");

  let classResult = determineClass(slackJson);

  if (classResult.type === "error") {
    customLog("Class Result Error: "+classResult.error.message, "ERROR");
    return;
  }

  let vectorResult;
  if (classResult.value.type === "NEWMESSAGEEVENT") {
    vectorResult = verifyVectors(slackJson);
  }

  if (vectorResult !== undefined && vectorResult.type === "error") {
    customLog("Vector Result: "+vectorResult.error.message,"ERROR");
    return;
  }

  //Class Result should be either a new message, app added, or marked answer
  customLog("Slack Result: "+ classResult.value,"ERROR");

  let workResult; 

  if(vectorResult!== undefined){
    workResult = await classResult.value.doMLWork(
      slackJson["vectors" as keyof JSON] as unknown as undefined | JSON
    );
  }else{
    workResult = await classResult.value.doMLWork(undefined);
  }

  if (workResult.type === "error") {
    // Network Call in Class failed
    throw workResult.error;
  }
  customLog("Successful Call: "+workResult.value,"DEBUG");
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
    case "APPADDEDMESSAGEPROCESSING": {
      return AppAddedMessageProcessing.fromJSON(slackJson);
    }
    case "NEWMESSAGEEVENT": {
      return NewMessageEvent.fromJSON(slackJson);
    }
    case "MARKEDANSWEREVENT":
      {
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

