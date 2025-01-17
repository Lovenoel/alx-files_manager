const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const dbClient = require('../utils/db');
const User = require('../models/User');
const File = require('../models/File');
const id = parseInt(req.params.id, 10);  // Adding the radix 10

// Retrieve environment variable for file storage folder
const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  /**
   * POST /files
   * Handles the file upload and storage in the database and disk
   */
  static async postUpload(req, res) {
    const {
      name, type, data, parentId = 0, isPublic = false,
    } = req.body;
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

  static async getShow(req, res) {
    try {
      const user = await User.findOne({ token: req.headers['x-token'] });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      const file = await File.findOne({ _id: fileId, userId: user._id });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async getIndex(req, res) {
    try {
      const user = await User.findOne({ token: req.headers['x-token'] });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = req.query.parentId || 0; // Default to root
      const page = parseInt(req.query.page) || 0; // Default to first page

      // Set the number of items per page
      const limit = 20;
      const skip = page * limit;

      const files = await File.find({ userId: user._id, parentId })
        .skip(skip)
        .limit(limit);

      return res.status(200).json(files);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = FilesController;
