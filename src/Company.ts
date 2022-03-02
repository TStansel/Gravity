import { ulid } from "ulid";
import { Result, ResultError, ResultSuccess } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Company {
  constructor(
    public companyULID: string | null,
    public name: string | null,
  ) {
    this.companyULID = companyULID;
    this.name = name;
  }

  static verifyCreateEvent(json: JSON): Result<Company> {
    if (
      !json.hasOwnProperty("name")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Company(
        ulid(),
        json["name" as keyof JSON] as string,
      ),
    };
  }

  static verifyGetOneEvent(json: JSON): Result<Company> {
    if (
      !json.hasOwnProperty("companyULID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Company(
        json["companyULID" as keyof JSON] as string,
        null
      ),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Company> {
    if (
      // This is currently an update all attributes of the question 
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
      value: new Company(
        json["companyULID" as keyof JSON] as string,
        json["name" as keyof JSON] as string
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Company> {
    if (!json.hasOwnProperty("companyULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Company(
        json["companyULID" as keyof JSON] as string,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertSql = `insert into Company (CompanyULID,
          Name)
        values (:CompanyULID,
          :Name)`;

      let insertResult = await data.query(insertSql, {
        CompanyULID: ulid(),
        Name: this.name
      });
      return {
        type: "success",
        value: insertResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Create Company call failed: " + e),
      };
    }
  }

  async getOne(): Promise<Result<string>> {
    try {
      let getOneSql = `select * from Company where CompanyULID = :CompanyULID`;

      let getOneResult = await data.query(getOneSql, {
        CompanyULID: this.companyULID,
      });
      return {
        type: "success",
        value: getOneResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get Company call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let udpateSql = `update Company 
    set Company.Name = :Name
      where Company.CompanyULID = :CompanyULID`;

      let udpateResult = await data.query(udpateSql, {
        Company: this.companyULID,
        Name: this.name
      });
      return {
        type: "success",
        value: udpateResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Update Company call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteSql = `delete from Company 
      where CompanyULID = :CompanyULID`;

      let deleteResult = await data.query(deleteSql, {
        CompanyULID: this.companyULID,
      });
      return {
        type: "success",
        value: deleteResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Company call failed: " + e),
      };
    }
  }
}
