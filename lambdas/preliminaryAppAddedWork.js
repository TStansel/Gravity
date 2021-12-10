
const data = require('data-api-client')({
  secretArn: 'arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu',
  resourceArn: 'arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster',
  database: 'osmosix' // set a default database
})

exports.handler = async (event) => {
    // TODO: Add something about only going in if the App Id matches?
    // TODO: Send a message when this case starts and ends to let users know that the app is working on adding the history and when it is finished
            
    // Bot was added to a channel
        
    // Check if the Workspace is already in the DB
    
    console.log("check if workspace is in DB");

    let sqlStatement = "select * from SlackWorkspace where WorkspaceID = :workspaceID";
    let workspaceID = event.team_id;
    
    let getWorkspaceresult = await data.query(
      sqlStatement,
      {
          workspaceID: workspaceID 
      }
    );
    
    console.log('getWorkspaceresult: ', getWorkspaceresult);
    
    
    
    
    
    
    
    
 
    

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
    return buildResponse(200, event)
};

function buildResponse(statusCode, event) {
    if(event.hasOwnProperty('challenge')){
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
            challenge: event.challenge
        }
    } else{
        return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
        }
    }
}
