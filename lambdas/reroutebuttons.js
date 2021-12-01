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
            
            let qUUID = body.actions.value;
            
            let getQConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select AnswerID from Question
                where QuestionID=`+qUUID,
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
            
            // Not sure how the data is going to look here
            let answerID = getQRes.data[0]
            
            let getUpvotesConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select Upvotes from Answer
                where AnswerID=`+answerID,
            };
                
            const getUpvotesRes = await axios(getUpvotesConfig);
            console.log('Get Upvotes Call: ', getUpvotesRes)
            
            // Not Sure how the data is going to look here
            let upvotes = getUpvotesRes.data[0] - 1 //Decreasing the Upvotes count
            let updateUpvotesConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                update Answer
                set Upvotes = `+upvotes+`
                where AnswerID=`+answerID,
            };
                
            const updateUpvotesRes = await axios(updateUpvotesConfig);
            console.log('Update Upvotes Call: ', updateUpvotesRes)
            
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
            
            let qUUID = body.actions.value;
            
            let getQConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select * from Question
                where QuestionID=`+qUUID,
            };
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
          
            // Not sure how the data is going to look here
            let answerID = getQRes.data[0].answerID
            let questionTS = getQRes.data[0].ts
          
            // Get the link to the Answer for the suggestion Question
            let getLinkConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select AnswerLink from Answer
                where AnswerID=`+answerID,
            };
                
            const getLinkRes = await axios(getLinkConfig);
            console.log('Get Answer Link Call: ', getLinkRes)
          
            // Post answer in the thread
            let successfulParams = {
                thread_ts: questionTS, // Not sure how this data will look here
                channelID: body.channel.id, 
                text: getLinkRes.data[0] // Not sure how the data will look here
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
          
            let getUpvotesConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select Upvotes from Answer
                where AnswerID=`+answerID,
            };
                
            const getUpvotesRes = await axios(getUpvotesConfig);
            console.log('Get Upvotes Call: ', getUpvotesRes)
            
            // Not Sure how the data is going to look here
            let upvotes = getUpvotesRes.data[0] + 1 // Increasing the Upvotes count
            let updateUpvotesConfig = {
              method: 'get',
              url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                update Answer
                set Upvotes = `+upvotes+`
                where AnswerID=`+answerID,
            };
                
            const updateUpvotesRes = await axios(updateUpvotesConfig);
            console.log('Update Upvotes Call: ', updateUpvotesRes)
            
            }
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
            
            let userID = body.user.id;
          
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
            // TODO: Find parent message in db
            let getQConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                select * from Question
                inner join SlackChannel 
                on Question.ChannelID = SlackChannel.SlackChannelID
                where Question.ts=`+parentTS + ' and SlackChannel.ChannelID='+channelID,
            }; // Join on the foreign key of the SlackChannelID in Slack and then grab the message
            // with the timestamp in that channel (needed this way because TS are unique per channel)
                
            const getQRes = await axios(getQConfig);
            console.log('Get Q Call: ', getQRes)
            
            // TODO: Update the answer for the parent message with the messageTS and the channelID
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
            
            // Create the Answer 
            let createAnswerConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                insert into Answer (AnswerID, AnswerLink)
                values (`+aUUID+','+linkRes.data+')' // Not sure how the data looks for this link
            }; 
            const createAnswerRes = await axios(createAnswerConfig);
            console.log('Create Answer Call: ', createAnswerRes)
            
            let updateQConfig = {
                method: 'get',
                url: `https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls?query=
                update Question
                set AnswerID = `+aUUID+`
                where QuestionID=`+getQRes.data[0] // Not sure how the data will look here
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