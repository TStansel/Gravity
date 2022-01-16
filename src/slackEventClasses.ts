import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  SendMessageBatchCommandInput,
  SendMessageBatchRequestEntry,
  UnsupportedOperation,
  ServiceOutputTypes,
} from "@aws-sdk/client-sqs";
import { ulid } from "ulid";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});
const client = new SQSClient({});

/* --------  Types -------- */
// These types are used so we can levarage Typescripts type system instead of throwing error which
// makes it hard to keep track of types
export type ResultSuccess<T> = { type: "success"; value: T };

export type ResultError = { type: "error"; error: Error };

export type Result<T> = ResultSuccess<T> | ResultError;

/* --------  Classes -------- */

export abstract class SlackEvent {
  public type: string;
  public channelID: string;
  public workspaceID: string;

  constructor(channelID: string, workspaceID: string) {
    this.channelID = channelID;
    this.workspaceID = workspaceID;
    this.type = "SLACKEVENT";
  }

  abstract doWork(): Promise<Result<string>>;
}

export class HelpfulButton extends SlackEvent {
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public responseURL: string,
    public messageID: string,
    public oldQuestionUUID: string,
    public userID: string
  ) {
    super(channelID, workspaceID);
    this.responseURL = responseURL;
    this.messageID = messageID;
    this.oldQuestionUUID = oldQuestionUUID;
    this.userID = userID;
    this.type = "HELPFULBUTTON";
  }
  static fromJSON(slackJSON: JSON): Result<SlackEvent> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("responseURL") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("oldQuestionUUID") ||
      !slackJSON.hasOwnProperty("userID")
    ) {
      return {
        type: "error",
        error: new Error("HelpfulButton JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new HelpfulButton(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["responseURL" as keyof JSON] as string,
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["oldQuestionUUID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("Helpful do work");
    try {
      let helpfulParams = {
        replace_original: "true",
        text: "Thank you for making Osmosix more accurate!",
      };

      let helpfulConfig = {
        method: "post",
        url: this.responseURL,
        data: helpfulParams,
      } as AxiosRequestConfig<any>;

      const helpfulRes = await axios(helpfulConfig);

      let getLinkSql = `select AnswerLink from SlackQuestion 
    join SlackAnswer on SlackQuestion.SlackAnswerUUID = SlackAnswer.SlackAnswerUUID
    where SlackQuestionUUID = :SlackQuestionUUID`;

      let getLinkResult = await data.query(getLinkSql, {
        SlackQuestionUUID: this.oldQuestionUUID,
      });

      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
            join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
            where SlackChannel.ChannelID = :channelID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: this.channelID,
      });

      let botToken = getBotTokenResult.records[0].BotToken;

      let successfulParams = {
        thread_ts: this.messageID,
        channel: this.channelID,
        text:
          "<@" +
          this.userID +
          "> Marked <" +
          getLinkResult.records[0].AnswerLink +
          "|this thread> as helpful.",
      };

      // Posting the confirmed answer to the users question
      let successfulConfig = {
        method: "post",
        url: "https://slack.com/api/chat.postMessage",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: successfulParams,
      } as AxiosRequestConfig<any>;

      const successfulRes = await axios(successfulConfig);

      // Updating the parent message with the check mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "arrows_counterclockwise",
      };

      let removeEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.remove",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: removeEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const removeEmojiReactionRes = await axios(removeEmojiReactionConfig);

      let addEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "white_check_mark",
      };

      let addEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.add",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: addEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const addEmojiReactionRes = await axios(addEmojiReactionConfig);

      let increamentUpvotesSql = `update SlackAnswer 
            join SlackQuestion on SlackAnswer.SlackAnswerUUID = SlackQuestion.SlackAnswerUUID
            set SlackAnswer.Upvotes = (SlackAnswer.Upvotes + 1)
            where SlackQuestion.SlackQuestionUUID = :SlackQuestionUUID`;

      let increamentUpvotesResult = await data.query(increamentUpvotesSql, {
        SlackQuestionUUID: this.oldQuestionUUID,
      });
    } catch (e) {
      return {
        type: "error",
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}

export class NotHelpfulButton extends SlackEvent {
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public responseURL: string,
    public messageID: string,
    public oldQuestionUUID: string
  ) {
    super(channelID, workspaceID);
    this.responseURL = responseURL;
    this.messageID = messageID;
    this.oldQuestionUUID = oldQuestionUUID;
    this.type = "NOTHELPFULBUTTON";
  }

  static fromJSON(slackJSON: JSON): Result<NotHelpfulButton> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("responseURL") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("oldQuestionUUID")
    ) {
      return {
        type: "error",
        error: new Error("NotHelpfulButton JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new NotHelpfulButton(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["responseURL" as keyof JSON] as string,
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["oldQuestionUUID" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("Not helpful do work");
    try {
      let notHelpfulParams = {
        replace_original: "true",
        text: "Thank you for making Osmosix more accurate!",
      };

      let notHelpfulConfig = {
        method: "post",
        url: this.responseURL,
        data: notHelpfulParams,
      } as AxiosRequestConfig<any>;

      const notHelpfulRes = await axios(notHelpfulConfig);

      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
            join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
            where SlackChannel.ChannelID = :channelID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: this.channelID,
      });

      let botToken = getBotTokenResult.records[0].BotToken;

      // Updating the parent message with the question mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "arrows_counterclockwise",
      };

      let removeEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.remove",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: removeEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const removeEmojiReactionRes = await axios(removeEmojiReactionConfig);

      let addEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "question",
      };

      let addEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.add",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: addEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const addEmojiReactionRes = await axios(addEmojiReactionConfig);

      let increamentUpvotesSql = `update SlackAnswer 
        join SlackQuestion on SlackAnswer.SlackAnswerUUID = SlackQuestion.SlackAnswerUUID
        set SlackAnswer.Upvotes = (SlackAnswer.Upvotes - 1)
        where SlackQuestion.SlackQuestionUUID = :SlackQuestionUUID`;

      let increamentUpvotesResult = await data.query(increamentUpvotesSql, {
        SlackQuestionUUID: this.oldQuestionUUID,
      });
    } catch (e) {
      return {
        type: "error",
        error: new Error("Not Helpful Network calls failed:" + e),
      };
    }
    return {
      type: "success",
      value: "Not Helpful Button completed sucessfully",
    };
  }
}

