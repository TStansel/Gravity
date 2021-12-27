const axios = require('axios')
const qs = require('qs')

exports.handler = async (event) => {
    console.log(event)
    let code = event.queryStringParameters.code;
    let clientID = "2516673192850.2714678861750";
    let clientSecret = "829f20910714241628de5d8a68562a54";
    let redirect_uri = "https://a3rodogiwi.execute-api.us-east-2.amazonaws.com/DevStage/oauth";

    let oauthParams = {
        code: code,
        redirect_uri: redirect_uri,
        client_id: clientID,
        client_secret: clientSecret
    };

      let url = "https://slack.com/api/oauth.v2.access"
      const oauthRes = await axios.post(url,qs.stringify(oauthParams));
      
      let botToken = oauthRes.data.access_token;
      let userToken = oauthRes.data.authed_user.access_token;
      let workspaceID = oauthRes.data.team.id;
      let workspaceName = oauthRes.data.team.name;

      // Need to store these and associate them with the workspace we were just installed in.
      

};
