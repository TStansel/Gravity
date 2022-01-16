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
import { buildResponse, determineClass } from "./slackFunctions";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log("Event Work: ", event);

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

  let classResult = determineClass(JSON.parse(slackEvent.body as string));

  if (classResult.type === "error") {
    console.log(classResult.error.message);
    return;
  }
  // classResult is now one of the 6 objects
  console.log("Slack Event:", classResult.value);
  let workResult = await classResult.value.doWork();

  if (workResult.type === "error") {
    // Network Call in Class failed
    throw workResult.error;
  }
  console.log(workResult.value);
  // Successful Call
  return;
};
