// Loads any variables in the .env file into `process.env`
require('dotenv').config();
const { Pool } = require('pg');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;


/*
 * POSTGRES STUFF
 */

// create a new pool here using the connection string above
const pool = new Pool({
  connectionString: process.env.PG_URI,
});

// We export an object that contains a property called query,
// which is a function that returns the invocation of pool.query() after logging the query
// This will be required in the controllers to be the access point to the database
const dogDB = {
  query: (text, params, callback) => {
    console.log('executed query', text);
    return pool.query(text, params, callback);
  },
};

/*
 * MONGO STUFF
 */
mongoose.connect(process.env.MONGO_URI, {
  // options for the connect method to parse the URI
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // sets the name of the DB that our collection is a part of
  dbName: 'graphql_test',
});

const userSchema = new Schema({
  name: String,
  dogIds: [Number],
});

const collectionName = 'users';
const User = mongoose.model(collectionName, userSchema);

module.exports = { User, dogDB };

