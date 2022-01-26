import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  SlackEvent,
  HelpfulButton,
  NotHelpfulButton,
  DismissButton,
  MarkedAnswerEvent,
  NewMessageEvent,
  AppAddedEvent,
  Result,
} from "./slackEventClasses";

export function buildResponse(
  status: number,
  body: string,
  slackNoRetry = false,
  isSlackInteractivity = false
): APIGatewayProxyStructuredResultV2 {
  let sendHeaders: { [key: string]: string } = {
    "content-type": "application/json",
  };
  if (slackNoRetry) {
    sendHeaders["X-Slack-No-Retry"] = "1";
  }

  if (isSlackInteractivity) {
    const logResponse = {
      isBase64Encoded: false,
      statusCode: status,
      headers: sendHeaders,
      body: body,
    };
    console.log(logResponse);
    const response = {
      statusCode: status,
      headers: sendHeaders,
    };
    return response;
  }

  const response = {
    isBase64Encoded: false,
    statusCode: status,
    headers: sendHeaders,
    body: body,
  };
  console.log(response);
  return response;
}

// level can be one of ERROR, WARN, or DEBUG. ERROR and WARN are logged in prod and dev
export function customLog(input: any, level: string): void {
  let env: string;

  // Try to set env based of env var. Default to "dev" if no env var is found
  if (process.env.ENVIRONMENT) {
    env = process.env.ENVIRONMENT;
  } else {
    env = "dev";
  }
  
  if (env === "prod") {
    if (level === "ERROR" || level === "WARN") {
      console.log(`level: ${level}, input: ${JSON.stringify(input)}`);
    }
  } else if (env === "dev") {
    if (level === "ERROR" || level === "WARN" || level == "DEBUG") {
      console.log(`level: ${level}, input: ${JSON.stringify(input)}`);
    } else {
      console.log("invalid log level specified, please input one of ERROR, WARN, or DEBUG");
    }
  } else {
    console.log("no env was set, error!");
  }
}
