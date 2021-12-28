const axios = require('axios')
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

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
