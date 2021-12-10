const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
  // TODO: Add auth for axios slack calls
  // TODO: Send a message when this case starts and ends to let users know that the app is working on adding the history and when it is finished

  // Bot was added to a channel
  console.log(event);

  // Check if the Workspace is already in the DB
  console.log("check if workspace is in DB");

  let getWorkspaceSql =
    "select * from SlackWorkspace where WorkspaceID = :workspaceID";
  let workspaceID = event.payload.workspaceID;

  let getWorkspaceResult = await data.query(getWorkspaceSql, {
    workspaceID: workspaceID,
  });

  console.log("getWorkspaceresult: ", getWorkspaceResult);

  let workspaceUUID;

  // Check if workspace was in database
  if (getWorkspaceResult.records.length === 0) {
    // Workspace does not exist, get slack channel

    console.log("calling slack api to get workspace name");

    let getSlackWorkspaceNameConfig = {
      method: "get",
      url: "https://slack.com/api/team.info?team=" + workspaceID,
      headers: {
        Authorization:
          "Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK", // TODO: stop this from being hard-coded
        "Content-Type": "application/json",
      },
    };

    const getSlackWorkspaceNameResult = await axios(
      getSlackWorkspaceNameConfig
    );

    console.log("Get Workspace Name Call:", getSlackWorkspaceNameResult);

    // Add workspace to DB

    let workspaceName = getSlackWorkspaceNameResult.data.team.name;
    workspaceUUID = uuidv4();

    let insertWorkspaceSql =
      "insert into SlackWorkspace (SlackWorkspaceUUID, WorkspaceID, Name) values (:SlackWorkspaceUUID, :WorkspaceID, :Name)";

    let insertWorkspaceResult = await data.query(insertWorkspaceSql, {
      SlackWorkspaceUUID: workspaceUUID,
      WorkspaceID: workspaceID,
      Name: workspaceName,
    });

    console.log("insertWorkspaceResult: ", insertWorkspaceResult);
  } else {
    // get UUID from get Call to be used in SlackChannel Creation
    workspaceUUID = getWorkspaceResult.records[0].SlackWorkspaceUUID;
  }

  // Check if slack channel exists in DB
  console.log("check if slack channel is in DB");

  let channelID = event.payload.channelID;

  let getChannelSql =
    "select * from SlackChannel where SlackWorkspaceUUID = :workspaceUUID and ChannelID = :channelID";

  let getChannelResult = await data.query(getChannelSql, {
    workspaceUUID: workspaceUUID,
    channelID: channelID,
  });

  console.log("getChannelResult: ", getChannelResult);

  let channelUUID;

  // If the channel already exists skip the steps of putting all channel users in DB
  if (getChannelResult.records.length > 0) {
    console.log("Channel already exists in DB (unexpected)");
    channelUUID = getChannelResult.records[0].SlackChannelUUID;
    return { channelID: channelID, channelUUID: channelUUID };
  }

  // Slack channel does not exist in DB
  console.log("Channel does not exist in DB");

  channelUUID = uuidv4();

  // Get needed info about Channel
  let getChannelInfoConfig = {
    method: "get",
    url: "https://slack.com/api/conversations.info?channel=" + channelID,
    headers: {
      Authorization:
        "Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK", // TODO: don't hard code this
      "Content-Type": "application/json",
    },
  };

  const getChannelInfoResult = await axios(getChannelInfoConfig);
  console.log("Get Channel Info Call:", getChannelInfoResult);

  // Insert channel into DB
  let channelName = getChannelInfoResult.data.channel.name;

  let insertChannelSql =
    "insert into SlackChannel (SlackChannelUUID, SlackWorkspaceUUID, ChannelID, Name) values (:channelUUID, :workspaceUUID, :channelID, :channelName)";

  let insertChannelResult = await data.query(insertChannelSql, {
    channelUUID: channelUUID,
    workspaceUUID: workspaceUUID,
    channelID: channelID,
    channelName: channelName,
  });

  console.log("insertChannelResult: ", insertChannelResult);

  // Because this is a new channel we need to add all users into the DB if they dont exist
  console.log("start getting all users in channel by pagination");
  let cursor = null;
  let channelMembers = [];

  do {
    let cursorParam;

    // Logic to send no cursor paramater the first call
    if (cursor !== null) {
      cursorParam = "&cursor=" + cursor;
    } else {
      cursorParam = "";
    }

    let getChannelUsersConfig = {
      method: "get",
      url:
        "https://slack.com/api/conversations.members?channel=" +
        channelID +
        "&limit=200" +
        cursorParam,
      headers: {
        Authorization:
          "Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK", // TODO: don't hardcode
        "Content-Type": "application/json",
      },
    };

    const getChannelUsersResult = await axios(getChannelUsersConfig);

    console.log("Get Channel Users Call:", getChannelUsersResult);

    channelMembers = channelMembers.concat(getChannelUsersResult.data.members);

    // Logic to decide if need to continue paginating
    if (
      !getChannelUsersResult.data.hasOwnProperty("response_metadata") ||
      getChannelUsersResult.data.response_metadata.next_cursor === ""
    ) {
      // Response has no next_cursor property set so we are done paginating!
      console.log("no cursor in response, done paginating");
      cursor = null;
    } else {
      cursor = getChannelUsersResult.data.response_metadata.next_cursor.replace(
        /=/g,
        "%3D"
      );
      console.log("cursor found in result, encoding and paginating");
    }
  } while (cursor !== null); // When done paginating cursor will be set to null

  // Now get all users from the workspace in the DB in order to add new users
  console.log("Get all users in workspace");

  let getWorkspaceUsersSql =
    "select SlackUserUUID from SlackUser where SlackWorkspaceUUID = :workspaceUUID";

  let getWorkspaceUsersResult = await data.query(getWorkspaceUsersSql, {
    workspaceUUID: workspaceUUID,
  });

  console.log("getWorkspaceUsersResult: ", getWorkspaceUsersResult);

  let slackUserIdDict = {}
  for (let row of getWorkspaceUsersResult.records) {
    slackUserIdDict[row.SlackUserID] = row.UserID;
  }

  let membersNotInDB = channelMembers.filter(slackID => slackUserIdDict[slackID] === undefined);

  console.log("channelMembers: ", channelMembers);
  console.log("membersNotInDB: ", membersNotInDB);

  // Now add these new users to SlackUser in DB
  console.log("trying to add new SlackUsers");

  let batchInsertNewSlackUserSql =
    "insert into SlackUser (SlackUserUUID, SlackWorkspaceUUID, SlackID) values (:slackUserUUID, :workspaceUUID, :slackID)";

  // Prepare list of users to insert
  let batchInsertSlackUsersParams = membersNotInDB.map(slackID => [{slackUserUUID: uuidv4(), workspaceUUID: workspaceUUID, slackID: slackID}])

  console.log("batchInsertSlackUsersParams: ", batchInsertSlackUsersParams);

  let batchInsertNewSlackUserResult = await data.query(batchInsertNewSlackUserSql, batchInsertSlackUsersParams);

  console.log("batchInsertNewSlackUserResult: ", batchInsertNewSlackUserResult);

  return { channelID: channelID, channelUUID: channelUUID };
};

