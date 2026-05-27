import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { stat } from 'fs/promises';
import sharp from 'sharp';
import unzipper from 'unzipper';
import { sanitizePath } from '../utils/pathSanitizer.js';
import logger from '../utils/logger.js';

const router = Router();

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const BASE_DIR = process.env.IMAGES_DIR;

// ⚠️ Las rutas específicas deben declararse ANTES que la genérica '/*'
// sino Express nunca las alcanza (el wildcard '/*' captura todo)

router.get('/thumb/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    if (!requestedPath) return res.status(400).json({ error: 'Path required' });

    const fullPath = sanitizePath(requestedPath, BASE_DIR);
    if (!fullPath) {
      logger.warn({ path: requestedPath }, 'Blocked thumbnail path traversal attempt');
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'Image not found' });

    const stats = await stat(fullPath);
    if (!stats.isFile()) return res.status(400).json({ error: 'Not a file' });

    const ext = path.extname(fullPath).toLowerCase();

    try {
      const thumbnail = await sharp(fullPath)
        .resize(300, null, { fit: 'inside', withoutEnlargement: true })
        .toFormat(ext === '.png' ? 'png' : 'webp')
        .toBuffer();

      const outputExt = ext === '.png' ? '.png' : '.webp';
      res.setHeader('Content-Type', MIME_TYPES[outputExt] || 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Content-Length', thumbnail.length);
      res.send(thumbnail);
    } catch (sharpError) {
      logger.warn({ path: fullPath, error: sharpError.message }, 'Thumbnail fallback to original');

      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileStats = await stat(fullPath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      createReadStream(fullPath).pipe(res);
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/thumb');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    else res.end();
  }
});

router.get('/archive/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    const page = parseInt(req.query.page) || 0;

    if (!requestedPath) return res.status(400).json({ error: 'Path required' });

    const fullPath = sanitizePath(requestedPath, BASE_DIR);
    if (!fullPath) {
      logger.warn({ path: requestedPath }, 'Blocked archive path traversal attempt');
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'Archive not found' });

    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.cbz' && ext !== '.zip') return res.status(400).json({ error: 'Not an archive file' });

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const pages = [];
    const directory = await unzipper.Open.file(fullPath);

    directory.files
      .filter(file => {
        const normalizedEntryPath = path.normalize(file.path);
        if (normalizedEntryPath.includes('..') || path.isAbsolute(normalizedEntryPath)) {
          logger.warn({ entry: file.path }, 'Blocked zip-slip in archive');
          return false;
        }
        if (/[\x00-\x1f]/.test(file.path)) {
          logger.warn({ entry: file.path }, 'Blocked control char in archive entry');
          return false;
        }
        return imageExtensions.includes(path.extname(file.path).toLowerCase());
      })
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
      .forEach((file, index) => pages.push({ index, file }));

    if (page < 0 || page >= pages.length) return res.status(404).json({ error: 'Page not found' });

    const pageFile = pages[page].file;
    const pageExt = path.extname(pageFile.path).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[pageExt] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Archive-Page', page);
    res.setHeader('X-Total-Pages', pages.length);
    pageFile.stream().pipe(res);
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/archive');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    else res.end();
  }
});

router.get('/metadata/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    if (!requestedPath) return res.status(400).json({ error: 'Path required' });

    const fullPath = sanitizePath(requestedPath, BASE_DIR);
    if (!fullPath) {
      logger.warn({ path: requestedPath }, 'Blocked metadata path traversal attempt');
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'Image not found' });

    const stats = await stat(fullPath);
    if (!stats.isFile()) return res.status(400).json({ error: 'Not a file' });

    const metadata = await sharp(fullPath).metadata();
    res.json({
      path: requestedPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: stats.size,
      format: metadata.format
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/metadata');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    else res.end();
  }
});

router.get('/*', async (req, res) => {
  try {
    const requestedPath = req.params[0];
    if (!requestedPath) return res.status(400).json({ error: 'Path required' });

    const fullPath = sanitizePath(requestedPath, BASE_DIR);
    if (!fullPath) {
      logger.warn({ path: requestedPath }, 'Blocked path traversal attempt');
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'Image not found' });

    const stats = await stat(fullPath);
    if (!stats.isFile()) return res.status(400).json({ error: 'Not a file' });

    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const fileStream = createReadStream(fullPath, { highWaterMark: 64 * 1024 });
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error({ error: error.message }, 'Stream error');
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
      res.end();
    });

    res.on('error', () => fileStream.destroy());
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/image');
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
