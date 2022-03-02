import { ulid } from "ulid";
import { Result, ResultError, ResultSuccess } from "./slackEventClasses";
const data = require("data-api-client")({
  secretArn: process.env.AURORA_SECRET_ARN,
  resourceArn: process.env.AURORA_RESOURCE_ARN,
  database: "osmosix", // set a default database
});

export class Admin {
  constructor(
    public adminULID: string | null,
    public companyULID: string | null,
    public name: string | null,
  ) {
    this.adminULID = adminULID;
    this.companyULID = companyULID;
    this.name = name;
  }

  static verifyCreateEvent(json: JSON): Result<Admin> {
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
      value: new Admin(
        ulid(),
        json["companyULID" as keyof JSON] as string,
        json["name" as keyof JSON] as string,
      ),
    };
  }

  static verifyGetOneEvent(json: JSON): Result<Admin> {
    if (
      !json.hasOwnProperty("adminULID")
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Admin(
        json["adminULID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  static verifyGetAllEvent(json: JSON): Result<Admin> {
    if (!json.hasOwnProperty("adminULID") && !json.hasOwnProperty("companyULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Admin(
        json["adminULID" as keyof JSON] as string,
        json["companyULID" as keyof JSON] as string,
        null
      ),
    };
  }

  static verifyUpdateEvent(json: JSON): Result<Admin> {
    if (
      // This is currently an update all attributes of the question 
      !json.hasOwnProperty("adminULID") &&
      !json.hasOwnProperty("name") 
    ) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Admin(
        json["adminULID" as keyof JSON] as string,
        (json["name" as keyof JSON] as string),
        null
      ),
    };
  }

  static verifyDeleteEvent(json: JSON): Result<Admin> {
    if (!json.hasOwnProperty("adminULID")) {
      return {
        type: "error",
        error: new Error("Event is missing a property."),
      };
    }
    return {
      type: "success",
      value: new Admin(
        json["adminULID" as keyof JSON] as string,
        null,
        null
      ),
    };
  }

  async create(): Promise<Result<ResultError>> {
    try {
      let insertSql = `insert into Admin (AdminULID,
          CompanyULID,
          Name)
        values (:AdminULID,
          :CompanyULID,
          :Name)`;

      let insertResult = await data.query(insertSql, {
        AdminULID: ulid(),
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
        error: new Error("Create Admin call failed: " + e),
      };
    }
  }

  async getOne(): Promise<Result<string>> {
    try {
      let getOneSql = `select * from Admin where AdminULID = :AdminULID`;

      let getOneResult = await data.query(getOneSql, {
        AdminULID: this.adminULID,
      });
      return {
        type: "success",
        value: getOneResult.toString(),
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Get One Admin call failed: " + e),
      };
    }
  }

  async getAll(): Promise<Result<string>> {
    try {
      let getAllSql = `select * from Admin 
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
        error: new Error("Get All Admin call failed: " + e),
      };
    }
  }

  async update(): Promise<Result<ResultError>> {
    try {
      let udpateSql = `update Admin 
    set Admin.Name = :Name
      where Admin.AdminULID = :AdminULID`;

      let udpateResult = await data.query(udpateSql, {
        AdminULID: this.adminULID,
        Name: this.name
      });
      return {
        type: "success",
        value: udpateResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Update Admin call failed: " + e),
      };
    }
  }

  async delete(): Promise<Result<ResultError>> {
    try {
      let deleteSql = `delete from Admin 
      where AdminULID = :AdminULID`;

      let deleteResult = await data.query(deleteSql, {
        AdminULID: this.adminULID,
      });
      return {
        type: "success",
        value: deleteResult,
      };
    } catch (e) {
      return {
        type: "error",
        error: new Error("Delete Admin call failed: " + e),
      };
    }
  }
}
