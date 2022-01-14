import { buildResponse } from "./slackFunctions";
import {
  SQSHandler,
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure
} from "aws-lambda";

export const lambdaHandler: SQSHandler = async (
  event: SQSEvent
): Promise<void> => {
  console.log(event);

  
  
};

