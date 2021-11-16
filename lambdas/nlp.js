exports.handler = async (event) => {
    console.log('Request Event: ', event)
    
    let questions = [];
    let messages = event.messages;

    for(let i = 0; i < messages.length; i++){
        if (messages[i].includes('?')){
            questions.push(messages[i]);
        }
    }
    
    return buildResponse(200,questions);
};

function buildResponse(statusCode, questions) {
    return {
            statusCode: statusCode,
            headers: {
                'Content-Type': 'application/json'
            },
            body: questions
    }

}