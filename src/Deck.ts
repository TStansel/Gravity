import { ulid } from "ulid";
import { Result, ResultError, ResultSuccess } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Deck {
  constructor(
    public deckULID: string | null,
    public companyULID: string | null,
    public name: string | null,
  ) {
    this.deckULID = deckULID;
    this.name = name;
  }

  static verifyCreateEvent(json: JSON): Result<Deck> {
    if (
      !json.hasOwnProperty("companyULID") &&
      !json.hasOwnProperty("name")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Deck(
        ulid(),
        json["companyULID" as keyof JSON] as string,
        json["name" as keyof JSON] as string,
      ),
    };
  }

  static verifyGetOneEvent(json: JSON): Result<Deck> {
    if (
      !json.hasOwnProperty("deckULID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Deck(
        json["deckULID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  static verifyGetAllEvent(json: JSON): Result<Deck> {
    if (!json.hasOwnProperty("deckULID") && !json.hasOwnProperty("companyULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Deck(
        json["deckULID" as keyof JSON] as string,
        json["companyULID" as keyof JSON] as string,
        null
      ),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Deck> {
    if (
      // This is currently an update all attributes of the question 
      !json.hasOwnProperty("deckULID") &&
      !json.hasOwnProperty("name") 
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Deck(
        json["deckULID" as keyof JSON] as string,
        (json["name" as keyof JSON] as string),
        null
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Deck> {
    if (!json.hasOwnProperty("deckULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Deck(
        json["deckULID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertSql = `insert into Deck (DeckULID,
          CompanyULID,
          Name)
        values (:DeckULID,
          :CompanyULID,
          :Name)`;

      let insertResult = await data.query(insertSql, {
        DeckULID: ulid(),
        CompanyULID: this.companyULID,
        Name: this.name
      });
      return {
        type: "success",
        value: insertResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Create Deck call failed: " + e),
      };
    }
  }

  async getOne(): Promise<Result<string>> {
    try {
      let getOneSql = `select * from Deck where DeckULID = :DeckULID`;

      let getOneResult = await data.query(getOneSql, {
        DeckULID: this.deckULID,
      });
      return {
        type: "success",
        value: getOneResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get One Deck call failed: " + e),
      };
    }
  }

  async getAll(): Promise<Result<string>> {
    try {
      let getAllSql = `select * from Deck 
      where CompanyULID = (:CompanyULID`;

      let getAllResult = await data.query(getAllSql, {
        CompanyULID: this.companyULID,
      });
      return {
        type: "success",
        value: getAllResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get All Deck call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let udpateSql = `update Deck 
    set Deck.Name = :Name
      where Deck.DeckULID = :DeckULID`;

      let udpateResult = await data.query(udpateSql, {
        DeckULID: this.deckULID,
        Name: this.name
      });
      return {
        type: "success",
        value: udpateResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Update Deck call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteSql = `delete from Deck 
      where DeckULID = :DeckULID`;

      let deleteResult = await data.query(deleteSql, {
        DeckULID: this.deckULID,
      });
      return {
        type: "success",
        value: deleteResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Deck call failed: " + e),
      };
    }
  }
}
