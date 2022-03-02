import { Company } from "../Company";
import { buildResponse, customLog } from "../slackFunctions";
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
  let getOneResult;
  try {
    let verifiedEvent = Company.verifyGetOneEvent(event as unknown as JSON);

    if (verifiedEvent.type === "error") {
      customLog(verifiedEvent.error.message, "ERROR");
      return buildResponse(400, "Request is missing a property.");
    }

    let getOneEvent = verifiedEvent.value;

    getOneResult = await getOneEvent.getOne();
    if (getOneResult.type === "error") {
      customLog(getOneResult.error.message, "ERROR");
      return buildResponse(500, getOneResult.error.message);
    }
  } catch (error) {
    return buildResponse(401, "Access Denied");
  }
  return buildResponse(200, getOneResult.value);
};