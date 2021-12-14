const axios = require('axios')

exports.handler = async (event) => {
    let msgParams = {
            channel: event.userID,
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
          return msgRes
};
