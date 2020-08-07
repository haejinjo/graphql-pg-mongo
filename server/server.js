const { ApolloServer, gql } = require('apollo-server');
const { ObjectID } = require('mongodb');

/*
 * => SCENARIO:
 *    I have a dog walking web app.
 *    The app has User (i.e. dog walker) and Dog entities.
 *    I decide my User data would be better stored in a nonrelational DB like MongoDB,
 *    and that my Dog data will scale better using a relational DB like PostgreSQL.
 *
 * => HOW WE CAN MIX DATA SOURCES USING GRAPHQL:
 *    GraphQL allows us to resolve fields by requesting data from different places.
 *
 *    In other words, we can resolve fields _individually_ in GraphQL, so
 *    it doesn't matter what a field's data source is.
 *
 *    User `id` and `name` <= Mongo but User `dogs` array contents <= Postgres
 *    Dog `name` and `breed` <= Postgres but  Dog `walker` <= Mongo
 */


/*
 * 1. SETUP MODEL OBJECTS USING DATA SOURCES
 *
 * Grab mongoose `User` model containing logic to query *User documents*
   _id (ObjectId), name (String), dogIds (Number Array)
 * and Postgres `dogDB` model containing logic to query *Dog data rows*
    id (serial/integer), name (varchar), breed (varchar(60)), walkerId (varchar)
 */
const { User, dogDB } = require('./models/models');

/*
 * 2. CREATE GRAPHQL SCHEMA
 */
const typeDefs = gql`
  type Dog {
    id: Int!
    name: String!
    breed: String!
    walker: User
  }

  type User {
    id: ID!
    name: String!
    dogs: [Dog]!
  }

  type Query {
    dogs: [Dog]
    users: [User]
  }

  type Mutation {
    createUser(name: String!): User
    createDog(name: String!, breed: String!, walkerId: String!): Dog
  }
`;

/*
 * 3. CREATE A MAP OF RESOLVERS
 * Tell GraphQL how to use data sources to populate schema fields
 * i.e.
 * When a client queries for a particular field, the resolver mapped to that field
 * fetches the requested data from the appropriate data source.
 */
const resolvers = {
  // Mutation Top-Level Resolver
  Mutation: {
    createUser: async (_, { name }) => {
      // Insert user document into Mongo database
      const user = new User({ name, dogIds: [] });

      try {
        await user.save();
      } catch (e) {
        console.error(e.stack);
      }

      return user;
    },

    createDog: async (_, { name, breed, walkerId }) => {
      // Insert dog row into PostgreSQL database
      const createQuery = `INSERT INTO public.dogs("name", "breed", "walkerId")
                           VALUES($1, $2, $3)
                           RETURNING *`;
      const createQueryParams = [name, breed, walkerId];
      let data = null;
      let dog = null;

      try {
        // Store newly inserted data into `dog`
        data = await dogDB.query(createQuery, createQueryParams);
      } catch (e) {
        console.log('ERROR dogDB.query\n')
        console.error(e);
      }

      // Example `dog` obj: { id: 1, name: 'Ponzu', breed: 'Pomeranian'}
      dog = data.rows[0];

      try {
        // In Mongo,
        //  update the id of the Dog I just inserted into Postgres DB
        //  keep track of all the dog IDs in Postgres, so I can reference them later
        await User.updateOne(
          { _id: new ObjectID(walkerId) },
          {
            $push: { dogIds: dog.id },
          },
        );
      } catch (e) {
        console.log('ERROR User.updateOne\n')
        console.error(e.stack);
      }

      // Don't forget to return from createDog
      return dog;
    },

  },

  // Query Top-Level Resolver
  Query: {
    // users Query resolver
    // Request all users from Mongo data src
    users: () => User.find(),

    // dogs Query resolver
    // Request all dogs from Postgres data src
    dogs: async () => {
      try {
        const dogData = await dogDB.query('SELECT * FROM dogs');
        return dogData.rows;
      } catch (e) {
        console.log('ERROR: dogDB.query for all dogs');
        console.error(e.stack);
      }
      return [];
    },
  },

  // Resolver field for Dog type
  // Find Dog's walker (fetch from wherever you want)
  Dog: {
    walker: (root) => {
      console.log(root);
      return User.findOne({ dogId: root.id });
    },
  },

  // Resolver field for User type
  // Find all User's dogs to walk (fetch from wherever you want)
  User: {
    dogs: async (root) => {
      // If this user has any dogs associated with them
      if (root.dogIds.length) {
        const thisUsersDogIds = JSON.stringify([...root.dogIds]).slice(1, -1);
        const selectQuery = `SELECT * FROM dogs
                             WHERE id IN (${thisUsersDogIds})`;
        const data = await dogDB.query(selectQuery);
        const thisUsersDogs = data.rows;
        return thisUsersDogs;
      }
      // Otherwise return empty array
      return [];
    },
  },
};

/*
 * START APOLLO SERVER (given GraphQL schema and resolvers)
 */
const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
