const axios = require('axios')
const qs = require('qs')
const parseJson = require('parse-json')
const {v4: uuidv4} = require("uuid");

const answerPath = "answer";

exports.handler = async (event, context) => {
    console.log("Request: ", event)
    let body = parseJson(qs.parse(event.body).payload)
    
    console.log("body: ", body)
    let response;
    
    switch (true) {
      case body.type === 'block_actions': {
        response = buildResponse(200,body);
        
        let actionID = body.actions[0].action_id;
        let responseURL = body.response_url;
        
        switch(true) {
          case actionID.includes('dismiss'):{
            // UX/ENG Question: Should we decrease upvotes when dismiss is pressed?
            let dismissParams = {
              delete_original: "true",
            };
            
            let dismissConfig = {
              method: 'post',
              url: responseURL,
              data: dismissParams
            };
            
            const dismissRes = await axios(dismissConfig);
            console.log("Dismiss Result: ", dismissRes);
            
            break;
          }
          case actionID.includes('nothelpful'):{
            let notHelpfulParams = {
              replace_original: "true",
              text: "Thank you for making Osmosix more accurate!"
            };
            
            let notHelpfulConfig = {
              method: 'post',
              url: responseURL,
              data: notHelpfulParams
            };
            
            const notHelpfulRes = await axios(notHelpfulConfig);
            console.log("Not Helpful Res: ", notHelpfulRes);
            
            let oldQUUID = body.actions[0].value.split(" a")[0];

            'update Answer, Question inner join Answer.AnswerID = Question.AnswerID set Answer.Upvotes = (Answer.Upvotes - 1) where Question.QuestionID =\"'+oldQUUID+'\"'
            
            // Get Question from DB
            let updateAnswerUpvotesConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'update Answer, Question inner join Answer.AnswerID = Question.AnswerID set Answer.Upvotes = (Answer.Upvotes - 1) where Question.QuestionID =\"'+oldQUUID+'\"'}
            };
                
            const updateAnswerUpvotesRes = await axios(updateAnswerUpvotesConfig);
            console.log('Update answer upvotes: ', updateAnswerUpvotesRes);
            
            // // Get the answerUUID from Question
            // // Not sure how the data will look here
            // let answerID = getQRes.data.body[0].AnswerID;
            
            // // Get Upvotes from Answer
            // let getUpvotesConfig = {
            //     method: 'get',
            //     url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=select Upvotes from Answer where AnswerID=\"'+answerID+'\"',
            // };
                
            // const getUpvotesRes = await axios(getUpvotesConfig);
            // console.log('Get Upvotes Call: ', getUpvotesRes)
            
            // //Decreasing the Upvotes count
            // // Not Sure how the data is going to look here
            // let upvotes = getUpvotesRes.data.body[0].Upvotes - 1 
            // let updateUpvotesConfig = {
            //     method: 'get',
            //     url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=update Answer set Upvotes='+upvotes+'where AnswerID=\"'+answerID+'\"',
            // };
                
            // const updateUpvotesRes = await axios(updateUpvotesConfig);
            // console.log('Update Upvotes Call: ', updateUpvotesRes)
            
            break;
          }
          case actionID.includes('helpful'):{
            
            let helpfulParams = {
              replace_original: "true",
              text: "Thank you for making Osmosix more accurate!"
            };
            
            let helpfulConfig = {
              method: 'post',
              url: responseURL,
              data: helpfulParams
            };
            
            const helpfulRes = await axios(helpfulConfig);
            console.log("Helpful Res: ", helpfulRes);
            
            
            // TODO Mark question with some kind of emoji to denote it has been answered?
            let buttonValue = body.actions[0].value.split(' ');
            let oldQUUID = buttonValue[0];
            let messageTS = buttonValue[1];
            
            // Get question
            let getQConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query: 'select * from Question where QuestionID=\"'+oldQUUID+'\"'}
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
          
            let answerID = getQRes.data.body[0].AnswerID
          
            // Get the link to the Answer for the suggestion Question
            let getLinkConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select AnswerLink from Answer where AnswerID=\"'+answerID+'\"'}
            };
                
            const getLinkRes = await axios(getLinkConfig);
            console.log('Get Answer Link Call: ', getLinkRes)
          
            let username = body.user.username;

            // Post answer in the thread
            let successfulParams = {
                thread_ts: messageTS,
                channel: body.channel.id, 
                text: "<@"+username+"> Marked "+getLinkRes.data.body[0].AnswerLink +" as helpful."
              };
            
            // Posting the confirmed answer to the users question
            let successfulConfig = {
              method: 'post',
              url: 'https://slack.com/api/chat.postMessage',
              headers: {
                'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                'Content-Type': 'application/json'
              },
              data: successfulParams
            };
            
            const successfulRes = await axios(successfulConfig);
            console.log("Successful Res: ", successfulRes);
            
            // Get Upvotes from the Answer
            let getUpvotesConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select Upvotes from Answer where AnswerID=\"'+answerID+'\"'}
            };
                
            const getUpvotesRes = await axios(getUpvotesConfig);
            console.log('Get Upvotes Call: ', getUpvotesRes)
            
            // Increasing the Upvotes count
  
            let upvotes = getUpvotesRes.data.body[0].Upvotes + 1 
            let updateUpvotesConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query:'update Answer set Upvotes='+upvotes+' where AnswerID=\"'+answerID+'\"'}
            };
                
            const updateUpvotesRes = await axios(updateUpvotesConfig);
            console.log('Update Upvotes Call: ', updateUpvotesRes)
            }

            break;
        }
        break;
      }
      case body.callback_id === answerPath:{
        response = buildResponse(200,body);
        
        let successfulAnswer = false;
        
        // first make sure that the message is inside a thread
        if(body.message.hasOwnProperty('thread_ts') && body.message.ts != body.message.thread_ts){
          successfulAnswer = true;
          
          // Grab the parent message and store it in the db with the connected answer
          let parentTS = body.message.thread_ts;
          let channelID = body.channel.id;
          let messageTS = body.message.ts;
          let userID = body.user.id;
          let workspaceID = body.team.id;

          // Get the Parent Message
          let getParentConfig = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=1&inclusive=true&latest='+parentTS,
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            };
            const getParentRes = await axios(getParentConfig);
            console.log("Individual Parent message: ", getParentRes.data.messages);

            let parentMessage = getParentRes.data.messages[0];
            let parentMsgText = parentMessage.text;

            // Make sure parent message is a question
            let params = {
              messages: getParentRes.data.messages,
            };
            
            let nlpConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/nlp',
              data: params
            };
            const nlpRes = await axios(nlpConfig);
            console.log('NLP: ', nlpRes)
            
            if(nlpRes.data.body.length != 1){
                successfulAnswer = false;
                break;
            }
          
            let msgParams = {
              channel: userID,
              text: "Thank you for marking an answer and for making Osmosix more accurate!"
            };
          
            let msgConfig = {
              method: 'post',
              url: 'https://slack.com/api/chat.postMessage',
              headers: {
                'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                'Content-Type': 'application/json'
              },
              data: msgParams
            };
            const msgRes = await axios(msgConfig);
            console.log("Answer Success: ", msgRes)

            // Get the Workspace UUID
            let getWorkspaceConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query: 'select * from SlackWorkspace where WorkspaceID=\"'+workspaceID+'\"'}
            };
              
            const getWorkspaceRes = await axios(getWorkspaceConfig);
            console.log('Get Workspace Call: ', getWorkspaceRes)
            let wUUID = getWorkspaceRes.data.body[0].SlackWorkspaceID;

            // Get the Channel
            let getChannelConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query:'select * from SlackChannel where SlackWorkspaceID=\"'+wUUID+'\" and ChannelID=\"'+channelID+'\"'}
            };
              
            const getChannelRes = await axios(getChannelConfig);
            console.log('Get Channel Call: ', getChannelRes);
            let cUUID = getChannelRes.data.body[0].SlackChannelID;

            // Get the User 
            let getUser2Config = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query:'select * from User join SlackUser on User.SlackUserID = SlackUser.SlackUserID where SlackUser.SlackWorkspaceID=\"'+wUUID+'\" and SlackUser.SlackID=\"'+userID+'\"'}
            };
              
            const getUser2Res = await axios(getUser2Config);
            console.log('Get User Call: ', getUser2Res);
            let uUUID = getUser2Res.data.body[0].UserID;

            // Get the Vector
            let vectorConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/doc2vec',
              data: {raw_text: parentMsgText}
            };

            let vectorRes = await axios(vectorConfig);
            console.log('Question To Vec Call', vectorRes);

            let vector = "{\\\"vector\\\": ["+parseJson(vectorRes.data).vector.toString() + "]}";

            // Get Answer Link
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
            
            let aUUID = uuidv4();
            let newLink = linkRes.data.permalink;

            let createAnswerParams = {
              queryPt1: "insert into Answer (AnswerID, AnswerLink, Upvotes)values (\'"+aUUID+"\',",
              link: newLink,
              queryPt2: ","+1+")"
            }

            // Create the Answer 
            let createAnswerConfig = {
                method: 'post', 
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: createAnswerParams
            }; 
            const createAnswerRes = await axios(createAnswerConfig);
            console.log('Create Answer Call: ', createAnswerRes)

            let qUUID = uuidv4();

            // Insert Question into DB
            let createQuestionConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query: 'insert into Question (QuestionID, AnswerID, SlackChannelID, UserID, Ts, RawText, TextVector)values (\"'+qUUID+'\",\"'+aUUID+'\",\"'+cUUID+'\",\"'+uUUID+'\",\"'+parentTS+'\",\"'+parentMsgText+'\",\"'+vector+'\")'}
            };
  
            const createQuestionRes = await axios(createQuestionConfig);
            console.log('Create Question Call: ', createQuestionRes);
        } 
        let userID = body.user.id;

        if(!successfulAnswer){
          // Send dm to user saying you can only mark messages that are in a thread as an answer
          
          let msgParams = {
            channel: userID,
            text: "Uh oh! Thank you for marking an answer, but please make sure to only mark answers in threads where the parent message is a question."
          };
          
          let msgConfig = {
              method: 'post',
              url: 'https://slack.com/api/chat.postMessage',
              headers: {
                'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                'Content-Type': 'application/json'
            },
            data: msgParams
          };
          const msgRes = await axios(msgConfig);
          console.log("Answer Failure: ", msgRes)
        }else{
            let msgParams = {
                thread_ts: body.message.message_ts, 
                channelID: body.channel.id, 
                text: "<@"+userID+"> Marked \""+body.message.text +"\" as the answer."
              };
            
            // Posting the confirmed answer to the users question
            // TODO: Fix bug here
            let msgConfig = {
              method: 'post',
              url: 'https://slack.com/api/chat.postMessage',
              headers: {
                'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                'Content-Type': 'application/json'
              },
              data: msgParams
            };
            let msgRes = await axios(msgConfig);
            console.log("Answer Success: ", msgRes)
        }
        break;
      }
    }
    return response;
};

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
  }
}