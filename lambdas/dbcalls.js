const mysql = require('mysql');

const connection = mysql.createConnection({
  host: "osmosix-db-cluster.cluster-cjhe8r4r5x7y.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "admin123",
  database: "osmosix",
});

let pool = mysql.createPool({
    host: "osmosix-db-cluster.cluster-cjhe8r4r5x7y.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "admin123",
    database: "osmosix",
});

exports.handler = async (event, context, callback) => {
  console.log("Request Event: ", event);
  context.callbackWaitsForEmptyEventLoop = false;
  
  let result = {};
  try{
      let sql = event.queryStringParameters.query;
      result = await query(sql,0);
  }catch (err){
      throw new Error(err);
  }
  console.log("Data: ", result);
  return callback(null, {body: JSON.stringify(result),statusCode:200});
}

let query = async (sql, params) => {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        connection.query(sql, params, (err, results) => {
          if (err){
            reject(err);
          }
          connection.release();
          resolve(results);
        });
      });
    });
};