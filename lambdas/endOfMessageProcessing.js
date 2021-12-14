const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});
const { v4: uuidv4 } = require("uuid");

exports.handler = async (event) => {

  let insertQuestionSql =
  `insert into SlackQuestion (SlackQuestionUUID,
    SlackAnswerUUID,
    SlackChannelUUID,
    SlackUserUUID,
    Ts,
    RawText,
    TextVector)
    values (:SlackQuestionUUID,
      NULL,
      (select SlackChannelUUID from SlackChannel where ChannelID = :slackChannelID limit 1),
      (select SlackUserUUID from SlackUser where SlackID = :slackID limit 1),
      :Ts,
      :RawText,
      :TextVector)`


  let insertQuestionResult = await data.query(insertQuestionSql, {
    SlackQuestionUUID: uuidv4(),
    slackChannelID: event.channelID,
    slackID: event.userID,
    Ts: event.messageID,
    RawText: event.text,
    TextVector: event.vector
  });

  console.log("insertQuestionResult: ", insertQuestionResult);

  const response = {
      statusCode: 200,
      body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};
