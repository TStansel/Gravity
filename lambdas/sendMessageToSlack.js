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
    
    let mostSimilarQuestion = parseJson(event.questions)[0];
    let mostSimilarQuestionUUID = mostSimilarQuestion.SlackQuestionUUID;
    let channelID = event.channelID;
    let messageTS = mostSimilarQuestion.SlackQuestionTs;

    let repliesConfig = {
        method: 'get',
        url: 'https://slack.com/api/conversations.replies?channel='+channelID+'&ts='+messageTS,
        headers: {
            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
            'Content-Type': 'application/json'
        },
    };
    const repliesRes = await axios(repliesConfig);
    let answerTs = repliesRes.data.messages[0].ts;
    
    let getLinkConfig = {
        method: 'get',
        url: 'https://slack.com/api/chat.getPermalink?channel='+channelID+'&message_ts='+answerTs,
        headers: {
            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
            'Content-Type': 'application/json'
        },
    };
    const getLinkRes = await axios(getLinkConfig);
    
    let answerLink = getLinkRes.data.permalink;
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
                        "value": mostSimilarQuestion.SlackQuestionUUID + " " + event.messageID,
                        "action_id": "helpful"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Not Helpful"
                        },
                        "value": mostSimilarQuestion.SlackQuestionUUID + " " + event.messageID,
                        "action_id": "nothelpful"
                    },
                    {
                        "type": "button",
                        "style": "danger",
                        "text": {
                            "type": "plain_text",
                            "text": "Dismiss"
                        },
                        "value": mostSimilarQuestion.SlackQuestionUUID + " " + event.messageID,
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
            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
            'Content-Type': 'application/json'
        },
        data: msgParams
    };
    const msgRes = await axios(msgConfig);
    //console.log("Message Sent: ",msgRes);
    
    let insertAnswerSql =
      "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";
    let answerUUID = uuidv4();
    
    let insertAnswerResult = await data.query(insertAnswerSql, {
      SlackAnswerUUID: answerUUID,
      AnswerLink: answerLink,
      Upvotes: 0,
    });
    
};
