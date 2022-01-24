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
// TODO move this data instatiation to above calling lambda handler to make sure happens once
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
      let dismissParams = {
        delete_original: "true",
      };

      let dismissConfig = {
        method: "post",
        url: this.responseURL,
        data: dismissParams,
      } as AxiosRequestConfig<any>;

      const dismissRes = await axios(dismissConfig);

      let getLinkSql = `select AnswerLink from SlackQuestion 
    join SlackAnswer on SlackQuestion.SlackAnswerUUID = SlackAnswer.SlackAnswerUUID
    where SlackQuestionUUID = :SlackQuestionUUID`;

      let getLinkResult = await data.query(getLinkSql, {
        SlackQuestionUUID: this.oldQuestionUUID,
      });

      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "Helpful Button Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      let successfulParams = {
        thread_ts: this.messageID,
        channel: this.channelID,
        text:
          "<" +
          getLinkResult.records[0].AnswerLink +
          "|This thread> was marked as helpful.",
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

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = "arrows_counterclockiwise";

      if (isCustomEmojiAdded) {
        emojiCode = "osmosix-loading";
      }

      // Updating the parent message with the check mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: emojiCode,
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
      let dismissParams = {
        delete_original: "true",
      };

      let dismissConfig = {
        method: "post",
        url: this.responseURL,
        data: dismissParams,
      } as AxiosRequestConfig<any>;

      const dismissRes = await axios(dismissConfig);

      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "Not Helpful Button Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = "arrows_counterclockiwise";

      if (isCustomEmojiAdded) {
        emojiCode = "osmosix-loading";
      }

      // Updating the parent message with the question mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: emojiCode,
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
    console.log("Dismiss Button do work");
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

      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "Dismiss Button Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = "arrows_counterclockiwise";

      if (isCustomEmojiAdded) {
        emojiCode = "osmosix-loading";
      }

      // Updating the parent message with the question mark reaction

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: emojiCode,
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

