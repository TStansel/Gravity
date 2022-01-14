import {
  SQSEvent,
  SQSHandler,
} from "aws-lambda";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log(event);

  // Successful Call
  return;
};
