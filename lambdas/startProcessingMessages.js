const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");
const axios = require("axios");
const client = new SQSClient();

exports.handler = async (event) => {
  // TODO implement

  const channelID = event.payload.channelID;
  const channelUUID = event.payload.channelUUID;

  // Because this is a new channel we need to add all messages into the DB
  console.log("start getting all messages in channel by pagination");
  let cursor = null;
  let channelMessages = [];

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
          "Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK", // TODO: don't hardcode
        "Content-Type": "application/json",
      },
    };

    const getChannelMessagesResult = await axios(getChannelMessagesConfig);

    console.log("Get Channel Messages Call:", getChannelMessagesResult);

    channelMessages = channelMessages.concat(
      getChannelMessagesResult.data.messages
    );

    // Logic to decide if need to continue paginating
    if (
      !getChannelMessagesResult.data.hasOwnProperty("response_metadata") ||
      getChannelMessagesResult.data.response_metadata.next_cursor === ""
    ) {
      // Response has no next_cursor property set so we are done paginating!
      console.log("no cursor in response, done paginating");
      cursor = null;
    } else if (
      Date.now() / 1000 - channelMessages.at(-1).ts >
      60 * 60 * 24 * 365
    ) {
      // Oldest message in response is more than 1 year old, stop paginating!
      console.log(
        "Oldest message in response is more than 1 year old, stop paginating!"
      );
      cursor = null;
    } else {
      cursor =
        getChannelMessagesResult.data.response_metadata.next_cursor.replace(
          /=/g,
          "%3D"
        );
      console.log("cursor found in result, encoding and paginating");
    }
  } while (cursor !== null); // When done paginating cursor will be set to null

  let batch_size = 5;
  for (let i = 0; i < channelMessages.length; i += batch_size) {
    console.log("slicing from i: " + i + " to i: " + i + batch_size - 1);
    let sqsSendBatchMessageEntries = channelMessages
      .slice(i, i + batch_size - 1)
      .map((message) => {
        Id: message.ts;
        MessageBody: JSON.stringify(message);
      });
    let sqsSendBatchMessageInput = {
      Entries: sqsSendBatchMessageEntries,
      QueueUrl:
        "https://sqs.us-east-2.amazonaws.com/579534454884/slackChannelAddedMessages", // Don't hardcode
    };
    let command = new SendMessageBatchCommand(sqsSendBatchMessageInput);
    let response = await client.send(command);
    console.log(response);
  }
  return {
    statusCode: 200,
    body: JSON.stringify("Messages sent to SQS!"),
  };
};
