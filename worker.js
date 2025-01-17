const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const dbClient = require('./utils/db');

// Create Bull queue
const fileQueue = new Bull('fileQueue');

// Process fileQueue
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  // Validate inputs
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  // Fetch file from database
  const file = await dbClient.findFileByIdAndUser(fileId, userId);
  if (!file) throw new Error('File not found');
  if (file.type !== 'image') {
    console.log('Not an image. Skipping...');
    return;
  }

  const filePath = file.localPath;
  const sizes = [500, 250, 100];

  try {
    // Generate thumbnails
    for (const size of sizes) {
      const thumbnail = await imageThumbnail(filePath, { width: size });
      const thumbnailPath = `${filePath}_${size}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
      console.log(`Thumbnail created: ${thumbnailPath}`);
    }
  } catch (error) {
    console.error(`Error generating thumbnails: ${error.message}`);
  }
});

module.exports = { fileQueue };
