import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { stat } from 'fs/promises';
import sharp from 'sharp';
import unzipper from 'unzipper';
import { sanitizePath } from '../utils/pathSanitizer.js';

const router = Router();

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const BASE_DIR = process.env.IMAGES_DIR;

router.get('/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];

    if (!requestedPath) {
      return res.status(400).json({ error: 'Path required' });
    }

    const fullPath = sanitizePath(requestedPath, BASE_DIR);

    if (!fullPath) {
      console.warn(`Blocked path traversal attempt: ${requestedPath}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const fileStream = createReadStream(fullPath, { highWaterMark: 64 * 1024 });
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Stream error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
      res.end();
    });

    res.on('error', (error) => {
      console.error('Response error:', error.message);
      fileStream.destroy();
    });

  } catch (error) {
    console.error('Error en /api/image:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

router.get('/thumb/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];

    if (!requestedPath) {
      return res.status(400).json({ error: 'Path required' });
    }

    const fullPath = sanitizePath(requestedPath, BASE_DIR);

    if (!fullPath) {
      console.warn(`Blocked thumbnail path traversal attempt: ${requestedPath}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }

    const ext = path.extname(fullPath).toLowerCase();

    try {
      const thumbnail = await sharp(fullPath)
        .resize(300, null, { fit: 'inside', withoutEnlargement: true })
        .toFormat(ext === '.png' ? 'png' : 'webp')
        .toBuffer();

      const outputExt = ext === '.png' ? '.png' : '.webp';
      const outputMimeType = MIME_TYPES[outputExt] || 'image/webp';

      res.setHeader('Content-Type', outputMimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Content-Length', thumbnail.length);

      res.send(thumbnail);
    } catch (sharpError) {
      console.error('Error processing thumbnail:', sharpError.message);

      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800');

      const stream = createReadStream(fullPath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Error en /api/thumb:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    } else {
      res.end();
    }
  }
});

router.get('/archive/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    const page = parseInt(req.query.page) || 0;

    if (!requestedPath) {
      return res.status(400).json({ error: 'Path required' });
    }

    const fullPath = sanitizePath(requestedPath, BASE_DIR);

    if (!fullPath) {
      console.warn(`Blocked archive path traversal attempt: ${requestedPath}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.cbz' && ext !== '.zip') {
      return res.status(400).json({ error: 'Not an archive file' });
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    const pages = [];

    const directory = await unzipper.Open.file(fullPath);

    directory.files
      .filter(file => {
        const fileExt = path.extname(file.path).toLowerCase();
        return imageExtensions.includes(fileExt);
      })
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
      .forEach((file, index) => {
        pages.push({
          index,
          file
        });
      });

    if (page < 0 || page >= pages.length) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageFile = pages[page].file;
    const pageExt = path.extname(pageFile.path).toLowerCase();
    const mimeType = MIME_TYPES[pageExt] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Archive-Page', page);
    res.setHeader('X-Total-Pages', pages.length);

    const stream = pageFile.stream();
    stream.pipe(res);

  } catch (error) {
    console.error('Error en /api/archive:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    } else {
      res.end();
    }
  }
});

router.get('/metadata/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];

    if (!requestedPath) {
      return res.status(400).json({ error: 'Path required' });
    }

    const fullPath = sanitizePath(requestedPath, BASE_DIR);

    if (!fullPath) {
      console.warn(`Blocked metadata path traversal attempt: ${requestedPath}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }

    const metadata = await sharp(fullPath).metadata();

    res.json({
      path: requestedPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: stats.size,
      format: metadata.format
    });

  } catch (error) {
    console.error('Error en /api/metadata:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    } else {
      res.end();
    }
  }
});

export default router;