export class DismissButton extends SlackEvent {
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public responseURL: string,
    public messageID: string
  ) {
    super(channelID, workspaceID);
    this.responseURL = responseURL;
    this.messageID = messageID;
    this.type = "DISMISSBUTTON";
  }

  static fromJSON(slackJSON: JSON): Result<DismissButton> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("responseURL") ||
      !slackJSON.hasOwnProperty("messageID")
    ) {
      return {
        type: "error",
        error: new Error("DismissButton JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new DismissButton(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["responseURL" as keyof JSON] as string,
        slackJSON["messageID" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("Dismiss BUtton do work");
    try {
      let dismissParams = {
        delete_original: "true",
      };

      let dismissConfig = {
        method: "post",
        url: this.responseURL,
        data: dismissParams,
      } as AxiosRequestConfig<any>;

      const dismissRes = await axios(dismissConfig);

      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
              join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
              where SlackChannel.ChannelID = :channelID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: this.channelID,
      });

      let botToken = getBotTokenResult.records[0].BotToken;

      // Updating the parent message with the question mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "arrows_counterclockwise",
      };

      let removeEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.remove",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: removeEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const removeEmojiReactionRes = await axios(removeEmojiReactionConfig);

      let addEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "question",
      };

      let addEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.add",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: addEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const addEmojiReactionRes = await axios(addEmojiReactionConfig);
    } catch (e) {
      return {
        type: "error",
        error: new Error("Dismiss Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Dismiss Button completed sucessfully" };
  }
}

