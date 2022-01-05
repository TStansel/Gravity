const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
    console.log('Request Event: ', event)
    
    let text = event.text;
    
    if (text.includes('?')){
        if(event.isNewMessageFlow){
            let getBotTokenSql =
                `select SlackToken.BotToken from SlackToken 
                join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
                where SlackChannel.ChannelID = :channelID`;

            let getBotTokenResult = await data.query(getBotTokenSql, {
                channelID: event.channelID,
            });

            let botToken = getBotTokenResult.records[0].BotToken;

            let addEmojiReactionParams = {
                channel: event.channelID,
                timestamp: event.messageID,
                name: "arrows_counterclockwise"
            };
            
            let addEmojiReactionConfig = {
                method: 'post',
                url: 'https://slack.com/api/reactions.add',
                headers: {
                    'Authorization': 'Bearer ' + botToken,
                    'Content-Type': 'application/json'
                },
                data: addEmojiReactionParams
            };
            
            const addEmojiReactionRes = await axios(addEmojiReactionConfig);
        }
        return true;
    }
    
    return false;
};
