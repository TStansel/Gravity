const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
    
    event = event.payload;
    //console.log("Request Event:",event)
    
    let notHelpfulParams = {
        replace_original: "true",
        text: "Thank you for making Osmosix more accurate!",
    };
            
    let notHelpfulConfig = {
        method: 'post',
        url: event.responseURL,
        data: notHelpfulParams
    };
            
    const notHelpfulRes = await axios(notHelpfulConfig);

    let getBotTokenSql =
        `select SlackToken.BotToken from SlackToken 
            join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
            where SlackChannel.ChannelID = :channelID`;

    let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: event.channelID,
    });

    let botToken = getBotTokenResult.records[0].BotToken;

    // Updating the parent message with the question mark reaction
    
    let removeEmojiReactionParams = {
        channel: event.channelID,
        timestamp: event.messageTS,
        name: "arrows_counterclockwise"
    };
    
    let removeEmojiReactionConfig = {
        method: 'post',
        url: 'https://slack.com/api/reactions.remove',
        headers: {
            'Authorization': 'Bearer ' + botToken,
            'Content-Type': 'application/json'
        },
        data: removeEmojiReactionParams
    };
    
    const removeEmojiReactionRes = await axios(removeEmojiReactionConfig);
    
    let addEmojiReactionParams = {
        channel: event.channelID,
        timestamp: event.messageTS,
        name: "question"
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
    
    let increamentUpvotesSql =
        `update SlackAnswer 
        join SlackQuestion on SlackAnswer.SlackAnswerUUID = SlackQuestion.SlackAnswerUUID
        set SlackAnswer.Upvotes = (SlackAnswer.Upvotes - 1)
        where SlackQuestion.SlackQuestionUUID = :SlackQuestionUUID`;
    
    let increamentUpvotesResult = await data.query(increamentUpvotesSql, {
        SlackQuestionUUID: event.oldQuestionUUID,
    });
    
    return { msg: "Successful Not Helpful Button Press" }

};
