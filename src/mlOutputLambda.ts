import {
  SQSEvent,
  SQSHandler,
} from "aws-lambda";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log("Ml Output: ",event);

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

  // Successful Call
  return;
};
