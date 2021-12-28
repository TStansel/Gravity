const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
    
    let getUUIDsSql =
        `select SlackChannel.SlackChannelUUID, SlackUser.SlackUserUUID from SlackWorkspace 
            join SlackChannel on SlackWorkspace.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
            join SlackUser on SlackWorkspace.SlackWorkspaceUUID = SlackUser.SlackWorkspaceUUID 
            where SlackWorkspace.WorkspaceID = :workspaceID and SlackChannel.ChannelID = :channelID 
            and SlackUser.SlackID = :userID`;

    let getUUIDsResult = await data.query(getUUIDsSql, {
        workspaceID: event.workspaceID,
        channelID: event.channelID,
        userID: event.userID
    });
    //console.log(getUUIDsResult)
    let UUIDs = getUUIDsResult.records[0];

    let getBotTokenSql =
        `select SlackToken.BotToken from SlackToken 
          join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
          where SlackWorkspace.WorkspaceID = :workspaceID`;

    let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: event.workspaceID,
    });

    let botToken = getBotTokenResult.records[0].BotToken;
    
    // Get Answer Link
    let linkConfig = {
        method: 'get',
        url: 'https://slack.com/api/chat.getPermalink?channel='+event.channelID+'&message_ts='+event.messageTS,
        headers: {
            'Authorization': 'Bearer ' + botToken,
            'Content-Type': 'application/json'
        },
    };
                    
    const linkRes = await axios(linkConfig);
    
    let link = linkRes.data.permalink;
    let aUUID = uuidv4();
    
    // insert Answer
    let insertAnswerSql =
      "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";
    console.log(link)
    let insertAnswerResult = await data.query(insertAnswerSql, {
      SlackAnswerUUID: aUUID,
      AnswerLink: link,
      Upvotes: 0,
    });
    
    let qUUID = uuidv4();
    
    // insert Question
    let insertQuestionSql =
      `insert into SlackQuestion (SlackQuestionUUID, SlackAnswerUUID, SlackChannelUUID, SlackUserUUID, Ts, RawText, TextVector) 
        values (:SlackQuestionUUID, :SlackAnswerUUID, :SlackChannelUUID, :SlackUserUUID, :Ts, :RawText, :TextVector)`;

    let insertQuestionResult = await data.query(insertQuestionSql, {
      SlackQuestionUUID: qUUID,
      SlackAnswerUUID: aUUID,
      SlackChannelUUID: UUIDs.SlackChannelUUID,
      SlackUserUUID: UUIDs.SlackUserUUID,
      Ts: event.messageTS,
      RawText: event.text,
      TextVector: event.vector
    });
    
};
