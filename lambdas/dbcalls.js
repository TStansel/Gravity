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
      let sql = event.query;
      let params = 0;
      if (event.hasOwnProperty('queryPt2')){
        sql = event.queryPt1;
        params = [event.link,event.queryPt2];
      }
      console.log("SQL:",sql)
      result = await query(sql,params);
  }catch (err){
      throw new Error(err);
  }
  console.log("Data: ", result);
  return callback(null, {body: JSON.stringify(result),statusCode:200});
}

let query = async (sql, params) => {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        let sqlQ = sql;
        if (params != 0){
          sqlQ = sql + connection.escape(params[0]) + params[1]
        }
        console.log("SQLQ:",sqlQ)
        connection.query(sqlQ, (err, results) => {
          if (err){
            reject(err);
          }
          connection.release();
          resolve(results);
        });
      });
    });
};