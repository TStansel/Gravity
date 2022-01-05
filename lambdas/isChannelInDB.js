const data = require("data-api-client")({
    secretArn:
      "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
    resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
    database: "osmosix", // set a default database
  });

  exports.handler = async (event) => {
      console.log(event)
    event = event.payload;

    let getChannelNameSql =
        `select SlackChannel.Name from SlackChannel 
        join SlackWorkspace on SlackChannel.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID
        where SlackChannel.ChannelID = :channelID`;
    
    let getChannelNameResult = await data.query(getChannelNameSql, {
        channelID: event.channelID,
    });

    let payload;

    if(getChannelNameResult.records.length > 0){
        // Channel does exist in database
        payload = {
            data: {
                text: event.text,
                channelID: event.channelID,
                messageID: event.messageID,
                userID: event.userID,
                parentTS: event.hasOwnProperty("parentTS") ? event.parentTS : undefined,
                workspaceID: event.hasOwnProperty("workspaceID") ? event.workspaceID : undefined,
                isNewMessageFlow: event.hasOwnProperty("isNewMessageFlow") ? event.isNewMessageFlow : undefined
            },
            passed:true
        };
    }else{
        payload = {
            data: {
                text: event.text,
                channelID: event.channelID,
                messageID: event.messageID,
                userID: event.userID,
                parentTS: event.hasOwnProperty("parentTS") ? event.parentTS : undefined,
                workspaceID: event.hasOwnProperty("workspaceID") ? event.workspaceID : undefined
            },
            passed:false
        };
    }

    return { payload: payload };
};