import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import * as crypto from "crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-2" });
// TODO: see if it would be better to get secret here instead of in function

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log(event);
  // Inspect the event passed from API gateway to determine what action to perform
  // If the request did not constitute a valid action return null
  let routeStrategy: Routeable;
  try {
    routeStrategy = await determineRoute(event);
  } catch (e) {
    // Invalid route
    console.log(e);
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

async function determineRoute(
  event: APIGatewayProxyEventV2
): Promise<Routeable> {
  console.log("determining route");
  if (!(await verifyRequestIsFromSlack(event))) {
    throw new Error("Could not verify request");
  }
  console.log("request verified");

  if (fromSlackEventsApi(event)) {
    // Event is from Slack Events API
    const slackEvent = JSON.parse(event.body!);
    console.log(`slackEvent: ${slackEvent}`);
    let type = slackEvent.type as string;
    switch (type) {
      case "event_callback": {
        // Most events from Events API have this type
        console.log("type event_callback");
        const eventType = slackEvent.event.type;
        switch (eventType) {
          case "member_joined_channel": {
            console.log("member_joined_channel eventType");
            break;
          }
          case "message": {
            console.log("message eventType");
            break;
          }
        }
        break;
      }
    }
  } else {
    // Event not from Slack Events API
    if (isUrlVerification(event)) {
      console.log("event not from Slack Events API");
      // URL for Events API subscription is being verified by Slack
      const slackEvent = JSON.parse(event.body!);
      if (slackEvent.challenge) {
        return new UrlVerificationRouteStrategy(slackEvent.challenge as string);
      } else {
        throw new Error("type url_verification but no challenge!");
      }
    }
  }

  throw new Error("not from Slack Events API and not url_verification!");
}

function isUrlVerification(event: APIGatewayProxyEventV2): boolean {
  if (event.headers["Content-Type"] === "application/json" && event.body) {
    const slackEvent = JSON.parse(event.body);
    if (
      slackEvent.hasOwnProperty("token") &&
      typeof slackEvent.token === "string" &&
      slackEvent.hasOwnProperty("type") &&
      typeof slackEvent.type === "string" &&
      slackEvent.type === "url_verification" &&
      slackEvent.hasOwnProperty("challenge") &&
      typeof slackEvent.challenge === "string"
    ) {
      return true;
    }
  }
  return false;
}

function fromSlackEventsApi(event: APIGatewayProxyEventV2): boolean {
  if (event.headers["Content-Type"] === "application/json" && event.body) {
    const slackEvent = JSON.parse(event.body);
    if (
      slackEvent.hasOwnProperty("token") &&
      typeof slackEvent.token === "string" &&
      slackEvent.hasOwnProperty("team_id") &&
      typeof slackEvent.team_id === "string" &&
      slackEvent.hasOwnProperty("api_app_id") &&
      typeof slackEvent.api_app_id === "string" &&
      slackEvent.hasOwnProperty("event") &&
      slackEvent.hasOwnProperty("type") &&
      typeof slackEvent.type === "string" &&
      slackEvent.hasOwnProperty("authorizations") &&
      slackEvent.hasOwnProperty("event_context") &&
      typeof slackEvent.event_context === "string" &&
      slackEvent.hasOwnProperty("event_id") &&
      typeof slackEvent.event_id === "string" &&
      slackEvent.hasOwnProperty("event_time") &&
      typeof slackEvent.event_time === "number"
    ) {
      return true;
    }
  }
  return false;
}

async function verifyRequestIsFromSlack(
  event: APIGatewayProxyEventV2
): Promise<boolean> {
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

  console.log("trying to get secret");
  let slackSigningSecret: string;
  try {
    slackSigningSecret = await getSlackSigningSecret();
  } catch (e) {
    console.log(e);
    return false;
  }

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
    console.log("Hashes do not match");
    return false;
  }

  return true;
}

async function getSlackSigningSecret(): Promise<string> {
  // TODO: this feels like a hacky way of doing the try/catch
  try {
    const command = new GetSecretValueCommand({
      SecretId:
        "arn:aws:secretsmanager:us-east-2:579534454884:secret:OSMOSIX_DEV_SIGNING_SECRET-5rg0ga",
    });
    const response = await client.send(command);
    if (response.SecretString) {
      // TODO: this feels hacky, fix later
      return JSON.parse(response.SecretString)
        .OSMOSIX_DEV_SIGNING_SECRET as string;
    } else {
      throw new Error("secret response has no secretString");
    }
  } catch (e) {
    console.log(e);
    throw new Error("error getting secret");
  }
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
