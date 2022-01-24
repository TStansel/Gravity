import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { ulid } from "ulid";
import * as qs from "qs";
import { buildResponse } from "./slackFunctions";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    //console.log(event);
    if (!event.queryStringParameters || !event.queryStringParameters.code) {
      console.log("Failed First");
      return buildResponse(401, "Access Denied");
    }
    let code = event.queryStringParameters.code;
    let clientID = process.env.OSMOSIX_CLIENT_ID;
    let clientSecret = process.env.OSMOSIX_CLIENT_SECRET;

    let oauthParams = {
      code: code,
      client_id: clientID,
      client_secret: clientSecret,
    };

    let url = "https://slack.com/api/oauth.v2.access";
    const oauthRes = await axios.post(url, qs.stringify(oauthParams));

    let botToken = oauthRes.data.access_token as string;
    let workspaceID = oauthRes.data.team.id as string;
    let workspaceName = oauthRes.data.team.name as string;
    let workspaceUUID = ulid();

    let insertWorkspaceSql = `insert into SlackWorkspace (SlackWorkspaceUUID, WorkspaceID, Name) values (:SlackWorkspaceUUID, :WorkspaceID, :Name)`;

    let insertWorkspaceResult = await data.query(insertWorkspaceSql, {
      SlackWorkspaceUUID: workspaceUUID,
      WorkspaceID: workspaceID,
      Name: workspaceName,
    });

    let insertTokenSql = `insert into SlackToken (SlackTokenUUID, SlackWorkspaceUUID, BotToken) values (:SlackTokenUUID, :SlackWorkspaceUUID, :BotToken)`;

    let insertTokenResult = await data.query(insertTokenSql, {
      SlackTokenUUID: ulid(),
      SlackWorkspaceUUID: workspaceUUID,
      BotToken: botToken,
    });
  } catch (error) {
    return buildResponse(401, "Access Denied");
  }
  return buildResponse(200, "Successfully authenticated!");
};
