const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const dbClient = require('../utils/db');

// Retrieve environment variable for file storage folder
const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  /**
   * POST /files
   * Handles the file upload and storage in the database and disk
   */
  static async postUpload(req, res) {
    const { name, type, data, parentId = 0, isPublic = false } = req.body;
    const userId = req.headers['x-token']; // Assuming user token is in the headers

    // Validate the token and user
    const user = await dbClient.db.collection('users').findOne({ token: userId });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check for missing fields
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Validate parentId for folders
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // If type is folder, no need to store a file, just create a record in DB
    if (type === 'folder') {
      const newFolder = {
        userId: user._id,
        name,
        type,
        parentId,
        isPublic,
      };
      const result = await dbClient.db.collection('files').insertOne(newFolder);
      return res.status(201).json(result.ops[0]);
    }

    // For files and images, generate a local path and store the file
    const fileId = uuidv4();
    const localFilePath = path.join(folderPath, fileId);
    const fileBuffer = Buffer.from(data, 'base64');
    fs.writeFileSync(localFilePath, fileBuffer);

    const newFile = {
      userId: user._id,
      name,
      type,
      parentId,
      isPublic,
      localPath: localFilePath,
    };

    const result = await dbClient.db.collection('files').insertOne(newFile);
    return res.status(201).json(result.ops[0]);
  }
}

module.exports = FilesController;
