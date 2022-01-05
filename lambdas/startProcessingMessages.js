const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");
const axios = require("axios");
const client = new SQSClient();
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {

  const channelID = event.channelID;
  const channelUUID = event.channelUUID;

  // Because this is a new channel we need to add all messages into the DB
  //console.log("start getting all messages in channel by pagination");
  let cursor = null;
  let channelMessages = [];

  let getBotTokenSql =
    `select SlackToken.BotToken from SlackToken 
      join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
      where SlackChannel.ChannelID = :channelID`;

  let getBotTokenResult = await data.query(getBotTokenSql, {
    channelID: event.channelID,
  });

  let botToken = getBotTokenResult.records[0].BotToken;

  do {
    let cursorParam;

    // Logic to send no cursor paramater the first call
    if (cursor !== null) {
      cursorParam = "&cursor=" + cursor;
    } else {
      cursorParam = "";
    }

    let getChannelMessagesConfig = {
      method: "get",
      url:
        "https://slack.com/api/conversations.history?channel=" +
        channelID +
        "&limit=200" +
        cursorParam,
      headers: {
        Authorization:
          "Bearer " + botToken,
        "Content-Type": "application/json",
      },
    };

    const getChannelMessagesResult = await axios(getChannelMessagesConfig);

    //console.log("Get Channel Messages Call:", getChannelMessagesResult);

    channelMessages = channelMessages.concat(
      getChannelMessagesResult.data.messages
    );

    // Logic to decide if need to continue paginating
    if (
      !getChannelMessagesResult.data.hasOwnProperty("response_metadata") ||
      getChannelMessagesResult.data.response_metadata.next_cursor === ""
    ) {
      // Response has no next_cursor property set so we are done paginating!
      //console.log("no cursor in response, done paginating");
      cursor = null;
    } else if ( // TODO: check to make sure this condition works
      Date.now() / 1000 - channelMessages[channelMessages.length - 1].ts >
      60 * 60 * 24 * 365
    ) {
      // Oldest message in response is more than 1 year old, stop paginating!
      /*console.log(
        "Oldest message in response is more than 1 year old, stop paginating!"
      );*/
      cursor = null;
    } else {
      cursor =
        getChannelMessagesResult.data.response_metadata.next_cursor.replace(
          /=/g,
          "%3D"
        );
      //console.log("cursor found in result, encoding and paginating");
    }
  } while (cursor !== null); // When done paginating cursor will be set to null

  //console.log(channelMessages.length);
  //console.log("about to enter for loop");
  let batch_size = 5;
  for (let i = 0; i < channelMessages.length; i += batch_size) {
    //console.log("hit for loop");
    let channelMessagesBatch = channelMessages.slice(i, i + batch_size);
    //console.log(channelMessagesBatch);
    let sqsSendBatchMessageEntries = channelMessagesBatch.map(
      (message, index) => ({
        Id: index,
        MessageBody: JSON.stringify({
          message: message,
          channelID: channelID,
          channelUUID: channelUUID,
        }),
      })
    );

    //console.log(sqsSendBatchMessageEntries);
    let sqsSendBatchMessageInput = {
      Entries: sqsSendBatchMessageEntries,
      QueueUrl:
        "https://sqs.us-east-2.amazonaws.com/579534454884/slackChannelAddedMessages", // Don't hardcode
    };
    let command = new SendMessageBatchCommand(sqsSendBatchMessageInput);
    let response = await client.send(command);
    //console.log(response);
  }

  let msgParams = {
    channel: channelID,
    text: "Thank you for adding me to your channel! Feel free to start using me right away, but I will be more helpful after a minute or two."
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

  return {
    statusCode: 200,
    body: JSON.stringify("Messages sent to SQS!"),
  };
};
