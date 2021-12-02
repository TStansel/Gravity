const axios = require('axios');
const {v4: uuidv4} = require("uuid");

exports.handler = async (event) => {
    console.log('Request event: ', event);
    
    let response;
    let eventType = event.event.type;
    let eventSubtype = undefined;
    if(event.event.hasOwnProperty('subtype')){
        eventSubtype = event.event.subtype;
    }
    
    switch(true) {
        case eventType === 'message' && eventSubtype === undefined:{
            // Someone posted a message
            
            response = buildResponse(200,event);

            let messageEvent = event.event;
            let messageText = messageEvent.text;
            let channelID = messageEvent.channel;
            let messageID = messageEvent.ts;
            
            // Check if the message is in a thread or has a file attached
            if(!messageEvent.hasOwnProperty('thread_ts') || messageEvent.ts === messageEvent.thread_ts){
                
                let params = {
                    messages: [{
                        text:messageText,
                        id: messageID,
                        channelID: channelID
                    }],
                };
            
                let config = {
                    method: 'post',
                    url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/nlp',
                    data: params
                };
                
                const res = await axios(config);
                console.log('NLP: ', res.data.body)
                
                // Check if the message is a question
                if(res.data.body.length === 1){
                    let question = res.data.body[0];
                    /*
                    let config = {
                        method: 'get',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=show tables',
                    };
                
                    const dbRes = await axios(config);
                    console.log('Db Call: ', dbRes)*/


                    // TODO: query database to find top n recently asked questions in that channel
                    console.log("trying to query database to get recent questions asked in this channel")
                    let dbConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query: "select QuestionID, TextVector from Question inner join SlackChannel on Question.SlackChannelID=SlackChannel.SlackChannelID where SlackChannel.ChannelID = \'"+channelID+"\'"}
                    };
                 
                        
                    const dbRes = await axios(dbConfig);
                    console.log('Db Call: ', dbRes)


                    // TODO: Send question to similiar question lambda

                    
                    // TODO: Use result of similiar question lambda to build message to send to user
                
                    // Probably better to build 3 messages and send them so we can delete them if the dismiss button is pressed
                    
                    /* Commented code below grabs the link for a message given the channelID and message ts
                    // channelID should be the same since we should only be pulling questions from this same channel
                    // let messageTS = // TS of answer message from DB
                    
                    let linkConfig = {
                        method: 'get',
                        url: 'https://slack.com/api/chat.getPermalink?channel='+channelID+'&message_ts='+messageTS,
                        headers: {
                            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                            'Content-Type': 'application/json'
                        },
                    };
                    
                    const linkRes = await axios(linkConfig);
                    console.log("link: ", linkRes);
                    */
                    
                    let msgParams = {
                        "channel": "C02K2H9SWG6",
                        "user": "U02FK8XA2RX",
                        "text": "Hello World",
                        "blocks": [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "Hello"
                                }
                            },
                            {
                                "type": "divider"
                            },
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "Suggestion 1"
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
                                        "value": "helpful",
                                        "action_id": "1_helpful"
                                    },
                                    {
                                        "type": "button",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Not Helpful"
                                        },
                                    "value": "notHelpful",
                                    "action_id": "1_nothelpful"
                                    },
                                    {
                                        "type": "button",
                                        "style": "danger",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Dismiss"
                                        },
                                        "value": "dismiss",
                                        "action_id": "1_dismiss"
                                    }
                                ]
                            },
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "Suggestion 2"
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
                                        "value": "helpful",
                                        "action_id": "2_helpful"
                                    },
                                    {
                                        "type": "button",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Not Helpful"
                                        },
                                        "value": "notHelpful",
                                        "action_id": "2_nothelpful"
                                    },
                                    {
                                        "type": "button",
                                        "style": "danger",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Dismiss"
                                        },
                                        "value": "dismiss",
                                        "action_id": "2_dismiss"
                                    }
                                ]
                            },
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "Suggestion 3"
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
                                        "value": "helpful",
                                        "action_id": "3_helpful"
                                    },
                                    {
                                        "type": "button",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Not Helpful"
                                        },
                                        "value": "notHelpful",
                                        "action_id": "3_nothelpful"
                                    },
                                    {
                                        "type": "button",
                                        "style": "danger",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Dismiss"
                                        },
                                        "value": "dismiss",
                                        "action_id": "3_dismiss"
                                    }
                                ]
                            }
                        ]
                    }
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
                    console.log("Message Sent: ",msgRes);
                
                }
                
            }
            
            
            break;
        }
        case eventType === 'message' && eventSubtype === 'channel_join':{
            // Bot was added to a channel
            response = buildResponse(200,event);
            
            // Check if the Workspace is already in the DB
            let teamID = event.authorizations.team_id;
            let db1Config = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select * from SlackWorkspace 
                where WorkspaceID =`+teamID,
            };
                
            const dbRes = await axios(db1Config);
            if(dbRes.data.length > 0){
                
            }
            console.log('Db Call: ', dbRes)
            // Start Adding new workspace
            
            
            let teamConfig = {
                method: 'get',
                url: 'https://slack.com/api/team.info?team='+teamID,
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            }
            const teamRes = await axios(config);
            let teamName = teamRes.team.name;
            
            let uuid = uuidv4();
            
            let dbConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                insert into SlackWorkspace (SlackWorkspaceID, WorkspaceID, Name)
                values (`+uuid+','+teamID+','+teamName+')',
            };
                
            const dbRes = await axios(dbConfig);
            console.log('Db Call: ', dbRes)
            
            let messageEvent = event.event;
            let channelID = messageEvent.channel;
            
            let config = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=100000',
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            };
            
            // Grab the 100,000 most recent messages
            const res = await axios(config);
            
            let messages = res.data.messages;
            // let hasMoreMessages = res.data.has_more;
            console.log('Result: ', res.data);
            
            let cleanedMessages = []; // Messages that have a thread and do not have a file attached
            
            for(let i = 0; i < messages.length; i++){
                let msg = messages[i];
                if(msg.hasOwnProperty('thread_ts') && !msg.hasOwnProperty('files')){
                    cleanedMessages.push(msg);
                }
            }
            
            let params = {
              messages: cleanedMessages,
            };
            
            let nlpConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/nlp',
              data: params
            };
            // See if each cleaned message is a question
            const nlpRes = await axios(nlpConfig);
            console.log('NLP: ', nlpRes)
            if(nlpRes.data.body.length > 0){
                let questions = nlpRes.data.body;
                // TODO: Send each question (and the associated thread_ts and channelID) to the DB
                console.log("nlpRes app added: ",nlpRes.data.body)
                for (let i = 0; i < nlpRes.data.body.length; i++){
                    let messageTS = nlpRes.data.body[i].thread_ts;
                    let answerConfig = {
                        method: 'get',
                        url: 'https://slack.com/api/conversations.replies?channel='+channelID+'&ts='+messageTS,
                        headers: {
                            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                            'Content-Type': 'application/json'
                        },
                    };
                    
                    const answerRes = await axios(answerConfig);
                    console.log("Answer Result: ", answerRes);
                    
                    const answerTS = answerRes.data.messages[1].ts
                    
                    let linkConfig = {
                        method: 'get',
                        url: 'https://slack.com/api/chat.getPermalink?channel='+channelID+'&message_ts='+answerTS,
                        headers: {
                            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                            'Content-Type': 'application/json'
                        },
                    };
                    
                    const linkRes = await axios(linkConfig);
                    console.log("link: ", linkRes);
                    
                    let aUUID = uuidv4();
                    let newLink = linkRes.data.permalink;

                    // Create the Answer in the DB
                    let createAnswerParams = {
                        queryPt1: "insert into Answer (AnswerID, AnswerLink, Upvotes)values (\'"+aUUID+"\',",
                        link: newLink,
                        queryPt2: ","+0+")"
                      }
          
                    let createAnswerConfig = {
                      method: 'post', 
                      url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                      data: createAnswerParams
                    }; 
    
                    const createAnswerRes = await axios(createAnswerConfig);
                    console.log('Create Answer Call: ', createAnswerRes)

                    // Get the User
                    let slackUserID = nlpRes.data.body[i].user;

                    let getUser2Config = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query:'select * from SlackUser where SlackWorkspaceID=\"'+wUUID+'\" and SlackID=\"'+slackUserID+'\"'}
                    };
                        
                    const getUser2Res = await axios(getUser2Config);
                    console.log('Get User Call: ', getUser2Res);

                    let uUUID = getUser2Res.data.body[0].SlackUserID;
                    let qUUID = uuidv4();
                    let ts = nlpRes.data.body[i].ts;
                    let text = nlpRes.data.body[i].text;

                    let vectorParams = {
                        raw_text : text
                    }

                    // Get the TextVector
                    let vectorConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/questiontovec',
                        raw_text: text
                    }

                    const vectorRes = await axios(vectorConfig);
                    console.log("Question To Vec Call: ", vectorRes);

                    let vector = {}; // Get the actual vector here

                    // Insert Question into DB
                    let createQuestionConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query: 'insert into Question (QuestionID, AnswerID, SlackChannelID, UserID, Ts, RawText, TextVector)values (\"'+qUUID+'\",\"'+aUUID+'\",\"'+cUUID+'\",\"'+uUUID+'\",\"'+ts+'\",\"'+text+'\",\"'+vector+'\")'}
                    };
                
                    const dbRes = await axios(config);
                    console.log('Db Call: ', dbRes)
                    
                }
            }
            
            break;
        }
    }
    return response;
};

function buildResponse(statusCode, event) {
    if(event.hasOwnProperty('challenge')){
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
            challenge: event.challenge
        }
    } else{
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
        }
    }
  
}

