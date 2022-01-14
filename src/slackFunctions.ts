import {
    APIGatewayProxyStructuredResultV2,
  } from "aws-lambda";

export function buildResponse(
    status: number,
    body: string,
    slackNoRetry = false,
  ): APIGatewayProxyStructuredResultV2 {
    let sendHeaders: {[key: string]: string} = {"content-type": "application/json"};
    if (slackNoRetry) {
      sendHeaders["X-Slack-No-Retry"] = "1";
    }
    
    const response = {
      isBase64Encoded: false,
      statusCode: status,
      headers: sendHeaders,
      body: body,
    };
    console.log(response);
    return response;
  }