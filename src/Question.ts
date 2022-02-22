import { ulid } from "ulid";
import { Result, ResultError } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Question {
  constructor(
    public questionUUID: string,
    public answerUUID: string | null,
    public channelID: string | null,
    public ts: string | null,
    public text: string | null
  ) {
    this.questionUUID = questionUUID;
    this.answerUUID = answerUUID;
    this.channelID = channelID;
    this.ts = ts;
    this.text = text;
  }

  static verifyCreateEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("answerUUID") &&
      !json.hasOwnProperty("channelID") &&
      !json.hasOwnProperty("ts") &&
      !json.hasOwnProperty("text")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        ulid(),
        json["answerUUID" as keyof JSON] as string,
        json["channelID" as keyof JSON] as string,
        json["ts" as keyof JSON] as string,
        json["text" as keyof JSON] as string
      ),
    };
  }

  static verifyGetEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("channelID") &&
      !json.hasOwnProperty("questionUUID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionUUID" as keyof JSON] as string,
        null,
        json["channelID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("questionUUID") && 
      !json.hasOwnProperty("channelID") &&
      !json.hasOwnProperty("ts") &&
      !json.hasOwnProperty("text")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionUUID" as keyof JSON] as string,
        null,
        json["channelID" as keyof JSON] as string,
        json["ts" as keyof JSON] as string,
        json["text" as keyof JSON] as string,
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("questionUUID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionUUID" as keyof JSON] as string,
        null,
        null,
        null,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertQuestionSql = `insert into Question (QuestionUUID,
          AnswerUUID,
          SlackChannelUUID,
          Ts,
          Text)
        values (:QuestionUUID,
          :AnswerUUID,
          (select SlackChannelUUID from SlackChannel where ChannelID = :slackChannelID limit 1).
          :Ts,
          :Text)`;

      let insertQuestionResult = await data.query(insertQuestionSql, {
        QuestionUUID: ulid(),
        AnswerUUID: this.answerUUID,
        slackChannelID: this.channelID,
        Ts: this.ts,
        Text: this.text,
      });
      return {
        type: "success",
        value: insertQuestionResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Create Question call failed: " + e),
      };
    }
  }

  async get(): Promise<Result<ResultError>> {
    try {
      let getQuestionSql = `select * from Question where QuestionUUID = :questionUUID`;

      let getQuestionResult = await data.query(getQuestionSql, {
        QuestionUUID: this.questionUUID
      });
      return {
        type: "success",
        value: getQuestionResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get Question call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let updateQuestionSql = `update Question 
      set Question.Text = :Text, Question.Ts = :Ts
      where Question.QuestionUUID = :QuestionUUID`;

      let updateQuestionResult = await data.query(updateQuestionSql, {
        QuestionUUID: this.questionUUID,
        Text: this.text,
        Ts: this.ts
      });
      return {
        type: "success",
        value: updateQuestionResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Update Question call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteQuestionSql = `delete from Question 
      where QuestionUUID = :QuestionUUID`;

      let deleteQuestionResult = await data.query(deleteQuestionSql, {
        QuestionUUID: this.questionUUID,
      });
      return {
        type: "success",
        value: deleteQuestionResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Question call failed: " + e),
      };
    }
  }
}
