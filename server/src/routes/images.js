import { Router } from 'express';
import { createReadStream, existsSync, readFileSync } from 'fs';
import path from 'path';
import { stat } from 'fs/promises';
import sharp from 'sharp';
import unzipper from 'unzipper';

const router = Router();

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const BASE_DIR = process.env.IMAGES_DIR;

function sanitizePath(requestedPath) {
  try {
    const decodedPath = decodeURIComponent(requestedPath);
    const normalizedPath = decodedPath.replace(/\\/g, '/');
    
    if (normalizedPath.includes('..')) {
      console.log(`🚫 Blocked: contains '..' - ${normalizedPath}`);
      return null;
    }
    
    const parts = normalizedPath.split('/').filter(p => p.length > 0);
    const fullPath = path.join(BASE_DIR, ...parts);
    
    console.log(`🔍 BASE_DIR: ${BASE_DIR}`);
    console.log(`🔍 parts: ${JSON.stringify(parts)}`);
    console.log(`🔍 fullPath: ${fullPath}`);
    
    if (!existsSync(fullPath)) {
      console.log(`❌ File does not exist: ${fullPath}`);
      return null;
    }
    
    console.log(`✓ Found: ${fullPath}`);
    return fullPath;
  } catch (error) {
    console.error(`Error sanitizing path "${requestedPath}":`, error.message);
    return null;
  }
}

router.get('/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    
    if (!requestedPath) {
      return res.status(400).json({ error: 'Path required' });
    }
    
    const sanitizedPath = sanitizePath(requestedPath);
    
    if (!sanitizedPath) {
      console.warn(`🚫 Path traversal blocked: ${requestedPath}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!existsSync(sanitizedPath)) {
      console.error(`❌ File not found: ${sanitizedPath}`);
      return res.status(404).json({ error: 'Image not found', path: sanitizedPath });
    }
    
    const stats = await stat(sanitizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }
    
    const ext = path.extname(sanitizedPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const fileStream = createReadStream(sanitizedPath, { highWaterMark: 64 * 1024 });
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
    
    const sanitizedPath = sanitizePath(requestedPath);
    
    if (!sanitizedPath) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!existsSync(sanitizedPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const stats = await stat(sanitizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }
    
    const ext = path.extname(sanitizedPath).toLowerCase();
    
    try {
      const thumbnail = await sharp(sanitizedPath)
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
      
      const stream = createReadStream(sanitizedPath);
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
    
    const sanitizedPath = sanitizePath(requestedPath);
    
    if (!sanitizedPath) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!existsSync(sanitizedPath)) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    
    const ext = path.extname(sanitizedPath).toLowerCase();
    if (ext !== '.cbz' && ext !== '.zip') {
      return res.status(400).json({ error: 'Not an archive file' });
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    const pages = [];
    
    const directory = await unzipper.Open.file(sanitizedPath);
    
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
    
    const sanitizedPath = sanitizePath(requestedPath);
    
    if (!sanitizedPath) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!existsSync(sanitizedPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const stats = await stat(sanitizedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Not a file' });
    }
    
    const metadata = await sharp(sanitizedPath).metadata();
    
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
