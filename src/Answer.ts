import { ulid } from "ulid";
import { Result, ResultError } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Answer {
  constructor(public answerUUID: String, public text: string | null) {
    this.answerUUID = answerUUID;
    this.text = text;
  }

  static verifyCreateEvent(json: JSON): Result<Answer> {
    if (!json.hasOwnProperty("text")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Answer(ulid(),json["text" as keyof JSON] as string),
    };
  }

  static verifyGetEvent(json: JSON): Result<Answer> {
    if (!json.hasOwnProperty("answerUUID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Answer(json["answerUUID" as keyof JSON] as string, null),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Answer> {
    if (!json.hasOwnProperty("answerUUID") && !json.hasOwnProperty("text")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Answer(json["answerUUID" as keyof JSON] as string, json["text" as keyof JSON] as string),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Answer> {
    if (!json.hasOwnProperty("answerUUID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Answer(json["answerUUID" as keyof JSON] as string, null),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertAnswerSql = `insert into Answer (AnswerUUID,
          Text)
        values (:AnswerUUID,
          :Text)`;

      let insertAnswerResult = await data.query(insertAnswerSql, {
        AnswerUUID: this.answerUUID,
        Text: this.text,
      });
      return {
        type: "success",
        value: insertAnswerResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Create Answer call failed: " + e),
      };
    }
  }

  async get(): Promise<Result<ResultError>> {
    try {
      let getAnswerSql = `select * from Answer where AnswerUUID = :AnswerUUID`;

      let getAnswerResult = await data.query(getAnswerSql, {
        AnswerUUID: this.answerUUID,
      });
      return {
        type: "success",
        value: getAnswerResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get Answer call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let updateAnswerSql = `update Answer 
      set Answer.Text = :Text
      where Answer.AnswerUUID = :AnswerUUID`;

      let updateAnswerResult = await data.query(updateAnswerSql, {
        AnswerUUID: this.answerUUID,
        Text: this.text
      });
      return {
        type: "success",
        value: updateAnswerResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Update Answer call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteAnswerSql = `delete from Answer where AnswerUUID = :AnswerUUID`;

      let deleteAnswerResult = await data.query(deleteAnswerSql, {
        AnswerUUID: this.answerUUID,
      });
      return {
        type: "success",
        value: deleteAnswerResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Answer call failed: " + e),
      };
    }
  }
}
