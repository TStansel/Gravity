const axios = require("axios");
const data = require("data-api-client")({
    secretArn:
      "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
    resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
    database: "osmosix", // set a default database
  });

exports.handler = async (event) => {
    event = event.payload.payload
    console.log("Request Event",event.message)
    if(event.message.hasOwnProperty('thread_ts') && event.message.ts != event.message.thread_ts){
        
        let channelID = event.channel.id;
        let parentTS = event.message.thread_ts;

        let getBotTokenSql =
            `select SlackToken.BotToken from SlackToken 
                join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
                where SlackChannel.ChannelID = :channelID`;

        let getBotTokenResult = await data.query(getBotTokenSql, {
            channelID: channelID,
        });

        let botToken = getBotTokenResult.records[0].BotToken;
        
        let getParentConfig = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=1&inclusive=true&latest='+parentTS,
                headers: {
                    'Authorization': 'Bearer ' + botToken,
                    'Content-Type': 'application/json'
                },
        };
        
        const getParentRes = await axios(getParentConfig);
        
        let parentMessage = getParentRes.data.messages[0];
        let parentMsgText = parentMessage.text;
        
        let payload = {
            data: {
                parentTS: parentTS,
                channelID: channelID,
                messageTS: event.message.ts,
                userID: event.user.id,
                workspaceID: event.team.id,
                text: parentMsgText
            },
            passed: true
        }
        return { payload: payload }
    } else {
        let payload = {
            data: {
                userID: event.user.id,
            },
            passed: false
        }
        return { payload: payload }
    }
};
