exports.handler = async (event) => {
    let messageEvent = event.payload;
    console.log("Request Event:",messageEvent)
    
    let payload;
    if(!messageEvent.hasOwnProperty('thread_ts') || messageEvent.messageID === messageEvent.thread_ts){
        payload = {
            data: {
                text: messageEvent.text,
                channelID: messageEvent.channelID,
                messageID: messageEvent.messageID,
                userID: messageEvent.userID,
                isNewMessageFlow: messageEvent.hasOwnProperty("isNewMessageFlow") ? messageEvent.isNewMessageFlow : undefined
            },
            passed:true
        };
    }else{
        payload = {
            data: {
                text: messageEvent.text,
                channelID: messageEvent.channelID,
                messageID: messageEvent.messageID,
                userID: messageEvent.userID,
            },
            passed:false
        }
    }
    return { payload: payload };
};
