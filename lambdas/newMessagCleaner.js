exports.handler = async (event) => {
    let messageEvent = event.payload.payload
    console.log("Request Event:",messageEvent)
    
    if(!messageEvent.hasOwnProperty('thread_ts') || messageEvent.messageID === messageEvent.thread_ts){
        let messageText = messageEvent.text;
        let channelID = messageEvent.channelID;
        let messageID = messageEvent.messageID;
        let userID = messageEvent.userID;
        
        let payload = {
            data: {
                text: messageText,
                channelID: channelID,
                messageID: messageID,
                userID: userID,
            },
            passed:true
        }
        
        return buildResponse(payload);
    }
    event["passed"] = false
    return buildResponse(event);
};

function buildResponse(payload) {
    return {
        payload: payload
    };
}
