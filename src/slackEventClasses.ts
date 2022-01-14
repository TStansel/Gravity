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
}

export class NotHelpfulButton extends SlackButtonEvent {
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
}

export class DismissButton extends SlackButtonEvent {
  constructor(
    channelID: string,
    workspaceID: string,
    responseURL: string,
    messageID: string
  ) {
    super(channelID, workspaceID, responseURL, messageID);
  }
}

export class MarkedAnswerEvent extends SlackEvent {
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
}

export class NewMessageEvent extends SlackEvent {
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
}

export class AppAddedEvent extends SlackEvent {
  constructor(channelID: string, workspaceID: string, public userID: string) {
    super(channelID, workspaceID);
    this.userID = userID;
  }
}
