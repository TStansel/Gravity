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
  try {
    let verifiedEvent = Company.verifyUpdateEvent(event as unknown as JSON);

    if (verifiedEvent.type === "error") {
      customLog(verifiedEvent.error.message, "ERROR");
      return buildResponse(400, "Request is missing a property.");
    }

    let updateEvent = verifiedEvent.value;

    let updateResult = await updateEvent.update();
    if (updateResult.type === "error") {
      customLog(updateResult.error.message, "ERROR");
      return buildResponse(500, updateResult.error.message);
    }
  } catch (error) {
    return buildResponse(401, "Access Denied");
  }
  return buildResponse(200, "Success!");
};