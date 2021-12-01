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
            
            let qUUID = body.actions[0].value;
            
            // Get Question from DB
            let getQConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select AnswerID from Question where QuestionID=\"'+qUUID+'\"'}
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes);
            
            // Get the answerUUID from Question
            // Not sure how the data will look here
            let answerID = getQRes.data[0].AnswerID;
            
            // Get Upvotes from Answer
            let getUpvotesConfig = {
                method: 'get',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=select Upvotes from Answer where AnswerID=\"'+answerID+'\"',
            };
                
            const getUpvotesRes = await axios(getUpvotesConfig);
            console.log('Get Upvotes Call: ', getUpvotesRes)
            
            //Decreasing the Upvotes count
            // Not Sure how the data is going to look here
            let upvotes = getUpvotesRes.data[0].Upvotes - 1 
            let updateUpvotesConfig = {
                method: 'get',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=update Answer set Upvotes='+upvotes+'where AnswerID=\"'+answerID+'\"',
            };
                
            const updateUpvotesRes = await axios(updateUpvotesConfig);
            console.log('Update Upvotes Call: ', updateUpvotesRes)
            
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
            
            let qUUID = body.actions[0].value;
            
            // Get question
            let getQConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query: 'select * from Question where QuestionID=\"'+qUUID+'\"'}
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
          
            // Not sure how the data is going to look here
            let answerID = getQRes.data[0].AnswerID
            let questionTS = getQRes.data[0].Ts
          
            // Get the link to the Answer for the suggestion Question
            let getLinkConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select AnswerLink from Answer where AnswerID=\"'+answerID+'\"'}
            };
                
            const getLinkRes = await axios(getLinkConfig);
            console.log('Get Answer Link Call: ', getLinkRes)
          
            let username = body.name.username;

            // Post answer in the thread
            let successfulParams = {
                thread_ts: questionTS, // Not sure how this data will look here
                channelID: body.channel.id, 
                text: "<@"+username+"> Marked "+getLinkRes.data[0].AnswerLink +"as helpful."// Not sure how the data will look here
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
            // Not Sure how the data is going to look here
            let upvotes = getUpvotesRes.data[0].Upvotes + 1 
            let updateUpvotesConfig = {
              method: 'post',
              url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
              data: {query:'update Answer set Upvotes='+upvotes+'where AnswerID=\"'+answerID+'\"'}
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
          
          // Get the Parent Message
          let getParentConfig = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=1&latest='+parentTS,
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            };
            const getParentRes = await axios(getParentConfig);
            console.log("Individual message: ", getParentRes.data.messages);

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
            
            let parentMessage = getParentRes.data.messages[0];

            //Find parent message in db
            let getQConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'select * from Question join SlackChannel on Question.SlackChannelID=SlackChannel.SlackChannelID where Question.Ts=\"'+parentTS + '\" and SlackChannel.ChannelID=\"'+channelID+'\"'}
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
            
            // Update the answer for the parent message with the link
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

            // Create the Answer 
            let createAnswerConfig = {
                method: 'post', // link getting parsed
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query: "insert into Answer (AnswerID, AnswerLink, Upvotes)values (\'"+aUUID+"\',\'"+newLink+"\',"+1+")"}
            }; 
            const createAnswerRes = await axios(createAnswerConfig);
            console.log('Create Answer Call: ', createAnswerRes)
            
            let qUUID = getQRes.data[0].QuestionID;  // Not sure how the data will look here

            // Update the Question's Answer ID
            let updateQConfig = {
                method: 'post',
                url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
                data: {query:'update Question set AnswerID=\"'+aUUID+'\"where QuestionID=\"'+qUUID+'\"'}
            }; 
            const updateQRes = await axios(updateQConfig);
            console.log('Create Answer Call: ', updateQRes)
          
        } 
        
        if(!successfulAnswer){
          // Send dm to user saying you can only mark messages that are in a thread as an answer
          let userID = body.user.id;
          
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