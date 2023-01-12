let _table = "videomail";
var Model = require('./_model158')
var defaultModel = new Model(_table)

let conn = require('../config/DbConnect');

var mysql = require('mysql');

var conCpodProduction = mysql.createConnection({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
});

var conCpodLogging = mysql.createConnection({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: "chinesepod_logging",
});

// module.exports = { baseModel.get }
module.exports = {

    // BASE FUNCTIONS LOCATED IN defaultModel
    get : async function() {
        return await defaultModel.get()
    },
    find : async function(id) {
        return await defaultModel.find(id)
	},
	findQuery : async function(query) {
        return await defaultModel.findQuery(query)
	},
	update : async function(id,data) {
        return await defaultModel.update(id,data)
    },
	put : async function(data) {
        return await defaultModel.put(data)
    },
    upsert : async function(query, data) {
        return await defaultModel.upsert(query, data)
	},
	remove : async function(id) {
        return await defaultModel.remove(id)
    },

    // ADD CUSTOM FUNCTION BELOW ========================
    // ==================================================

	getNativeProduction : async function(query){
        return new Promise(function(resolve, reject) {
            conCpodProduction.query(query, function (err, result) {
                if (err) reject(err);

                resolve(result)
            });
        });
	},
	
	getNativeLogging : async function(query){
        return new Promise(function(resolve, reject) {
            conCpodLogging.query(query, function (err, result) {
                if (err) reject(err);

                resolve(result)
            });
        });
    },


    addUserEmailLogs : async function(data){
        return new Promise(function(resolve, reject) {
            var sql = `INSERT INTO email_logs (user_id, email_id, email_send_id, opens, clicks, createdAt)
                       VALUES (${data.id}, '${data.emailIdentifier}', '${data.email_send_id}', 0, 0,now())`
            conCpodLogging.query(sql, function (err, result) {
                if (err) reject(err);

                resolve(result)
            });
        });
    },

}