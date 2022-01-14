import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
const data = require("data-api-client")({
  secretArn:
    "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu",
  resourceArn: "arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster",
  database: "osmosix", // set a default database
});

/* --------  Types -------- */
// These types are used so we can levarage Typescripts type system instead of throwing error which
// makes it hard to keep track of types
export type ResultSuccess<T> = { type: "success"; value: T };

export type ResultError = { type: "error"; error: Error };

export type Result<T> = ResultSuccess<T> | ResultError;

/* --------  Classes -------- */

export abstract class SlackEvent {
  public channelID: string;
  public workspaceID: string;

  constructor(channelID: string, workspaceID: string) {
    this.channelID = channelID;
    this.workspaceID = workspaceID;
  }

  abstract doWork(): Promise<Result<string>>;
}

export class HelpfulButton extends SlackEvent {
  static type: "HELPFULBUTTON";
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
  static type: "NOTHELPFULBUTTON";
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
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}

export class DismissButton extends SlackEvent {
  static type: "DISMISSBUTTON";
  constructor(
    channelID: string,
    workspaceID: string,
    public responseURL: string,
    public messageID: string
  ) {
    super(channelID, workspaceID);
    this.responseURL = responseURL;
    this.messageID = messageID;
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
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}

export class MarkedAnswerEvent extends SlackEvent {
  static type: "MARKEDANSWEREVENT";
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
        undefined,
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string,
        slackJSON["text" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
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

      // CALL NLP
    } catch (e) {
      return {
        type: "error",
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}

export class NewMessageEvent extends SlackEvent {
  static type: "NEWMESSAGEEVENT";
  constructor(
    channelID: string,
    workspaceID: string,
    public messageID: string,
    public userID: string,
    public text: string
  ) {
    super(channelID, workspaceID);
    this.messageID = messageID;
    this.userID = userID;
    this.text = text;
  }
  static fromJSON(slackJSON: JSON): Result<NewMessageEvent> {
    if (
      !slackJSON.hasOwnProperty("channelID") ||
      !slackJSON.hasOwnProperty("workspaceID") ||
      !slackJSON.hasOwnProperty("messageID") ||
      !slackJSON.hasOwnProperty("userID") ||
      !slackJSON.hasOwnProperty("text")
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
        slackJSON["text" as keyof JSON] as string
      ),
    };
  }

  async doWork(): Promise<Result<string>> {
    try {
    } catch (e) {
      return {
        type: "error",
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}

export class AppAddedEvent extends SlackEvent {
  static type: "APPADDEDEVENT";
  constructor(channelID: string, workspaceID: string, public userID: string) {
    super(channelID, workspaceID);
    this.userID = userID;
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
    try {
    } catch (e) {
      return {
        type: "error",
        error: new Error("Helpful Network calls failed:" + e),
      };
    }
    return { type: "success", value: "Helpful Button completed sucessfully" };
  }
}
