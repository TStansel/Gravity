import { ulid } from "ulid";
import { Result, ResultError, ResultSuccess } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Export {
  constructor(
    public exportULID: string | null,
    public deckULID: string | null,
    public slackChannelULID: string | null,
  ) {
    this.exportULID = exportULID;
    this.deckULID = deckULID;
    this.slackChannelULID = slackChannelULID;
  }

  static verifyCreateEvent(json: JSON): Result<Export> {
    if (
      !json.hasOwnProperty("deckULID") &&
      !json.hasOwnProperty("slackChannelULID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Export(
        ulid(),
        json["deckULID" as keyof JSON] as string,
        json["slackChannelULID" as keyof JSON] as string,
      ),
    };
  }

  static verifyGetAllEvent(json: JSON): Result<Export> {
    if (!json.hasOwnProperty("deckULID") && !json.hasOwnProperty("slackChannelULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Export(
        json["exportULID" as keyof JSON] as string,
        json["deckULID" as keyof JSON] as string,
        json["slackChannelULID" as keyof JSON] as string
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Export> {
    if (!json.hasOwnProperty("exportULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Export(
        json["deckULID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertSql = `insert into Export (ExportULID,
          DeckULID,
          SlackChannelULID)
        values (:ExportULID,
          :DeckULID,
          :SlackChannelULID)`;

      let insertResult = await data.query(insertSql, {
        ExportULID: ulid(),
        DeckULID: this.deckULID,
        SlackChannelULID: this.slackChannelULID
      });
      return {
        type: "success",
        value: insertResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Create Export call failed: " + e),
      };
    }
  }

  async getAll(): Promise<Result<string>> {
    try {
      let getAllSql = `select * from Export 
      where DeckULID = (:DeckULID`;

      let getAllResult = await data.query(getAllSql, {
        DeckULID: this.deckULID,
      });
      return {
        type: "success",
        value: getAllResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get All Exports call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteSql = `delete from Export 
      where ExportULID = :ExportULID`;

      let deleteResult = await data.query(deleteSql, {
        ExportULID: this.exportULID,
      });
      return {
        type: "success",
        value: deleteResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Export call failed: " + e),
      };
    }
  }
}
