import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import * as crypto from "crypto";

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log("this is a change");

  // Inspect the event passed from API gateway to determine what action to perform
  // If the request did not constitute a valid action return null
  const routeStrategy = determineRoute(event);
  if (!routeStrategy) {
    // Invalid route 
    return buildResponse(401, "Access Denied");
  }

  const router = new Router(routeStrategy);
  const routeResult = router.route();

  return buildResponse(routeResult.status, routeResult.body);
};

class Router {
  routeStrategy: Routeable;

  constructor(route: Routeable) {
    this.routeStrategy = route;
  }

  route(): RouteResult {
    return this.routeStrategy.route();
  }
}

class RouteResult {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    this.status = status;
    this.body = body;
  }
}

interface Routeable {
  route(): RouteResult;
}

class UrlVerificationRouteStrategy implements Routeable {
  challenge: string;
  constructor(challenge: string) {
    this.challenge = challenge;
  }

  route(): RouteResult {
    return new RouteResult(200, this.challenge);
  }
}

function determineRoute(event: APIGatewayProxyEventV2): Routeable | null {
  if (!verifyRequestIsFromSlack(event)) {
    return null;
  }
  console.log("request verified");

  if (event.headers["Content-Type"] === "application/json" && event.body) {
    const body = JSON.parse(event.body);

    if (body.hasOwnProperty("type")) {
      let type = body.type as string;
      if (type === "url_verification") {
        return new UrlVerificationRouteStrategy(body.challenge as string);
      }
    }
  }

  return null;
}

function verifyRequestIsFromSlack(event: APIGatewayProxyEventV2): boolean {
  if (
    !event.headers["X-Slack-Request-Timestamp"] ||
    !event.headers["X-Slack-Signature"] ||
    !event.body
  ) {
    console.log("Event object missing attributes");
    return false;
  }

  const slackTimestamp = +event.headers["X-Slack-Request-Timestamp"];

  // TODO: check if this logic is bug-proof
  // Check if timestamp is current
  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - slackTimestamp) >
    60 * 5
  ) {
    console.log("timestamp is not current");
    return false;
  }

  const slackSignature = event.headers["X-Slack-Signature"];
  const slackBody = event.body;

  const baseString = "v0:" + slackTimestamp + ":" + slackBody;

  if (!process.env.OSMOSIX_SLACK_SIGNING_SECRET) {
    console.log("no slack signing secret");
    return false;
  }

  const slackSigningSecret = process.env.OSMOSIX_SLACK_SIGNING_SECRET;

  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", slackSigningSecret)
      .update(baseString, "utf8")
      .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(slackSignature, "utf8")
    )
  ) {
    console.log("Hashes do nor match");
    return false;
  }

  return true;
}

function buildResponse(
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
