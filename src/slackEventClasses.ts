/* --------  Types -------- */
// These types are used so we can levarage Typescripts type system instead of throwing error which
// makes it hard to keep track of types
export type ResultSuccess<T> = { type: "success"; value: T };

export type ResultError = { type: "error"; error: Error };

export type Result<T> = ResultSuccess<T> | ResultError;

/* --------  Classes -------- */

export class SlackEvent {
  public channelID: string;
  public workspaceID: string;

  constructor(channelID: string, workspaceID: string) {
    this.channelID = channelID;
    this.workspaceID = workspaceID;
  }
}

export class SlackButtonEvent extends SlackEvent {
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
}

export class HelpfulButton extends SlackButtonEvent {
  static type: "HELPFULBUTTON";
  constructor(
    channelID: string,
    workspaceID: string,
    responseURL: string,
    messageID: string,
    public oldQuestionUUID: string,
    public userID: string
  ) {
    super(channelID, workspaceID, responseURL, messageID);
    this.oldQuestionUUID = oldQuestionUUID;
    this.userID = userID;
  }
  static fromJSON(slackJSON: JSON): Result<HelpfulButton> {
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
}

export class NotHelpfulButton extends SlackButtonEvent {
  static type: "NOTHELPFULBUTTON";
  constructor(
    channelID: string,
    workspaceID: string,
    responseURL: string,
    messageID: string,
    public oldQuestionUUID: string
  ) {
    super(channelID, workspaceID, responseURL, messageID);
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
}

export class DismissButton extends SlackButtonEvent {
  static type: "DISMISSBUTTON";
  constructor(
    channelID: string,
    workspaceID: string,
    responseURL: string,
    messageID: string
  ) {
    super(channelID, workspaceID, responseURL, messageID);
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
}

export class MarkedAnswerEvent extends SlackEvent {
  static type: "MARKEDANSWEREVENT";
  constructor(
    channelID: string,
    workspaceID: string,
    public parentMsgID: string | undefined,
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

  static fromJSON(
    slackJSON: JSON
  ): Result<MarkedAnswerEvent> {
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
        slackJSON["messageID" as keyof JSON] as string,
        slackJSON["userID" as keyof JSON] as string,
        slackJSON["text" as keyof JSON] as string
      ),
    };
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
}