export class MarkedAnswerEvent extends SlackEvent {
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public parentMsgID: string | undefined,
    public parentMsgText: string | undefined,
    public messageID: string,
    public userID: string,
    public text: string
  ) {
    super(channelID, workspaceID);
    this.parentMsgID = parentMsgID;
    this.messageID = messageID;
    this.userID = userID;
    this.text = text;
    this.type = "MARKEDANSWEREVENT";
  }

  async sendBadMessage(botToken: string): Promise<void> {
    let msgParams = {
      channel: this.userID,
      text: "Uh oh! Thank you for marking an answer, but please make sure to only mark answers for your questions, in threads where the parent message is a question, and in channels where the Osmosix app has been added.",
    };

    let msgConfig = {
      method: "post",
      url: "https://slack.com/api/chat.postMessage",
      headers: {
        Authorization: "Bearer " + botToken,
        "Content-Type": "application/json",
      },
      data: msgParams,
    } as AxiosRequestConfig<any>;
    const msgRes = await axios(msgConfig);
  }

  static fromJSON(slackJSON: JSON): Result<MarkedAnswerEvent> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("parentMsgID") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("userID") ||
      !slackJSON.hasOwnProperty("text")
    ) {
      return {
        type: "error",
        error: new Error("MarkedAnswerEvent JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new MarkedAnswerEvent(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["parentMsgID" as keyof JSON] as string,
        undefined, // Parent Text: Fetch this from slack later
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string,
        slackJSON["text" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("Marked Answer do work");
    try {
      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
      join SlackChannel on SlackToken.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
      where SlackChannel.ChannelID = :channelID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        channelID: this.channelID,
      });

      let botToken = getBotTokenResult.records[0].BotToken;

      let getChannelNameSql = `select SlackChannel.Name from SlackChannel 
        join SlackWorkspace on SlackChannel.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID
        where SlackChannel.ChannelID = :channelID`;

      let getChannelNameResult = await data.query(getChannelNameSql, {
        channelID: this.channelID,
      });

      if (getChannelNameResult.records.length === 0) {
        // Channel doesn't exist in database
        this.sendBadMessage(botToken);
        return {
          type: "error",
          error: new Error("MarkedAnswer: Channel does not exist in DB"),
        };
      }

      let getParentConfig = {
        method: "get",
        url:
          "https://slack.com/api/conversations.history?channel=" +
          this.channelID +
          "&limit=1&inclusive=true&latest=" +
          this.parentMsgID,
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
      } as AxiosRequestConfig<any>;
      const getParentRes = await axios(getParentConfig);

      if (getParentRes.data.messages[0].user != this.userID) {
        // User marked another's message
        this.sendBadMessage(botToken);
        return {
          type: "error",
          error: new Error("MarkedAnswer: User marked other User's answer"),
        };
      }

      this.parentMsgText = getParentRes.data.messages[0].text;

      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(this), // TODO Check This is working
        QueueUrl: process.env.REVERSE_PROXY_SQS_URL,
      });
      let response = await client.send(command);
      console.log("Marked Answer in SQS", response);
      // Thank You MSG
      // Create Q and A
    } catch (e) {
      return {
        type: "error",
        error: new Error("MarkAnswer calls failed:" + e),
      };
    }
    return { type: "success", value: "Marked Answer sent to SQS sucessfully" };
  }
}

export class NewMessageEvent extends SlackEvent {
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public messageID: string,
    public userID: string,
    public text: string,
    public parentMsgID: string | null
  ) {
    super(channelID, workspaceID);
    this.messageID = messageID;
    this.userID = userID;
    this.text = text;
    this.parentMsgID = parentMsgID;
    this.type = "NEWMESSAGEEVENT";
  }
  static fromJSON(slackJSON: JSON): Result<NewMessageEvent> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("userID") ||
      !slackJSON.hasOwnProperty("text") ||
      !slackJSON.hasOwnProperty("parentMsgID")
    ) {
      return {
        type: "error",
        error: new Error("NewMessageEvent JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new NewMessageEvent(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string,
        slackJSON["text" as keyof JSON] as string,
        slackJSON["parentMsgID" as keyof JSON] as string | null
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("new Message do work");
    try {
      let getChannelNameSql = `select SlackChannel.Name from SlackChannel 
        join SlackWorkspace on SlackChannel.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID
        where SlackChannel.ChannelID = :channelID`;

      let getChannelNameResult = await data.query(getChannelNameSql, {
        channelID: this.channelID,
      });
      if (getChannelNameResult.records.length === 0) {
        // Channel doesn't exist in database
        return {
          type: "error",
          error: new Error("NewMessage: Channel does not exist in DB"),
        };
      }

      if (
        typeof this.parentMsgID === "string" &&
        this.messageID !== this.parentMsgID
      ) {
        // Message is not a parent message
        return {
          type: "error",
          error: new Error("NewMessage: Channel does not exist in DB"),
        };
      }

      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(this), // TODO Check This is working
        QueueUrl: process.env.REVERSE_PROXY_SQS_URL,
      });
      let response = await client.send(command);
      console.log("New Message in SQS", response);
      // Send Message to Slack
    } catch (e) {
      return {
        type: "error",
        error: new Error("NewMessage: calls failed:" + e),
      };
    }
    return { type: "success", value: "New Message sent to SQS sucessfully" };
  }
}

