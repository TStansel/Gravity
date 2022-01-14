import {
    APIGatewayProxyStructuredResultV2,
  } from "aws-lambda";

export function buildResponse(
    status: number,
    body: string
  ): APIGatewayProxyStructuredResultV2 {
    const response = {
      isBase64Encoded: false,
      statusCode: status,
      headers: {
        "content-type": "application/json",
      },
      body: body,
    };
    console.log(response);
    return response;
  }