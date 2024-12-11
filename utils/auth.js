const dbClient = require('./db');

class UserAuth {
  static async getUserFromToken(token) {
    return dbClient.users.findOne({ token });
  }
}

module.exports = UserAuth;
