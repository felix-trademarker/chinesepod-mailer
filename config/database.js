const _variables = require( './variables' );

// MONGO : DATABASE CONNECTION
const mongoose = require('mongoose');





// DB Connect
const mongoConnection = mongoose.createConnection(_variables.mongoURL, _variables.mongoOptions);

// 
mongoConnection
    .then(() => console.log('Mongo Database is connected successfully !'))
    .catch(err => console.log(err));

  
// module.exports = mysqlConnection;
module.exports = mongoConnection;
