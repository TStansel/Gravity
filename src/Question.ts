import { time } from "console";
import { ulid } from "ulid";
import { Result, ResultError, ResultSuccess } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Question {
  constructor(
    public questionULID: string | null,
    public deckULID: string | null,
    public timestamp: string | null,
    public questionText: string | null,
    public answerText: string | null,
    public upvotes: number | null
  ) {
    this.questionULID = questionULID;
    this.deckULID = deckULID;
    this.timestamp = timestamp;
    this.questionText = questionText;
    this.answerText = answerText;
    this.upvotes = upvotes;
  }

  static verifyCreateEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("deckULID") &&
      !json.hasOwnProperty("timestamp") &&
      !json.hasOwnProperty("questionText") &&
      !json.hasOwnProperty("answerText") &&
      !json.hasOwnProperty("upvotes")
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
        json["deckULID" as keyof JSON] as string,
        json["timestamp" as keyof JSON] as string,
        json["questionText" as keyof JSON] as string,
        json["answerText" as keyof JSON] as string,
        json["upvotes" as keyof JSON] as unknown as number
      ),
    };
  }

  static verifyGetOneEvent(json: JSON): Result<Question> {
    if (
      !json.hasOwnProperty("deckULID") &&
      !json.hasOwnProperty("questionULID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionULID" as keyof JSON] as string,
        json["deckULID" as keyof JSON] as string,
        null,
        null,
        null,
        null
      ),
    };
  }

  static verifyGetAllEvent(json: JSON): Result<Question> {
    if (!json.hasOwnProperty("deckULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        null,
        json["deckULID" as keyof JSON] as string,
        null,
        null,
        null,
        null
      ),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Question> {
    if (
      // This is currently an update all attributes of the question 
      !json.hasOwnProperty("questionULID") &&
      !json.hasOwnProperty("deckULID") &&
      !json.hasOwnProperty("timestamp") &&
        !json.hasOwnProperty("questionText") &&
        !json.hasOwnProperty("answerText") &&
        !json.hasOwnProperty("upvotes")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionULID" as keyof JSON] as string,
        json["deckULID" as keyof JSON] as string,
        (json["timestamp" as keyof JSON] as string) || null,
        (json["questionText" as keyof JSON] as string) || null,
        (json["answerText" as keyof JSON] as string) || null,
        (json["upvotes" as keyof JSON] as unknown as number) || null
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Question> {
    if (!json.hasOwnProperty("questionULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Question(
        json["questionULID" as keyof JSON] as string,
        null,
        null,
        null,
        null,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertQuestionSql = `insert into Question (QuestionULID,
          DeckULID,
          Timestamp,
          QuestionText,
          AnswerText,
          Upvotes)
        values (:QuestionULID,
          :DeckULID,
          :Timestamp,
          :QuestionText,
          :AnswerText,
          :Upvotes)`;

      let insertQuestionResult = await data.query(insertQuestionSql, {
        QuestionULID: ulid(),
        DeckULID: this.deckULID,
        Timestamp: this.timestamp,
        QuestionText: this.questionText,
        AnswerText: this.answerText,
        Upvotes: this.upvotes,
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

  async getOne(): Promise<Result<string>> {
    try {
      let getQuestionSql = `select * from Question where QuestionULID = :questionULID`;

      let getQuestionResult = await data.query(getQuestionSql, {
        QuestionULID: this.questionULID,
      });
      return {
        type: "success",
        value: getQuestionResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get Question call failed: " + e),
      };
    }
  }

  async getAll(): Promise<Result<string>> {
    try {
      let getQuestionsSql = `select * from Question 
      where DeckULID = (:DeckULID`;

      let getQuestionsResult = await data.query(getQuestionsSql, {
        DeckULID: this.deckULID,
      });
      return {
        type: "success",
        value: getQuestionsResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get All Questions call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let updateQuestionSql = `update Question 
    set Question.QuestionText = :QuestionText, Question.AnswerText = :AnswerText, Question.Upvotes = :Upvotes, Question.Timestamp = :Timestamp
      where Question.QuestionULID = :QuestionULID`;

      let updateQuestionResult = await data.query(updateQuestionSql, {
        QuestionULID: this.questionULID,
        QuestionText: this.questionText,
        AnswerText: this.answerText,
        Upvotes: this.upvotes,
        Timestamp: this.timestamp,
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
      where QuestionULID = :QuestionULID`;

      let deleteQuestionResult = await data.query(deleteQuestionSql, {
        QuestionULID: this.questionULID,
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
