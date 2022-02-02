import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  GetItemCommand,
  GetItemCommandInput,
} from "@aws-sdk/client-dynamodb";
const dynamodb = new DynamoDBClient({ region: "us-east-2" });

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
      console.log(
        "invalid log level specified, please input one of ERROR, WARN, or DEBUG"
      );
    }
  } else {
    console.log("no env was set, error!");
  }
}

export async function writeToDynamoDB(
  workspaceID: string,
  channelID: string,
  messageID: string,
  status: string
) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME as string,
    Item: {
      workspaceID: { S: workspaceID },
      "channelID#ts": { S: channelID + "#" + messageID },
      messageTs: { S: messageID },
      status: { S: status },
    },
  } as PutItemCommandInput;

  const command = new PutItemCommand(params);

  const dynamoResult = await dynamodb.send(command);

  return dynamoResult;
}

export async function deleteItemInDynamoDB(
  workspaceID: string,
  channelID: string,
  messageID: string
) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME as string,
    Key: {
      workspaceID: { S: workspaceID },
      "channelID#ts": { S: channelID + "#" + messageID },
    },
  } as DeleteItemCommandInput;

  const command = new DeleteItemCommand(params);

  const dynamoResult = await dynamodb.send(command);

  return dynamoResult;
}

export async function getItemFromDynamoDB(
  workspaceID: string,
  channelID: string,
  messageID: string
) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME as string,
    Key: {
      workspaceID: { S: workspaceID },
      "channelID#ts": { S: channelID + "#" + messageID },
    }
  } as GetItemCommandInput;

  const command = new GetItemCommand(params);

  const dynamoResult = await dynamodb.send(command);

  return dynamoResult;
}
