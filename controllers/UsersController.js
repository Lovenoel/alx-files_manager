const sha1 = require('sha1');
const dbClient = require('../utils/db');

class UsersController {
  /**
   * POST /users
   * Creates a new user in the database
   */
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Check for missing fields
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      // Check if the email already exists
      const existingUser = await dbClient.db.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash the password
      const hashedPassword = sha1(password);

      // Insert the new user into the database
      const result = await dbClient.db.collection('users').insertOne({
        email,
        password: hashedPassword,
      });

      // Return the new user details
      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
  /**
   * GET /users/me
   * Retrieves the user associated with the token
   */
  static async getMe(req, res) {
    const token = req.headers['x-token'];

    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Retrieve user ID from Redis using the token
      const userId = await redisClient.get(`auth_${token}`);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Retrieve the user details from the database
      const user = await dbClient.db.collection('users').findOne({ _id: userId });

      // Check if the user is found
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return user data (email and id)
      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error('Error retrieving user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
module.exports = UsersController;
