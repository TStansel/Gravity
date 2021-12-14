const axios = require("axios");

exports.handler = async (event) => {
    event = event.payload.payload
    console.log("Request Event",event.message)
    if(event.message.hasOwnProperty('thread_ts') && event.message.ts != event.message.thread_ts){
        
        let channelID = event.channel.id;
        let parentTS = event.message.thread_ts;
        
        let getParentConfig = {
                method: 'get',
                url: 'https://slack.com/api/conversations.history?channel='+channelID+'&limit=1&inclusive=true&latest='+parentTS,
                headers: {
                    'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
                    'Content-Type': 'application/json'
                },
        };
        
        const getParentRes = await axios(getParentConfig);
        
        let parentMessage = getParentRes.data.messages[0];
        let parentMsgText = parentMessage.text;
        
        let payload = {
            data: {
                parentTS: parentTS,
                channelID: channelID,
                messageTS: event.message.ts,
                userID: event.user.id,
                worksapceID: event.team.id,
                text: parentMsgText
            },
            passed: true
        }
        return { payload: payload }
    } else {
        let payload = {
            data: {

            },
            passed: false
        }
        return { payload: payload }
    }
};
