import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function buildResponse(
  status: number,
  body: string,
  slackNoRetry = false,
  isSlackInteractivity = false
): APIGatewayProxyStructuredResultV2 {
  let sendHeaders: { [key: string]: string } = {
    "content-type": "application/json",
  };
  if (slackNoRetry) {
    sendHeaders["X-Slack-No-Retry"] = "1";
  }

  if (isSlackInteractivity) {
    const logResponse = {
      isBase64Encoded: false,
      statusCode: status,
      headers: sendHeaders,
      body: body,
    };
    console.log(logResponse);
    const response = {
      statusCode: status,
      headers: sendHeaders,
    };
    return response;
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
