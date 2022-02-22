import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { ulid } from "ulid";
import * as qs from "qs";
import { buildResponse } from "../slackFunctions";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    //console.log(event);
    
  } catch (error) {
    return buildResponse(401, "Access Denied");
  }
  return buildResponse(200, "Successfully authenticated!");
};
