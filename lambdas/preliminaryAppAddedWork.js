const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
  // TODO: Add something about only going in if the App Id matches?
  // TODO: Send a message when this case starts and ends to let users know that the app is working on adding the history and when it is finished

  // Bot was added to a channel
  console.log(event);

  // Check if the Workspace is already in the DB
  console.log("check if workspace is in DB");

  let getWorkspaceSql =
    "select * from SlackWorkspace where WorkspaceID = :workspaceID";
  let workspaceID = event.team_id;

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
      "insert into SlackWorkspace (SlackWorkspaceID, WorkspaceID, Name) values (:SlackWorkspaceID, :WorkspaceID, :Name)";

    let insertWorkspaceResult = await data.query(insertWorkspaceSql, {
      SlackWorkspaceID: workspaceUUID,
      WorkspaceID: workspaceID,
      Name: workspaceName,
    });

    console.log("insertWorkspaceResult: ", insertWorkspaceResult);
  } else {
    // get UUID from get Call to be used in SlackChannel Creation
    workspaceUUID = getWorkspaceResult.records[0].SlackWorkspaceID;
  }

  // Check if slack channel exists in DB
  console.log("check if slack channel is in DB");

  let channelID = event.event.channel;

  let getChannelSql =
    "select * from SlackChannel where SlackWorkspaceID = :workspaceUUID and ChannelID = :channelID";

  let getChannelResult = await data.query(getChannelSql, {
    workspaceUUID: workspaceUUID,
    channelID: channelID,
  });

  console.log("getChannelResult: ", getChannelResult);

  let channelUUID;

  // If the channel already exists skip the steps of putting all channel users in DB
  if (getChannelResult.records.length > 0) {
    console.log("Channel already exists in DB (unexpected)");
    channelUUID = getChannelResult.records[0].SlackChannelID;
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
    "insert into SlackChannel (SlackChannelID, SlackWorkspaceID, ChannelID, Name) values (:channelUUID, :workspaceUUID, :channelID, :channelName)";

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

    channelMembers.concat(getChannelUsersResult.data.members);

    // Logic to decide if need to continue paginating
    if (
      !getChannelUsersResult.data.hasOwnProperty("response_metadata") ||
      getChannelUsersResult.data.response_metadata === ""
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
    "select UserID, SlackUserID from User where SlackWorkspaceID = :workspaceUUID";

  let getWorkspaceUsersResult = await data.query(getWorkspaceUsersSql, {
    workspaceUUID: workspaceUUID,
  });

  console.log("getWorkspaceUsersResult: ", getWorkspaceUsersResult);

  let slackUserIdDict = {}
  for (let row of getWorkspaceUsersResult.records) {
    slackUserIdDict[row.SlackUserID] = row.UserID;
  }

  membersNotInDB = channelMembers.filter(slackID => slackUserIdDict[slackID] === undefined);

  // Now add these new users to SlackUser in DB
  console.log("trying to add new SlackUsers");

  let batchInsertNewSlackUserSql =
    "insert into SlackUser (SlackUserID, SlackWorkspaceID, SlackID) values (:slackUserUUID, :workspaceUUID, :slackID)";

  // Prepare list of users to insert
  batchInsertSlackUsersParams = membersNotInDB.map(slackID => [{slackUserUUID: uuidv4(), workspaceUUID: workspaceUUID, slackID: slackID}])

  let batchInsertNewSlackUserResult = await data.query(batchInsertNewSlackUserSql, batchInsertSlackUsersParams);

  console.log("batchInsertNewSlackUserResult: ", batchInsertNewSlackUserResult);

  // Now add these new users to User in DB
  console.log("trying to add new Users");

  let batchInsertNewUserSql =
    "insert into SlackUser (SlackUserID, SlackWorkspaceID, SlackID) values (:slackUserUUID, :workspaceUUID, :slackID)";

  // Prepare list of users to insert
  batchInsertSlackUsersParams = membersNotInDB.map(slackID => [{slackUserUUID: uuidv4(), workspaceUUID: workspaceUUID, slackID: slackID}])

  let batchInsertNewSlackUserResult = await data.query(batchInsertNewSlackUserSql, batchInsertSlackUsersParams);

  console.log("batchInsertNewSlackUserResult: ", batchInsertNewSlackUserResult);

  



  // let teamID = event.team_id;
  // let getWorkspaceConfig = {
  //     method: 'post',
  //     url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //     data: {query: 'select * from SlackWorkspace where WorkspaceID=\"'+teamID+'\"'}
  // };

  // const getWorkspaceRes = await axios(getWorkspaceConfig);
  // console.log('Get Workspace Call: ', getWorkspaceRes)

  // let wUUID;

  // if(getWorkspaceRes.data.body.length === 0){ // Workspace does not exist in the DB
  //     // Get needed info about workspace
  //     let teamConfig = {
  //         method: 'get',
  //         url: 'https://slack.com/api/team.info?team='+teamID,
  //         headers: {
  //             'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
  //             'Content-Type': 'application/json'
  //         },
  //     }
  //     const teamRes = await axios(teamConfig);
  //     console.log("Get Team Call:", teamRes)

  //     let teamName = teamRes.data.team.name;
  //     wUUID = uuidv4();

  //     // Insert workspace into DB
  //     let createWorkspaceConfig = {
  //         method: 'post',
  //         url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //         data: {query: 'insert into SlackWorkspace (SlackWorkspaceID, WorkspaceID, Name)values (\"'+wUUID+'\",\"'+teamID+'\",\"'+teamName+'\")'}
  //     };

  //     const createWorkspaceRes = await axios(createWorkspaceConfig);
  //     console.log('Create Workspace Call: ', createWorkspaceRes)
  // }else{
  //     wUUID = getWorkspaceRes.data.body[0].SlackWorkspaceID; // get UUID from get Call to be used in SlackChannel Creation
  // }

  // // Check if channel exists in Db
  // let messageEvent = event.event;
  // let channelID = messageEvent.channel;

  // let getChannelConfig = {
  //     method: 'post',
  //     url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //     data: {query:'select * from SlackChannel where SlackWorkspaceID=\"'+wUUID+'\" and ChannelID=\"'+channelID+'\"'}
  // };

  // const getChannelRes = await axios(getChannelConfig);
  // console.log('Get Channel Call: ', getChannelRes);

  // let cUUID;

  // if(getChannelRes.data.body.length === 0){ // Channel does not exist in the DB
  //     cUUID = uuidv4();

  //     // Get needed info about Channel
  //     let getChannelInfoConfig = {
  //         method: 'get',
  //         url: 'https://slack.com/api/conversations.info?channel='+channelID,
  //         headers: {
  //             'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
  //             'Content-Type': 'application/json'
  //         },
  //     };

  //     const getChannelInfoRes = await axios(getChannelInfoConfig);
  //     console.log("Get Channel Info Call:",getChannelInfoRes);

  //     let channelName = getChannelInfoRes.data.channel.name;

  //     // Insert channel into DB
  //     let createChannelConfig = {
  //         method: 'post',
  //         url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //         data: {query: 'insert into SlackChannel (SlackChannelID, SlackWorkspaceID, ChannelID, Name)values (\"'+cUUID+'\",\"'+wUUID+'\",\"'+channelID+'\",\"'+channelName+'\")'}
  //     };

  //     const createChannelRes = await axios(createChannelConfig);
  //     console.log('Create Channel Call: ', createChannelRes)

  //     // Because this is a new channel we need to add all users into the DB if they dont exist

  //     // Get 100,000 users from the Channel (should be all?)
  //     let getChannelUsersConfig = {
  //         method: 'get',
  //         url: 'https://slack.com/api/conversations.members?channel='+channelID+'&limit=100000',
  //         headers: {
  //             'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
  //             'Content-Type': 'application/json'
  //         },
  //     };

  //     const getChannelUsersRes = await axios(getChannelUsersConfig);
  //     console.log("Get Channel Users Call:",getChannelUsersRes);

  //     let members = getChannelUsersRes.data.members;

  //     for(let i = 0; i < members.length; i++){
  //         let slackUID = members[i];
  //         // Get User from DB if they exist
  //         let getUserConfig = {
  //             method: 'post',
  //             url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //             data: {query:'select * from SlackUser where SlackWorkspaceID=\"'+wUUID+'\" and SlackID=\"'+slackUID+'\"'}
  //         };

  //         const getUserRes = await axios(getUserConfig);
  //         console.log('Get User Call: ', getUserRes);

  //         if(getUserRes.data.body.length === 0){ // User does not exist in DB

  //             // Get needed info about user
  //             let getUsersInfoConfig = {
  //                 method: 'get',
  //                 url: 'https://slack.com/api/users.info?user='+slackUID,
  //                 headers: {
  //                     'Authorization': 'Bearer xoxb-2516673192850-2728955403541-DIAuQAWa2QhauF13bgerQYnK',
  //                     'Content-Type': 'application/json'
  //                 },
  //             };

  //             const getUsersInfoRes = await axios(getUsersInfoConfig);
  //             console.log("Get Users Info Call:",getUsersInfoRes);

  //             let name = getUsersInfoRes.data.user.real_name;
  //             let uUUID = uuidv4();

  //             // Insert slack user into DB
  //             let createSlackUserConfig = {
  //                 method: 'post',
  //                 url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //                 data: {query: 'insert into SlackUser (SlackUserID, SlackWorkspaceID, Name, SlackID)values (\"'+uUUID+'\",\"'+wUUID+'\",\"'+name+'\",\"'+slackUID+'\")'}
  //             };

  //             const createSlackUserRes = await axios(createSlackUserConfig);
  //             console.log('Create Slack User Call: ', createSlackUserRes)

  //             let uuUUID = uuidv4();

  //             // insert user into DB
  //             let createUserConfig = {
  //                 method: 'post',
  //                 url: 'https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/Staging/dbcalls',
  //                 data: {query: 'insert into User (UserID, SlackUserID)values (\"'+uuUUID+'\",\"'+uUUID+'\")'}
  //             };

  //             const createUserRes = await axios(createUserConfig);
  //             console.log('Create User Call: ', createUserRes)
  //         }

  //     }

  // } else {
  //     cUUID = getChannelRes.data.body[0].SlackChannelID;
  // }
  return buildResponse(200, event);
};

function buildResponse(statusCode, event) {
  if (event.hasOwnProperty("challenge")) {
    return {
      statusCode: statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      challenge: event.challenge,
    };
  } else {
    return {
      statusCode: statusCode,
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
}
