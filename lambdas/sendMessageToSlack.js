const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const parseJson = require('parse-json')
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {

    event = event.payload;

    let mostSimiliarQuestions = parseJson(event.questions);

    let getBotTokenSql =
        `select SlackToken.BotToken from SlackToken 
          join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
          where SlackChannel.ChannelID = :channelID`;

    let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: event.channelID,
    });

    let botToken = getBotTokenResult.records[0].BotToken;

    if(mostSimiliarQuestions.length === 0){

        let noSuggestionsMessageParams = {
            "channel": event.channelID,
            "user": event.userID,
            "text": "We currently don't have an answer for your question. After someone answers your question make sure to mark it as an answer so next time someone has a question similiar to yours we can help them out!",
        };

        let msgConfig = {
            method: 'post',
            url: 'https://slack.com/api/chat.postEphemeral',
            headers: {
                'Authorization': 'Bearer ' + botToken,
                'Content-Type': 'application/json'
            },
            data: noSuggestionsMessageParams
        };
        const msgRes = await axios(msgConfig);
        return msgRes.data;
    }
    
    let mostSimilarQuestion = mostSimiliarQuestions[0];
    let mostSimilarQuestionUUID = mostSimilarQuestion.SlackQuestionID;
    
    let getQuestionSql =
      "select SlackAnswerUUID from SlackQuestion where SlackQuestionUUID = :SlackQuestionUUID";
    
    let getQuestionResult = await data.query(getQuestionSql, {
      SlackQuestionUUID: mostSimilarQuestionUUID,
    });
    
    let answerLink;
    let isAnswerInDb = false;
    
    if(getQuestionResult.records[0].SlackAnswerUUID === null){ // Answer is null in DB
        let channelID = event.channelID;
        let messageTS = mostSimilarQuestion.SlackQuestionTs;

        let repliesConfig = {
         method: 'get',
            url: 'https://slack.com/api/conversations.replies?channel='+channelID+'&ts='+messageTS,
            headers: {
                'Authorization': 'Bearer ' + botToken,
                'Content-Type': 'application/json'
            },
        };
        const repliesRes = await axios(repliesConfig);

        let answerTs = repliesRes.data.messages[1].ts;
    
        let getLinkConfig = {
            method: 'get',
            url: 'https://slack.com/api/chat.getPermalink?channel='+channelID+'&message_ts='+answerTs,
            headers: {
                'Authorization': 'Bearer ' + botToken,
                'Content-Type': 'application/json'
            },
        };
        const getLinkRes = await axios(getLinkConfig);
        answerLink = getLinkRes.data.permalink;
    } else{
        
        isAnswerInDb = true;
        
        let getAnswerLinkSql =
            "select AnswerLink from SlackAnswer where SlackAnswerUUID = :SlackAnswerUUID";
    
        let getAnswerLinkResult = await data.query(getAnswerLinkSql, {
            SlackAnswerUUID: getQuestionResult.records[0].SlackAnswerUUID,
        });
        answerLink = getAnswerLinkResult.records[0].AnswerLink;
    }
    
    let similarityScore = mostSimilarQuestion.similarity;
    
    // Send Slack Message
    let msgParams = {
        "channel": event.channelID,
        "user": event.userID,
        "text": "I think I might have an answer for you!",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "I think I might have an answer for you!"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Similarity score: "+Math.round(similarityScore * 100) / 100+" <"+answerLink+"|View thread>"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Helpful"
                        },
                        "value": mostSimilarQuestionUUID + " " + event.messageID,
                        "action_id": "helpful"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Not Helpful"
                        },
                        "value": mostSimilarQuestionUUID + " " + event.messageID,
                        "action_id": "nothelpful"
                    },
                    {
                        "type": "button",
                        "style": "danger",
                        "text": {
                            "type": "plain_text",
                            "text": "Dismiss"
                        },
                        "value": mostSimilarQuestionUUID + " " + event.messageID,
                        "action_id": "dismiss"
                    }
                ]
            },
        ]
    };
    
    let msgConfig = {
        method: 'post',
        url: 'https://slack.com/api/chat.postEphemeral',
        headers: {
            'Authorization': 'Bearer ' + botToken,
            'Content-Type': 'application/json'
        },
        data: msgParams
    };
    const msgRes = await axios(msgConfig);
    //console.log("Message Sent: ",msgRes);
    
    if(!isAnswerInDb){
        let insertAnswerSql =
            "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";
        let answerUUID = uuidv4();
    
        let insertAnswerResult = await data.query(insertAnswerSql, {
            SlackAnswerUUID: answerUUID,
            AnswerLink: answerLink,
            Upvotes: 0,
            });
            
        let updateQuestionSql =
            "update SlackQuestion set SlackAnswerUUID = :SlackAnswerUUID where SlackQuestionUUID = :SlackQuestionUUID";
    
        let updateQuestionResult = await data.query(updateQuestionSql, {
            SlackAnswerUUID: answerUUID,
            SlackQuestionUUID: mostSimilarQuestionUUID
            });
            
    } 
};