export class MarkedAnswerEvent
  extends SlackEvent
  implements MachineLearningIsWorkable
{
  public type: string;
  constructor(
    channelID: string,
    workspaceID: string,
    public parentMsgID: string | null,
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
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "Marked Answer Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      if (this.parentMsgID === null || this.messageID == this.parentMsgID) {
        // Marked a message that is not in a thread
        await this.sendBadMessage(botToken);
        return {
          type: "success",
          value:
            "Cannot Process Marked Answer: Marked message is not in thread",
        };
      }

      let getChannelNameSql = `select SlackChannel.Name from SlackChannel 
        join SlackWorkspace on SlackChannel.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID
        where SlackChannel.ChannelID = :channelID`;

      let getChannelNameResult = await data.query(getChannelNameSql, {
        channelID: this.channelID,
      });

      if (getChannelNameResult.records.length === 0) {
        // Channel doesn't exist in database
        await this.sendBadMessage(botToken);
        return {
          type: "success",
          value: "Cannot Process Marked Answer: Channel does not exist in DB",
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
        await this.sendBadMessage(botToken);
        return {
          type: "success",
          value:
            "Cannot Process Marked Answer: User marked for another user's message",
        };
      }

      this.parentMsgText = getParentRes.data.messages[0].text;

      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(this),
        QueueUrl: process.env.PROCESS_EVENTS_ML_SQS_URL,
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

  async doMLWork(parentVector: undefined): Promise<Result<string>> {
    console.log("Marked Answer: ML Work");
    try {
      let getBotTokenSql = `select SlackToken.BotToken from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "Marked Answer ML Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      // Emoji reactions and Thank you Message

      let removeEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.parentMsgID,
        name: "question",
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
        timestamp: this.parentMsgID,
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

      let addMarkedEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: "white_check_mark",
      };

      let addMarkedEmojiReactionConfig = {
        method: "post",
        url: "https://slack.com/api/reactions.add",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: addMarkedEmojiReactionParams,
      } as AxiosRequestConfig<any>;

      const addMarkedEmojiReactionRes = await axios(
        addMarkedEmojiReactionConfig
      );

      // let msgParams = {
      //   channel: this.userID,
      //   text: "Thank you for marking an answer and for making Osmosix more accurate!",
      // };

      // let msgConfig = {
      //   method: "post",
      //   url: "https://slack.com/api/chat.postMessage",
      //   headers: {
      //     Authorization: "Bearer " + botToken,
      //     "Content-Type": "application/json",
      //   },
      //   data: msgParams,
      // } as AxiosRequestConfig<any>;
      // const msgRes = await axios(msgConfig);

      // Create Q and A pair in DB

      let getULIDsSql = `select SlackChannel.SlackChannelUUID, SlackUser.SlackUserUUID from SlackWorkspace 
            join SlackChannel on SlackWorkspace.SlackWorkspaceUUID = SlackChannel.SlackWorkspaceUUID 
            join SlackUser on SlackWorkspace.SlackWorkspaceUUID = SlackUser.SlackWorkspaceUUID 
            where SlackWorkspace.WorkspaceID = :workspaceID and SlackChannel.ChannelID = :channelID 
            and SlackUser.SlackID = :userID`;

      let getULIDsResult = await data.query(getULIDsSql, {
        workspaceID: this.workspaceID,
        channelID: this.channelID,
        userID: this.userID,
      });
      //console.log(getUUIDsResult)
      if (
        getULIDsResult.records.length === 0 ||
        !getULIDsResult.records[0].SlackChannelUUID ||
        !getULIDsResult.records[0].SlackUserUUID
      ) {
        return {
          type: "success",
          value: "Missing needed ULIDS for Marked Answer",
        };
      }
      let ULIDs = getULIDsResult.records[0];

      // Get Answer Link
      let linkConfig = {
        method: "get",
        url:
          "https://slack.com/api/chat.getPermalink?channel=" +
          this.channelID +
          "&message_ts=" +
          this.messageID,
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
      } as AxiosRequestConfig<any>;

      const linkRes = await axios(linkConfig);

      let link = linkRes.data.permalink;
      let aULID = ulid();

      // insert Answer
      let insertAnswerSql =
        "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";

      let insertAnswerResult = await data.query(insertAnswerSql, {
        SlackAnswerUUID: aULID,
        AnswerLink: link,
        Upvotes: 0,
      });

      let qULID = ulid();

      // insert Question
      let insertQuestionSql = `insert into SlackQuestion (SlackQuestionUUID, SlackAnswerUUID, SlackChannelUUID, SlackUserUUID, Ts) 
      values (:SlackQuestionUUID, :SlackAnswerUUID, :SlackChannelUUID, :SlackUserUUID, :Ts)`;
      //console.log(JSON.stringify(parentVector));
      let insertQuestionResult = await data.query(insertQuestionSql, {
        SlackQuestionUUID: qULID,
        SlackAnswerUUID: aULID,
        SlackChannelUUID: ULIDs.SlackChannelUUID,
        SlackUserUUID: ULIDs.SlackUserUUID,
        Ts: this.messageID,
      });
    } catch (e) {
      return {
        type: "error",
        error: new Error("MarkedAnswer ML Work calls failed: " + e),
      };
    }
    return {
      type: "success",
      value: "Marked Answer ML Work successfully finished",
    };
  }
}

export class NewMessageEvent
  extends SlackEvent
  implements MachineLearningIsWorkable
{
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
          type: "success",
          value: "Cannot process NewMessage: Channel does not exist in DB",
        };
      }

      if (
        typeof this.parentMsgID === "string" &&
        this.messageID !== this.parentMsgID
      ) {
        // Message is not a parent message
        return {
          type: "success",
          value: "Cannot process NewMessage: Message is not a parent message",
        };
      }

      if (!this.text.includes("?")) {
        // Message is not a question
        return {
          type: "success",
          value: "Cannot process NewMessage: Message is not a question",
        };
      }

      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "New Message ML Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken as string;

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = "arrows_counterclockiwise";

      if (isCustomEmojiAdded) {
        emojiCode = "osmosix-loading";
      }

      let addEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: emojiCode,
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

      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(this),
        QueueUrl: process.env.PROCESS_EVENTS_ML_SQS_URL,
      });
      let response = await client.send(command);
      //console.log("New Message in SQS", response);
      // Send Message to Slack
    } catch (e) {
      return {
        type: "error",
        error: new Error("NewMessage calls failed:" + e),
      };
    }
    return { type: "success", value: "New Message sent to SQS sucessfully" };
  }

  async doMLWork(questions: JSON): Promise<Result<string>> {
    console.log("New Message: ML Work");
    try {
      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
      join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
      where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return {
          type: "success",
          value: "New Message ML Work: Missing Bot Token",
        };
      }

      let botToken = getBotTokenResult.records[0].BotToken as string;

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = "arrows_counterclockiwise";

      if (isCustomEmojiAdded) {
        emojiCode = "osmosix-loading";
      }

      let addEmojiReactionParams = {
        channel: this.channelID,
        timestamp: this.messageID,
        name: emojiCode,
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

      if (!questions.hasOwnProperty("mostSimilar")) {
        // We have no suggestion that meets our criteria
        let removeEmojiReactionParams = {
          channel: this.channelID,
          timestamp: this.messageID,
          name: emojiCode,
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

        // let noSuggestionsMessageParams = {
        //   channel: this.channelID,
        //   user: this.userID,
        //   text: "We currently don't have an answer for your question. After someone answers your question make sure to mark it as an answer so next time someone has a question similiar to yours we can help them out!",
        // };

        // let msgConfig = {
        //   method: "post",
        //   url: "https://slack.com/api/chat.postEphemeral",
        //   headers: {
        //     Authorization: "Bearer " + botToken,
        //     "Content-Type": "application/json",
        //   },
        //   data: noSuggestionsMessageParams,
        // } as AxiosRequestConfig<any>;
        // const msgRes = await axios(msgConfig);
        return {
          type: "success",
          value: "New Message ML Work: No suggestions for this question",
        };
      }

      let mostSimilarQuestion = questions[
        "mostSimilar" as keyof JSON
      ] as unknown as JSON;

      let getMostSimilarQuestionUlidSql = `select SlackQuestionUUID
      from
      SlackQuestion inner join SlackChannel on SlackQuestion.SlackChannelUUID = SlackChannel.SlackChannelUUID
      where
      SlackQuestion.Ts = :messageTs and
      SlackChannel.ChannelID = :channelID`;

      let getMostSimilarQuestionUlidResult = await data.query(
        getMostSimilarQuestionUlidSql,
        {
          messageTs: mostSimilarQuestion["messageTs" as keyof JSON] as string,
          channelID: this.channelID,
        }
      );

      let mostSimilarQuestionULID =
        getMostSimilarQuestionUlidResult.records[0].SlackQuestionUUID;

      let getQuestionSql = `select SlackAnswerUUID from SlackQuestion where SlackQuestionUUID = :SlackQuestionUUID`;

      let getQuestionResult = await data.query(getQuestionSql, {
        SlackQuestionUUID: mostSimilarQuestionULID,
      });

      let answerLink: string;
      let isAnswerInDb = false;

      if (getQuestionResult.records[0].SlackAnswerUUID === null) {
        console.log("answer is null in DB");
        // Answer is null in DB
        let messageTS = mostSimilarQuestion[
          "messageTs" as keyof JSON
        ] as string;

        let repliesConfig = {
          method: "get",
          url:
            "https://slack.com/api/conversations.replies?channel=" +
            this.channelID +
            "&ts=" +
            messageTS,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;
        const repliesRes = await axios(repliesConfig);
        console.log(repliesRes);

        let answerTs = repliesRes.data.messages[1].ts as string;

        let getLinkConfig = {
          method: "get",
          url:
            "https://slack.com/api/chat.getPermalink?channel=" +
            this.channelID +
            "&message_ts=" +
            answerTs,
          headers: {
            Authorization: "Bearer " + botToken,
            "Content-Type": "application/json",
          },
        } as AxiosRequestConfig<any>;
        const getLinkRes = await axios(getLinkConfig);
        answerLink = getLinkRes.data.permalink;
      } else {
        console.log("answer is in DB");
        isAnswerInDb = true;

        // TODO: Make this a SQL join with the above
        let getAnswerLinkSql =
          "select AnswerLink from SlackAnswer where SlackAnswerUUID = :SlackAnswerUUID";

        let getAnswerLinkResult = await data.query(getAnswerLinkSql, {
          SlackAnswerUUID: getQuestionResult.records[0]
            .SlackAnswerUUID as string,
        });
        answerLink = getAnswerLinkResult.records[0].AnswerLink;
      }

      let similarityScore = Number(
        mostSimilarQuestion["similarity" as keyof JSON]
      ) as number;

      let msgParams;
      let isRecentAnswerInDb: boolean = true;
      let recentAnswerLink: string = "";
      let recentQuestionULID: string = "";
      if (
        questions.hasOwnProperty("mostSimilar") &&
        questions.hasOwnProperty("mostRecent")
      ) {
        // We have both suggestions
        console.log("both most similar and most recent!");
        let mostRecentQuestion = questions[
          "mostRecent" as keyof JSON
        ] as unknown as JSON;

        let getMostRecentQuestionUlidSql = `select SlackQuestionUUID
      from
      SlackQuestion inner join SlackChannel on SlackQuestion.SlackChannelUUID = SlackChannel.SlackChannelUUID
      where
      SlackQuestion.Ts = :messageTs and
      SlackChannel.ChannelID = :channelID`;

        let getMostRecentQuestionUlidResult = await data.query(
          getMostRecentQuestionUlidSql,
          {
            messageTs: mostRecentQuestion["messageTs" as keyof JSON] as string,
            channelID: this.channelID,
          }
        );

        recentQuestionULID =
          getMostRecentQuestionUlidResult.records[0].SlackQuestionUUID;
        if (recentQuestionULID === null) {
          console.log("Most Recent Question missing from Db");
          return {
            type: "success",
            value: "Most Recent Question missing from Db",
          };
        }

        let recentSimilarityScore = Number(
          mostRecentQuestion["similarity" as keyof JSON]
        ) as number;

        let getQuestionSql =
          "select SlackAnswerUUID from SlackQuestion where SlackQuestionUUID = :SlackQuestionUUID";

        let getQuestionResult = await data.query(getQuestionSql, {
          SlackQuestionUUID: recentQuestionULID,
        });

        if (getQuestionResult.records[0].SlackAnswerUUID === null) {
          // Answer is null in DB
          isRecentAnswerInDb = false;
          console.log("answer of similar recent question in DB is null");
          let recentQuestionTS = mostRecentQuestion[
            "messageTs" as keyof JSON
          ] as string;

          let repliesConfig = {
            method: "get",
            url:
              "https://slack.com/api/conversations.replies?channel=" +
              this.channelID +
              "&ts=" +
              recentQuestionTS,
            headers: {
              Authorization: "Bearer " + botToken,
              "Content-Type": "application/json",
            },
          } as AxiosRequestConfig<any>;
          const repliesRes = await axios(repliesConfig);
          console.log(repliesRes);

          let answerTs = repliesRes.data.messages[1].ts as string;

          let getLinkConfig = {
            method: "get",
            url:
              "https://slack.com/api/chat.getPermalink?channel=" +
              this.channelID +
              "&message_ts=" +
              answerTs,
            headers: {
              Authorization: "Bearer " + botToken,
              "Content-Type": "application/json",
            },
          } as AxiosRequestConfig<any>;
          const getLinkRes = await axios(getLinkConfig);
          recentAnswerLink = getLinkRes.data.permalink;
        } else {
          console.log(
            "answer link for more recent similar question exists in DB"
          );

          let getAnswerLinkSql =
            "select AnswerLink from SlackAnswer where SlackAnswerUUID = :SlackAnswerUUID";

          let getAnswerLinkResult = await data.query(getAnswerLinkSql, {
            SlackAnswerUUID: getQuestionResult.records[0]
              .SlackAnswerUUID as string,
          });
          recentAnswerLink = getAnswerLinkResult.records[0].AnswerLink;
        }

        msgParams = {
          channel: this.channelID,
          user: this.userID,
          username: "Osmosix Bot",
          text: "I think I might have an answer for you!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "I think I might have an answer for you!",
              },
            },
            {
              type: "divider",
            },
            {
              // Most similar question
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "Similarity score: " +
                  Math.round(similarityScore * 100) / 100 +
                  " <" +
                  answerLink +
                  "|View thread>",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Helpful",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "helpful",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Not Helpful",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "nothelpful",
                },
                {
                  type: "button",
                  style: "danger",
                  text: {
                    type: "plain_text",
                    text: "Dismiss",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "dismiss",
                },
              ],
            },
            {
              // Most recent question over 60% similar
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "Recent Similarity score: " +
                  Math.round(recentSimilarityScore * 100) / 100 +
                  " <" +
                  recentAnswerLink +
                  "|View thread>",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Helpful",
                  },
                  value: recentQuestionULID + " " + this.messageID,
                  action_id: "helpful",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Not Helpful",
                  },
                  value: recentQuestionULID + " " + this.messageID,
                  action_id: "nothelpful",
                },
                {
                  type: "button",
                  style: "danger",
                  text: {
                    type: "plain_text",
                    text: "Dismiss",
                  },
                  value: recentQuestionULID + " " + this.messageID,
                  action_id: "dismiss",
                },
              ],
            },
          ],
        };
      }

      if (
        questions.hasOwnProperty("mostSimilar") &&
        !questions.hasOwnProperty("mostRecent")
      ) {
        // We just have one suggestion
        msgParams = {
          channel: this.channelID,
          user: this.userID,
          username: "Osmosix Bot",
          text: "I think I might have an answer for you!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "I think I might have an answer for you!",
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "Similarity score: " +
                  Math.round(similarityScore * 100) / 100 +
                  " <" +
                  answerLink +
                  "|View thread>",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Helpful",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "helpful",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Not Helpful",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "nothelpful",
                },
                {
                  type: "button",
                  style: "danger",
                  text: {
                    type: "plain_text",
                    text: "Dismiss",
                  },
                  value: mostSimilarQuestionULID + " " + this.messageID,
                  action_id: "dismiss",
                },
              ],
            },
          ],
        };
      }

      // Send Slack Message

      let msgConfig = {
        method: "post",
        url: "https://slack.com/api/chat.postEphemeral",
        headers: {
          Authorization: "Bearer " + botToken,
          "Content-Type": "application/json",
        },
        data: msgParams,
      } as AxiosRequestConfig<any>;
      const msgRes = await axios(msgConfig);

      if (!isAnswerInDb) {
        console.log("isAnswerInDb was false so inserting answer into DB");
        let insertAnswerSql =
          "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";
        let answerULID = ulid();

        let insertAnswerResult = await data.query(insertAnswerSql, {
          SlackAnswerUUID: answerULID,
          AnswerLink: answerLink,
          Upvotes: 0,
        });

        let updateQuestionSql =
          "update SlackQuestion set SlackAnswerUUID = :SlackAnswerUUID where SlackQuestionUUID = :SlackQuestionUUID";

        let updateQuestionResult = await data.query(updateQuestionSql, {
          SlackAnswerUUID: answerULID,
          SlackQuestionUUID: mostSimilarQuestionULID,
        });
      }

      if (!isRecentAnswerInDb) {
        console.log("isRecentAnswerInDb was false so inserting answer into DB");
        let insertAnswerSql =
          "insert into SlackAnswer (SlackAnswerUUID, AnswerLink, Upvotes) values (:SlackAnswerUUID, :AnswerLink, :Upvotes)";
        let answerULID = ulid();

        let insertAnswerResult = await data.query(insertAnswerSql, {
          SlackAnswerUUID: answerULID,
          AnswerLink: recentAnswerLink as string,
          Upvotes: 0,
        });

        let updateQuestionSql =
          "update SlackQuestion set SlackAnswerUUID = :SlackAnswerUUID where SlackQuestionUUID = :SlackQuestionUUID";

        let updateQuestionResult = await data.query(updateQuestionSql, {
          SlackAnswerUUID: answerULID,
          SlackQuestionUUID: recentQuestionULID,
        });
      }
    } catch (e) {
      return {
        type: "error",
        error: new Error("New Message ML Work calls failed: " + e),
      };
    }
    return {
      type: "success",
      value: "New Message ML Work successfully finished",
    };
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

  isParentMessage(message: JSON): boolean {
    return message.hasOwnProperty("thread_ts");
  }

  batchSendToSqs(channelMessages: any[]): Promise<ServiceOutputTypes>[] {
    let promises: Promise<ServiceOutputTypes>[] = [];
    let batch_size = 5;
    for (let i = 0; i < channelMessages.length; i += batch_size) {
      //console.log("hit for loop");

      let channelMessagesBatch = channelMessages.slice(i, i + batch_size);
      //console.log(channelMessagesBatch);
      let sqsSendBatchMessageEntries: SendMessageBatchRequestEntry[] =
        channelMessagesBatch.map((message, index) => ({
          Id: String(index),
          MessageBody: JSON.stringify(
            new AppAddedMessageProcessing(
              this.channelID,
              this.workspaceID,
              message.user,
              message.thread_ts,
              message.ts,
              message.text
            )
          ),
        }));

      //console.log(sqsSendBatchMessageEntries);
      let sqsSendBatchMessageInput: SendMessageBatchCommandInput = {
        Entries: sqsSendBatchMessageEntries,
        QueueUrl: process.env.PROCESS_EVENTS_ML_SQS_URL,
      };
      let command = new SendMessageBatchCommand(sqsSendBatchMessageInput);
      promises.push(client.send(command));
    }
    return promises;
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

      let getBotTokenSql = `select SlackToken.BotToken, SlackWorkspace.CustomEmoji from SlackToken 
    join SlackWorkspace on SlackToken.SlackWorkspaceUUID = SlackWorkspace.SlackWorkspaceUUID 
    where SlackWorkspace.WorkspaceID = :workspaceID`;

      let getBotTokenResult = await data.query(getBotTokenSql, {
        workspaceID: this.workspaceID,
      });

      if (
        getBotTokenResult.records.length !== 1 ||
        !getBotTokenResult.records[0].BotToken
      ) {
        return { type: "success", value: "App Added Work: Missing Bot Token" };
      }

      let botToken = getBotTokenResult.records[0].BotToken;

      let isCustomEmojiAdded = getBotTokenResult.records[0]
        .CustomEmoji as boolean;

      let emojiCode = ":arrows_counterclockiwise:";

      if (isCustomEmojiAdded) {
        emojiCode = ":osmosix-loading:";
      }

      if (this.workspaceID !== "T07QTAG4S") {
        // Send App Added Message
        let msgParams = {
          channel: this.channelID,
          text:
            "Thank you for adding me to your channel!\n Here are some emoji's and their meanings you will see as you use me:\n\t" +
            emojiCode +
            " means I'm working on finding an answer to that question\n\t:white_check_mark: means I helped answer that question\n\t:question: means I was unable to answer that question\nCheck out the about section of my app to help you get started too!\nFeel free to start using me right away, but I will be more helpful after a minute or two.",
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
      let sqsPromises: Promise<ServiceOutputTypes>[] = [];

      do {
        let cursorParam;
        let channelMessages = [];

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

        // This code should ensure that only messages with a thread get sent to ML processing
        for (const message of getChannelMessagesResult.data.messages) {
          if (message.thread_ts && message.type && message.type === "message") {
            channelMessages.push(message);
          }
        }
        sqsPromises = sqsPromises.concat(this.batchSendToSqs(channelMessages));
        // // TODO: Test if filtering below is filtering out non-parent messages
        // channelMessages = channelMessages.concat(
        //   (getChannelMessagesResult.data.messages).filter(message  => {if (message.thread_ts)})
        // );

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

      let responses = await Promise.all(sqsPromises);
    } catch (e) {
      return {
        type: "error",
        error: new Error("App Added Network calls failed:" + e),
      };
    }
    return { type: "success", value: "App Added sent to SQS sucessfully" };
  }
}

export class AppAddedMessageProcessing implements MachineLearningIsWorkable {
  public type: string;
  constructor(
    public channelID: string,
    public workspaceID: string,
    public userID: string,
    public parentMsgID: string | null,
    public messageID: string,
    public text: string
  ) {
    this.channelID = channelID;
    this.workspaceID = workspaceID;
    this.userID = userID;
    this.parentMsgID = parentMsgID;
    this.messageID = messageID;
    this.type = "APPADDEDMESSAGEPROCESSING";
    this.text = text;
  }

  static fromJSON(slackJSON: JSON): Result<AppAddedMessageProcessing> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("userID") ||
      !slackJSON.hasOwnProperty("parentMsgID") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("text")
    ) {
      return {
        type: "error",
        error: new Error(
          "AppAddedMessageProcessing JSON is missing a property"
        ),
      };
    }
    return {
      type: "success",
      value: new AppAddedMessageProcessing(
        slackJSON["channelID" as keyof JSON] as string,
        slackJSON["workspaceID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string,
        slackJSON["parentMsgID" as keyof JSON] as string | null,
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["text" as keyof JSON] as string
      ),
    };
  }

  async doMLWork(vector: undefined): Promise<Result<string>> {
    console.log("App Added: ML Work");
    try {
      let insertQuestionSql = `insert into SlackQuestion (SlackQuestionUUID,
    SlackAnswerUUID,
    SlackChannelUUID,
    SlackUserUUID,
    Ts)
    values (:SlackQuestionUUID,
      NULL,
      (select SlackChannelUUID from SlackChannel where ChannelID = :slackChannelID limit 1),
      (select SlackUserUUID from SlackUser where SlackID = :slackID limit 1),
      :Ts)`;

      let insertQuestionResult = await data.query(insertQuestionSql, {
        SlackQuestionUUID: ulid(),
        slackChannelID: this.channelID,
        slackID: this.userID,
        Ts: this.messageID,
      });
    } catch (e) {
      return {
        type: "error",
        error: new Error("AppAdded ML Work calls failed: " + e),
      };
    }
    return {
      type: "success",
      value: "App Added ML Work successfully finished",
    };
  }
}

/* --------  Interface -------- */

export interface MachineLearningIsWorkable {
  type: string;
  doMLWork(vectors: undefined | JSON): Promise<Result<string>>;
}
