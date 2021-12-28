const axios = require("axios");
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

exports.handler = async (event) => {
    
    event = event.payload;
    //console.log("Request Event:",event)
    
    let notHelpfulParams = {
        replace_original: "true",
        text: "Thank you for making Osmosix more accurate!",
    };
            
    let notHelpfulConfig = {
        method: 'post',
        url: event.responseURL,
        data: notHelpfulParams
    };
            
    const notHelpfulRes = await axios(notHelpfulConfig);
    
    let increamentUpvotesSql =
        `update SlackAnswer 
        join SlackQuestion on SlackAnswer.SlackAnswerUUID = SlackQuestion.SlackAnswerUUID
        set SlackAnswer.Upvotes = (SlackAnswer.Upvotes - 1)
        where SlackQuestion.SlackQuestionUUID = :SlackQuestionUUID`;
    
    let increamentUpvotesResult = await data.query(increamentUpvotesSql, {
        SlackQuestionUUID: event.oldQuestionUUID,
    });
    
    return { msg: "Successful Not Helpful Button Press" }

};
