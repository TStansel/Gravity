import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import * as crypto from "crypto";

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log(event);
  // Inspect the event passed from API gateway to determine what action to perform
  // If the request did not constitute a valid action return null
  let routeStrategy: Routeable;
  try {
    routeStrategy = determineRoute(event);
  } catch (e) {
    // Invalid route
    console.log(e);
    return buildResponse(401, "Access Denied");
  }

  const router = new Router(routeStrategy);
  const routeResult = router.route();

  return buildResponse(routeResult.status, routeResult.body);
};

/* --------  Interfaces -------- */

interface Routeable {
  route(): RouteResult;
}

/* --------  Classes -------- */

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

class UrlVerificationRouteStrategy implements Routeable {
  challenge: string;
  constructor(challenge: string) {
    this.challenge = challenge;
  }

  route(): RouteResult {
    return new RouteResult(200, this.challenge);
  }
}

class AppAddedToChannelRouteStrategy implements Routeable {
  route(): RouteResult {
    return new RouteResult(
      200,
      "Test AppAddedToChannelRouteStrategy route output."
    );
  }
}

class MessagePostedRouteStrategy implements Routeable {
  route(): RouteResult {
    return new RouteResult(200, "Test MessagePostedRouteStrategy route output");
  }
}

class SlackEvent { 
  private channelID: string;

  constructor(channelID: string) {
    this.channelID = channelID;
  }

  getChannelID(): string{
    return this.channelID;
  }
  //TODO: Although my 340 prof would be saddened, probably ddon't need setters for SlackEvents?  
  // Could just use the constructors, since the data won't ever change? 

}

class SlackButton extends SlackEvent {
  constructor(channelID: string, private responseURL: string, private messageID: string){
    super(channelID);
    this.responseURL = responseURL;
    this.messageID = messageID;
  }

  getResponseURl(): string{
    return this.responseURL;
  }
  getMessageID(): string{
    return this.messageID;
  }
}

class HelpfulButton extends SlackButton {

constructor(channelID: string, responseURL: string, messageID: string, private oldQuestionUUID: string, private userID: string){
    super(channelID,responseURL,messageID);
    this.oldQuestionUUID = oldQuestionUUID;
    this.userID = userID;
  }

  getOldQuestionUUID(): string{
    return this.oldQuestionUUID;
  }

  getUserID(): string{
    return this.userID;
  }
}

class NotHelpfulButton extends SlackButton {

  constructor (channelID: string, responseURL: string, messageID: string, private oldQuestionUUID: string){
    super(channelID, responseURL, messageID);
    this.oldQuestionUUID = oldQuestionUUID;
  }

  getOldQuestionUUID(): string{
    return this.oldQuestionUUID;
  }
}

class DismissButton extends SlackButton {

  constructor (channelID: string, responseURL: string, messageID: string){
    super(channelID, responseURL, messageID);
  }
}

class MarkedAnswer extends SlackEvent {

  constructor(channelID: string, private parentMsgID: string, private messageID: string, private userID: string, private workspaceID: string, private text: string){
    super(channelID);
    // TODO: Still need to pass the text for later, but thoughts on reshaping the DB to not store text? 
    // Would have to drop the tables but we are gonna do a re-install anyway?
    this.parentMsgID = parentMsgID;
    this.messageID = messageID;
    this.userID = userID;
    this.workspaceID = workspaceID;
    this.text = text;
  }

  getParentMsgID(): string{
    return this.parentMsgID;
  }
  getMessageID(): string{
    return this.messageID;
  }
  getUserID(): string{
    return this.userID;
  }
  getWorkspaceID(): string{
    return this.workspaceID;
  }
  getText(): string{
    return this.text;
  }
}

class NewMessage extends SlackEvent {
  constructor(channelID: string, private messageID: string, private userID: string, private text: string){
    super(channelID);
    this.messageID = messageID;
    this.userID = userID;
    this.text = text;
  }

  getMessageID(): string{
    return this.messageID;
  }
  getUserID(): string{
    return this.userID;
  }
  getText(): string{
    return this.text;
  }
}

class AppAdded extends SlackEvent {
  constructor(channelID: string, private workspaceID: string){
    super(channelID);
    this.workspaceID = workspaceID;
  }

  getWorkspaceID(): string{
    return this.workspaceID;
  }
}

/* --------  Functions -------- */

function determineRoute(event: APIGatewayProxyEventV2): Routeable {
  console.log("determining route");
  if (!verifyRequestIsFromSlack(event)) {
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
            return new AppAddedToChannelRouteStrategy();
            break;
          }
          case "message": {
            console.log("message eventType");
            return new MessagePostedRouteStrategy();
            break;
          }
          default: {
            console.log(`default eventType reached (unknown): ${eventType}`);
            throw new Error("default eventType reached");
            break;
          }
        }
        break;
      }
      default: {
        console.log(`default type reached (unknown): ${type}`);
        throw new Error("default type reached");
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
    } else {
      throw new Error("not from Slack Events API and not url_verification!");
    }
  }
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

  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (!slackSigningSecret) {
    console.log("could not get slack signing secret");
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
