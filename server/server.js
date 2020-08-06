const { ApolloServer, gql } = require('apollo-server');
const { ObjectID } = require('mongodb');

/*
 * Scenario:
 * I have a dog walking web app.
 * I'm storing Users in MongoDB and Dogs in PostgreSQL
 *
 * tl;dr
 * To mix data sources, just resolve fields by requesting data from different places.
 */

/*
 * First,
 * Grab mongoose `User` model containing logic to query *User documents*
   -_id (ObjectId), name (String), dogIds (Number Array)
 * and Postgres `dogDB` model containing logic to query *Dog data rows*
   - id (serial/integer), name (varchar), breed (varchar(60)), walkerId (varchar)
 */
const { User, dogDB } = require('./models/models');

// User item will come from Mongo database

// Dog name and breed will come from postgres db but
// User dogId will come from Mongo database

// We can resolve fields individually in GraphQL,
// so doesn't matter what a field's data source is
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

const resolvers = {
  // How we actually create users and dogs
  Mutation: {
    // Insert user document into Mongo database
    createUser: async (_, { name }) => {
      const user = new User({ name, dogIds: [] });

      try {
        await user.save();
      } catch (e) {
        console.error(e.stack);
      }

      // Don't forget to return user!
      return user;
    },

    // Insert dog row into PostgreSQL database
    createDog: async (_, { name, breed, walkerId }) => {
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
        // Update in Mongo the id of the Dog I just inserted into Postgres DB
        // Keep track in Mongo all the IDs in Postgres, so I can reference them later
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

  }, // end of Mutation resolver

  // Resolver field for general Querying
  Query: {
    // Request all users from Mongo data src
    users: () => User.find(),
    // Request all dogs from Postgres data src
    dogs: async () => {
      try {
        const dogData = await dogDB.query('SELECT * FROM dogs');
        return dogData.rows;
      } catch (e) {
        console.log('ERROR: dogDB.query for all dogs')
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

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
