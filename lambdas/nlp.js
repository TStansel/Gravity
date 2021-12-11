exports.handler = async (event) => {
    console.log('Request Event: ', event)
    
    let text = event.text;
    
    if (text.includes('?')){
        return true;
    }
    
    return false;
};
