const axios = require("axios");

exports.handler = async (event) => {
    //console.log("Request Event: ",event)
    let msgParams = {
        channel: event.userID,
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
    
    return event
};
