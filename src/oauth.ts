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
    try{
        console.log(event);
        if(!event.queryStringParameters || !event.queryStringParameters.code){
            return buildResponse(401, "Access Denied");
        }
        let code = event.queryStringParameters.code;
        let clientID = "2516673192850.2714678861750";
        let clientSecret = "829f20910714241628de5d8a68562a54";
        let redirect_uri = "https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/DevStage/oauth";

        let oauthParams = {
            code: code,
            redirect_uri: redirect_uri,
            client_id: clientID,
            client_secret: clientSecret
        };

        let url = "https://slack.com/api/oauth.v2.access"
        const oauthRes = await axios.post(url,qs.stringify(oauthParams));
      
        let botToken = oauthRes.data.access_token;
        let userToken = oauthRes.data.authed_user.access_token;
        let workspaceID = oauthRes.data.team.id;
        let workspaceName = oauthRes.data.team.name;
        let workspaceUUID = ulid();

        let insertWorkspaceSql =
            `insert into SlackWorkspace (SlackWorkspaceUUID, WorkspaceID, Name) values (:SlackWorkspaceUUID, :WorkspaceID, :Name)`;
    
        let insertWorkspaceResult = await data.query(insertWorkspaceSql, {
            SlackWorkspaceUUID: workspaceUUID,
            WorkspaceID: workspaceID,
            Name: workspaceName
        });

        let insertTokenSql =
            `insert into SlackToken (SlackTokenUUID, SlackWorkspaceUUID, BotToken, UserToken) values (:SlackTokenUUID, :SlackWorkspaceUUID, :BotToken, :UserToken)`;
    
        let insertTokenResult = await data.query(insertTokenSql, {
            SlackTokenUUID: ulid(),
            SlackWorkspaceUUID: workspaceUUID,
            BotToken: botToken,
            UserToken: userToken
        });
    } catch(error){
        return buildResponse(401, "Access Denied");
    }
    return buildResponse(200, "Successfully authenticated!");
  }