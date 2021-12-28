const axios = require('axios')
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {

  let getBotTokenSql =
    `select SlackToken.BotToken from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

  let getBotTokenResult = await data.query(getBotTokenSql, {
    workspaceID: event.workspaceID,
  });

  let botToken = getBotTokenResult.records[0].BotToken;

  let msgParams = {
    channel: event.userID,
    text: "Uh oh! Thank you for marking an answer, but please make sure to only mark answers in threads where the parent message is a question."
  };
          
  let msgConfig = {
    method: 'post',
    url: 'https://slack.com/api/chat.postMessage',
    headers: {
      'Authorization': 'Bearer ' + botToken,
      'Content-Type': 'application/json'
    },
    data: msgParams
  };
  const msgRes = await axios(msgConfig);
  return msgRes.data
};
