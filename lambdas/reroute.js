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
                    
                    console.log("trying to query database to get recent questions asked in this channel")
                    let dbConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query: "select QuestionID, TextVector from Question inner join SlackChannel on Question.SlackChannelID=SlackChannel.SlackChannelID where SlackChannel.ChannelID =\'"+channelID+"\'"}
                    };
                 
                        
                    const dbRes = await axios(dbConfig);
                    console.log('Db Call: ', dbRes)

                    let object = {
                        "new_question": [1,2 ,3, 4],
                        "old_questions": [
                            {"id": 1, "vec": [1, 2, 3, 6]},
                            {"id": 2, "vec": [1, 34, 4, 4]}
                        ]
                    }

                    let getSimilarQuestionsConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/similarity',
                        data: {payload: object}
                    }

                    const getSimilarQuestionsRes = await axios(getSimilarQuestionsConfig);
                    console.log('Similar q log: ', getSimilarQuestionsRes)
                    
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
                    
                    /* Message is now Broken down to just one row of buttons
                        TODO: Update the First Text key -> This is the text for the notification
                        TODO: Update the Text in the first block -> This is the header text that appears in each msg
                        TODO: Update the value of each button block to contain the UUID of the question
                        TODO: Update the text in the 3rd block to be hyperlinked text
                    */
                    let msg1Params = {
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
                                    "text": "<https://osmosix.slack.com/archives/C02K2H9SWG6/p1638381142005300?thread_ts=1638381114.005100&cid=C02K2H9SWG6|Example Suggestion>"
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
                                        "action_id": "helpful"
                                    },
                                    {
                                        "type": "button",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Not Helpful"
                                        },
                                    "value": "notHelpful",
                                    "action_id": "nothelpful"
                                    },
                                    {
                                        "type": "button",
                                        "style": "danger",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Dismiss"
                                        },
                                        "value": "dismiss",
                                        "action_id": "dismiss"
                                    }
                                ]
                            },
                        ]
                    }
                    let msg1Config = {
                        method: 'post',
                        url: 'https://slack.com/api/chat.postEphemeral',
                        headers: {
                            'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                            'Content-Type': 'application/json'
                        },
                        data: msg1Params
                    };
                    const msg1Res = await axios(msg1Config);
                    console.log("Message One Sent: ",msg1Res);
                
                }
                
            }
            
            
            break;
        }
        case eventType === 'message' && eventSubtype === 'channel_join':{
            // TODO: Add something about only going in if the App Id matches?
            
            // Bot was added to a channel
            response = buildResponse(200,event);
            
            // Check if the Workspace is already in the DB
            let teamID = event.team_id;
            let getWorkspaceConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query: 'select * from SlackWorkspace where WorkspaceID=\"'+teamID+'\"'}
            };
                
            const getWorkspaceRes = await axios(getWorkspaceConfig);
            console.log('Get Workspace Call: ', getWorkspaceRes)
            
            let wUUID;

            if(getWorkspaceRes.data.body.length === 0){ // Workspace does not exist in the DB
                // Get needed info about workspace
                let teamConfig = {
                    method: 'get',
                    url: 'https://slack.com/api/team.info?team='+teamID,
                    headers: {
                        'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                        'Content-Type': 'application/json'
                    },
                }
                const teamRes = await axios(teamConfig);
                console.log("Get Team Call:", teamRes)

                let teamName = teamRes.data.team.name;
                wUUID = uuidv4();
                
                // Insert workspace into DB
                let createWorkspaceConfig = {
                    method: 'post',
                    url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                    data: {query: 'insert into SlackWorkspace (SlackWorkspaceID, WorkspaceID, Name)values (\"'+wUUID+'\",\"'+teamID+'\",\"'+teamName+'\")'}
                };
                
                const createWorkspaceRes = await axios(createWorkspaceConfig);
                console.log('Create Workspace Call: ', createWorkspaceRes)
            }else{
                wUUID = getWorkspaceRes.data.body[0].SlackWorkspaceID; // get UUID from get Call to be used in SlackChannel Creation
            }

            // Check if channel exists in Db
            let messageEvent = event.event;
            let channelID = messageEvent.channel;

            let getChannelConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select * from SlackChannel where SlackWorkspaceID=\"'+wUUID+'\" and ChannelID=\"'+channelID+'\"'}
            };
                
            const getChannelRes = await axios(getChannelConfig);
            console.log('Get Channel Call: ', getChannelRes);

            let cUUID;

            if(getChannelRes.data.body.length === 0){ // Channel does not exist in the DB
                cUUID = uuidv4();

                // Get needed info about Channel
                let getChannelInfoConfig = {
                    method: 'get',
                    url: 'https://slack.com/api/conversations.info?channel='+channelID,
                    headers: {
                        'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                        'Content-Type': 'application/json'
                    },
                };
                
                const getChannelInfoRes = await axios(getChannelInfoConfig);
                console.log("Get Channel Info Call:",getChannelInfoRes);

                let channelName = getChannelInfoRes.data.channel.name;

                // Insert channel into DB
                let createChannelConfig = {
                    method: 'post',
                    url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                    data: {query: 'insert into SlackChannel (SlackChannelID, SlackWorkspaceID, ChannelID, Name)values (\"'+cUUID+'\",\"'+wUUID+'\",\"'+channelID+'\",\"'+channelName+'\")'}
                };
                
                const createChannelRes = await axios(createChannelConfig);
                console.log('Create Channel Call: ', createChannelRes)

                // Because this is a new channel we need to add all users into the DB if they dont exist

                // Get 100,000 users from the Channel (should be all?)
                let getChannelUsersConfig = {
                    method: 'get',
                    url: 'https://slack.com/api/conversations.members?channel='+channelID+'&limit=100000',
                    headers: {
                        'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                        'Content-Type': 'application/json'
                    },
                };
                
                const getChannelUsersRes = await axios(getChannelUsersConfig);
                console.log("Get Channel Users Call:",getChannelUsersRes);

                let members = getChannelUsersRes.data.members;

                for(let i = 0; i < members.length; i++){
                    let slackUID = members[i];
                    // Get User from DB if they exist
                    let getUserConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query:'select * from SlackUser where SlackWorkspaceID=\"'+wUUID+'\" and SlackID=\"'+slackUID+'\"'}
                    };
                        
                    const getUserRes = await axios(getUserConfig);
                    console.log('Get User Call: ', getUserRes);

                    if(getUserRes.data.body.length === 0){ // User does not exist in DB

                        // Get needed info about user
                        let getUsersInfoConfig = {
                            method: 'get',
                            url: 'https://slack.com/api/users.info?user='+slackUID,
                            headers: {
                                'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                                'Content-Type': 'application/json'
                            },
                        };
                        
                        const getUsersInfoRes = await axios(getUsersInfoConfig);
                        console.log("Get Users Info Call:",getUsersInfoRes);

                        let name = getUsersInfoRes.data.user.real_name;
                        let uUUID = uuidv4();

                        // Insert user into DB
                        let createUserConfig = {
                            method: 'post',
                            url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                            data: {query: 'insert into SlackUser (SlackUserID, SlackWorkspaceID, Name, SlackID)values (\"'+uUUID+'\",\"'+wUUID+'\",\"'+name+'\",\"'+slackUID+'\")'}
                        };
                
                        const createUserRes = await axios(createUserConfig);
                        console.log('Create User Call: ', createUserRes)
                    }

                }

            } else {
                cUUID = getChannelRes.data.body[0].SlackChannelID
            }

            
            
            // Grab the 100,000 most recent messages
            let getHistoryConfig = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=100000',
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            };
            
            const getHistoryRes = await axios(getHistoryConfig);
            
            let messages = getHistoryRes.data.messages;
            // let hasMoreMessages = res.data.has_more;
            console.log('Get History Call: ', getHistoryRes.data);
            
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
                    // Get the Link to the Answer Message
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

                    let vectorConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/doc2vec',
                        data: {raw_text: text}
                    }

                    let vectorRes = await axios(vectorConfig);
                    console.log('Question To Vec Call', vectorRes);

                    let vector = JSON.parse(vectorRes.data);

                    // Insert Question into DB
                    let createQuestionConfig = {
                        method: 'post',
                        url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                        data: {query: 'insert into Question (QuestionID, AnswerID, SlackChannelID, UserID, Ts, RawText, TextVector)values (\"'+qUUID+'\",\"'+aUUID+'\",\"'+cUUID+'\",\"'+uUUID+'\",\"'+ts+'\",\"'+text+'\",\"'+vector+'\")'}
                    };
            
                    const createQuestionRes = await axios(createQuestionConfig);
                    console.log('Create Question Call: ', createQuestionRes);

                    
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
