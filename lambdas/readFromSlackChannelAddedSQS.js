const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { v4: uuidv4 } = require("uuid");
const parseJson = require("parse-json");
const client = new SFNClient();

exports.handler = async (event) => {
  console.log(event);
  let sqsMessage = parseJson(event.Records[0].body);
  
  let data;

  if(sqsMessage.message.hasOwnProperty("thread_ts")){
    data = {
      text: sqsMessage.message.text,
      channelID: sqsMessage.channelID,
      messageID: sqsMessage.message.ts,
      userID: sqsMessage.message.user,
      thread_ts: sqsMessage.message.thread_ts
    };
  }else{
      return {
    statusCode: 200,
    body: JSON.stringify("Slack message did not have thread_ts"),
  };
  }


  let input = {
    stateMachineArn:
      "arn:aws:states:us-east-2:579534454884:stateMachine:Single-Message-Processing",
    name: uuidv4(),
    input: JSON.stringify({
      payload: data,
    }),
  };

  const command = new StartExecutionCommand(input);
  const response = await client.send(command);

  console.log("New Message:", response);

  return {
    statusCode: 200,
    body: JSON.stringify("passed message from queue to step function"),
  };
};
