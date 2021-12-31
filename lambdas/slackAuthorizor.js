const qs = require("qs");

exports.handler = async (event) => {
    console.log(event)

    let slackTimestamp = event.headers["X-Slack-Request-Timestamp"];

    if(Math.abs(Math.floor(new Date().getTime()/1000)-slackTimestamp) > 60 * 5){
        // Request was sent over 5 minutes ago
        return "rejection" // Design output to match step function design
    }

    let slackSignature = event.headers["X-Slack-Signature"];
    let slackBody = qs.stringify(event.body,{ format:'RFC1738' });

    let baseString = 'v0:' + slackTimestamp + ':' + slackBody;
    const slackSigningSecret = process.env.OSMOSIX_SLACK_SIGNING_SECRET;

    let mySignature = 'v0=' + 
                   crypto.createHmac('sha256', slackSigningSecret)
                         .update(baseString, 'utf8')
                         .digest('hex');

    if (crypto.timingSafeEqual(
        Buffer.from(mySignature, 'utf8'),
        Buffer.from(slackSignature, 'utf8'))) {
        next(); // Change succesful return here to match step function
    } else {
        return res.status(400).send('Verification failed'); // Design output to match step function design
    }
    
};