export class AppAddedEvent extends SlackEvent {
  public type: string;
  constructor(channelID: string, workspaceID: string, public userID: string) {
    super(channelID, workspaceID);
    this.userID = userID;
    this.type = "APPADDEDEVENT";
  }
  static fromJSON(slackJSON: JSON): Result<AppAddedEvent> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("userID")
    ) {
      return {
        type: "error",
        error: new Error("AppAddedEvent JSON is missing a property"),
      };
    }
    return {
      type: "success",
      value: new AppAddedEvent(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    console.log("App Added Do Work");
    try {
      let getWorkspaceSql =
        "select * from SlackWorkspace where WorkspaceID = :workspaceID";

      let getWorkspaceResult = await data.query(getWorkspaceSql, {
        workspaceID: this.workspaceID,
      });

      //console.log("getWorkspaceresult: ", getWorkspaceResult);

      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
    join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
    where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      let botToken = getBotTokenResult.records[0].BotToken;

      let workspaceUUID: string;

      if (getWorkspaceResult.records.length === 0) {
        // Workspace not in DB - TODO This should be changed to a failure
        // But for now without oauth we understand it breaks in dev

        let getSlackWorkspaceNameConfig = {
          method: "get",
          url: "https://slack.com/api/team.info?team=" + this.workspaceID,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;

        const getSlackWorkspaceNameResult = await axios(
          getSlackWorkspaceNameConfig
        );

        let workspaceName = getSlackWorkspaceNameResult.data.team.name;
        workspaceUUID = ulid();

        let insertWorkspaceSql =
          "insert into SlackWorkspace (SlackWorkspaceUUID, WorkspaceID, Name) values (:SlackWorkspaceUUID, :WorkspaceID, :Name)";

        let insertWorkspaceResult = await data.query(insertWorkspaceSql, {
          SlackWorkspaceUUID: workspaceUUID,
          WorkspaceID: this.workspaceID,
          Name: workspaceName,
        });
      } else {
        workspaceUUID = getWorkspaceResult.records[0]
          .SlackWorkspaceUUID as string;
      }

      // Check if slack channel exists in DB

      let getChannelSql =
        "select * from SlackChannel where SlackWorkspaceUUID = :workspaceUUID and ChannelID = :channelID";

      let getChannelResult = await data.query(getChannelSql, {
        workspaceUUID: workspaceUUID,
        channelID: this.channelID,
      });

      let channelUUID: string;

      // If the channel already exists skip the step of putting channel in DB
      if (getChannelResult.records.length === 0) {
        console.log("Channel not in DB");
        channelUUID = ulid();

        // Get needed info about Channel
        let getChannelInfoConfig = {
          method: "get",
          url:
            "https://slack.com/api/conversations.info?channel=" +
            this.channelID,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;

        const getChannelInfoResult = await axios(getChannelInfoConfig);

        // Insert channel into DB
        let channelName = getChannelInfoResult.data.channel.name;

        let insertChannelSql =
          "insert into SlackChannel (SlackChannelUUID, SlackWorkspaceUUID, ChannelID, Name) values (:channelUUID, :workspaceUUID, :channelID, :channelName)";

        let insertChannelResult = await data.query(insertChannelSql, {
          channelUUID: channelUUID,
          workspaceUUID: workspaceUUID,
          channelID: this.channelID,
          channelName: channelName,
        });
      } else {
        console.log("Channel already in DB");
        channelUUID = getChannelResult.records[0].SlackChannelUUID;
      }

      let cursor = null;
      let channelMembers: string[] = [];

      do {
        let cursorParam;

        // Logic to send no cursor paramater the first call
        if (cursor !== null) {
          cursorParam = "&cursor=" + cursor;
        } else {
          cursorParam = "";
        }

        let getChannelUsersConfig = {
          method: "get",
          url:
            "https://slack.com/api/conversations.members?channel=" +
            this.channelID +
            "&limit=200" +
            cursorParam,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;

        const getChannelUsersResult = await axios(getChannelUsersConfig);

        channelMembers = channelMembers.concat(
          getChannelUsersResult.data.members as string[]
        );

        // Logic to decide if need to continue paginating
        if (
          !getChannelUsersResult.data.hasOwnProperty("response_metadata") ||
          getChannelUsersResult.data.response_metadata.next_cursor === ""
        ) {
          // Response has no next_cursor property set so we are done paginating!
          cursor = null;
        } else {
          cursor =
            getChannelUsersResult.data.response_metadata.next_cursor.replace(
              /=/g,
              "%3D"
            );
        }
      } while (cursor !== null); // When done paginating cursor will be set to null

      // Now get all users from the workspace in the DB in order to add new users

      let getWorkspaceUsersSql =
        "select SlackID from SlackUser where SlackWorkspaceUUID = :workspaceUUID";

      let getWorkspaceUsersResult = await data.query(getWorkspaceUsersSql, {
        workspaceUUID: workspaceUUID,
      });

      let slackUserIdSet = new Set();
      for (let row of getWorkspaceUsersResult.records) {
        slackUserIdSet.add(row.SlackID);
      }

      let membersNotInDB: string[] = [];
      for (let slackID of channelMembers) {
        if (!slackUserIdSet.has(slackID)) {
          membersNotInDB.push(slackID);
        }
      }
      console.log(
        "Number of users in channel but not in DB",
        membersNotInDB.length
      );
      if (membersNotInDB.length !== 0) {
        // There are New Members to put into DB
        let batchInsertNewSlackUserSql =
          "insert into SlackUser (SlackUserUUID, SlackWorkspaceUUID, SlackID) values (:slackUserUUID, :workspaceUUID, :slackID)";

        // Prepare list of users to insert
        let batchInsertSlackUsersParams = membersNotInDB.map((slackID) => [
          {
            slackUserUUID: ulid(),
            workspaceUUID: workspaceUUID,
            slackID: slackID,
          },
        ]);

        //console.log("batchInsertSlackUsersParams: ", batchInsertSlackUsersParams);

        let batchInsertNewSlackUserResult = await data.query(
          batchInsertNewSlackUserSql,
          batchInsertSlackUsersParams
        );
      }

      cursor = null;
      let channelMessages: JSON[] = [];

      do {
        let cursorParam;

        // Logic to send no cursor paramater the first call
        if (cursor !== null) {
          cursorParam = "&cursor=" + cursor;
        } else {
          cursorParam = "";
        }

        let getChannelMessagesConfig = {
          method: "get",
          url:
            "https://slack.com/api/conversations.history?channel=" +
            this.channelID +
            "&limit=200" +
            cursorParam,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;

        const getChannelMessagesResult = await axios(getChannelMessagesConfig);

        //console.log("Get Channel Messages Call:", getChannelMessagesResult);

        channelMessages = channelMessages.concat(
          getChannelMessagesResult.data.messages
        );

        // Logic to decide if need to continue paginating
        if (
          !getChannelMessagesResult.data.hasOwnProperty("response_metadata") ||
          getChannelMessagesResult.data.response_metadata.next_cursor === ""
        ) {
          // Response has no next_cursor property set so we are done paginating!
          //console.log("no cursor in response, done paginating");
          cursor = null;
        } else if (
          // Types here a bit confusing, channelMessages is list of JSON where ts is a string.
          // We need it as a number to insure we only get past year of messages
          Date.now() / 1000 -
            Number(
              channelMessages[channelMessages.length - 1]["ts" as keyof JSON]
            ) >
          60 * 60 * 24 * 365
        ) {
          // Oldest message in response is more than 1 year old, stop paginating!
          /*console.log(
            "Oldest message in response is more than 1 year old, stop paginating!"
          );*/
          cursor = null;
        } else {
          cursor =
            getChannelMessagesResult.data.response_metadata.next_cursor.replace(
              /=/g,
              "%3D"
            );
          //console.log("cursor found in result, encoding and paginating");
        }
      } while (cursor !== null); // When done paginating cursor will be set to null

      console.log("Number of messages in past year:", channelMessages.length);

      let promises: Promise<ServiceOutputTypes>[] = [];
      let batch_size = 5;
      for (let i = 0; i < channelMessages.length; i += batch_size) {
        //console.log("hit for loop");

        let channelMessagesBatch = channelMessages.slice(i, i + batch_size);
        //console.log(channelMessagesBatch);
        let sqsSendBatchMessageEntries: SendMessageBatchRequestEntry[] =
          channelMessagesBatch.map((message, index) => ({
            Id: String(index),
            MessageBody: JSON.stringify({
              message: message,
              channelID: this.channelID,
              channelUUID: channelUUID,
            }),
          }));

        //console.log(sqsSendBatchMessageEntries);
        let sqsSendBatchMessageInput: SendMessageBatchCommandInput = {
          Entries: sqsSendBatchMessageEntries,
          QueueUrl: process.env.PROCESS_EVENTS_ML_SQS_URL,
        };
        let command = new SendMessageBatchCommand(sqsSendBatchMessageInput);
        promises.push(client.send(command));
      }
      let responses = await Promise.all(promises);
    } catch (e) {
      return {
        type: "error",
        error: new Error("App Added Network calls failed:" + e),
      };
    }
    return { type: "success", value: "App Added sent to SQS sucessfully" };
  }
}
