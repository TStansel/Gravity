const axios = require('axios')

exports.handler = async (event) => {
    console.log("Request Event:",event)
    let dismissParams = {
      delete_original: "true",
    };
            
    let dismissConfig = {
      method: 'post',
      url: event.responseURL,
      data: dismissParams
    };

    const dismissRes = await axios(dismissConfig);
};
