const axios = require('axios');
const qs = require('qs');
const { v4: uuidv4 } = require("uuid");
const data = require("data-api-client")({
    secretArn:
      "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
    resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
    database: "osmosix", // set a default database
  });

exports.handler = async (event) => {
    console.log(event)
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
    let workspaceUUID = uuidv4();

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
        SlackTokenUUID: uuidv4(),
        SlackWorkspaceUUID: workspaceUUID,
        BotToken: botToken,
        UserToken: userToken
    });
};
