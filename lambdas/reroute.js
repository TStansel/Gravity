const axios = require('axios');

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
            
            response = buildResponse(200,event);
            
            let messageEvent = event.event;
            let messageText = messageEvent.text;
            let channelID = messageEvent.channel;
            let messageID = messageEvent.ts;
            // Not sure what other data will be needed for the NLP endpoint
            //
            
            
            break;
        }
        case eventType === 'message' && eventSubtype === 'channel_join':{
            
            response = buildResponse(200,event);
            
            let messageEvent = event.event;
            let channelID = messageEvent.channel;
            
            let config = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=100000',
                headers: {
                    'token': 'xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
            };
            
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
