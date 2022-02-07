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
  import { buildResponse, customLog } from "./slackFunctions";
  
  export const lambdaHandler: SQSHandler = async (
    event: SQSEvent
  ): Promise<void> => {
    customLog(event, "DEBUG");
    return;
  };
  

  