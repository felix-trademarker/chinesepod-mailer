const MongoClient = require( 'mongodb' ).MongoClient;
const mongoose = require('mongoose');
const _variables = require( './variables' );

var _db, _dbEU, _dbAWS, _db158;
console.log(_variables.mongoURL);
module.exports = {

  connectToServer: function( callback ) {
    MongoClient.connect( _variables.mongoURL ,  _variables.mongoOptions, function( err, client ) {
      _db  = client.db(_variables.mongoDB);
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  },

  connectToServerEU: function( callback ) {
    MongoClient.connect( _variables.mongoURLEU ,  _variables.mongoOptions, function( err, client ) {
      _dbEU  = client.db(_variables.mongoDB);
      return callback( err );
    } );
  },

  getDbEU: function() {
    return _dbEU;
  },

  connectToServerAWS: function( callback ) {
    MongoClient.connect( _variables.mongoURLAWS ,  _variables.mongoOptions, function( err, client ) {
      _dbAWS  = client.db(_variables.mongoDB);
      return callback( err );
    } );
  },

  getDbAWS: function() {
    return _dbAWS;
  },

  connectToServer158: function( callback ) {
    MongoClient.connect( _variables.mongoURL158 ,  _variables.mongoOptions, function( err, client ) {
      _db158  = client.db('chinesepod');
      return callback( err );
    } );
  },

  getDb158: function() {
    return _db158;
  }


};