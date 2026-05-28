import { Router } from 'express';
import { getStructure, buildTree, isTruncated, getScanStats } from '../imageScanner.js';
import logger from '../utils/logger.js';

const router = Router();

const folderCache = new Map();
const CACHE_DURATION = 60000;
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 2000;

router.get('/stats', (req, res) => {
  res.json(getScanStats());
});

router.get('/', async (req, res) => {
  try {
    const cached = folderCache.get('structure');
    if (cached && (Date.now() - cached.time) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    const structure = await getStructure(process.env.IMAGES_DIR);

    const groupedStructure = structure.reduce((acc, item) => {
      if (!acc[item.folder]) {
        acc[item.folder] = { folder: item.folder, images: [] };
      }
      acc[item.folder].images.push({
        fileName: item.fileName,
        relativePath: item.relativePath,
        isArchive: item.isArchive
      });
      return acc;
    }, {});

    const result = Object.values(groupedStructure);
    folderCache.set('structure', { data: result, time: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Total-Folders', result.length);
    if (isTruncated()) res.setHeader('X-Truncated', 'true');
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/structure');
    res.status(500).json({ error: 'Failed to scan directory' });
  }
});

router.get('/flat', async (req, res) => {
  try {
    const structure = await getStructure(process.env.IMAGES_DIR);
    const total = structure.length;

    let page = Math.max(0, parseInt(req.query.page) || 0);
    let limit = parseInt(req.query.limit) || DEFAULT_PAGE_SIZE;

    // Techo duro: rechazar si el tamaño solicitado supera el máximo
    if (limit > MAX_PAGE_SIZE) {
      return res.status(400).json({
        error: 'Page size too large',
        message: 'Maximum page size is ' + MAX_PAGE_SIZE,
        requested: limit,
        maxAllowed: MAX_PAGE_SIZE
      });
    }

    // Forzar límite a DEFAULT_PAGE_SIZE
    limit = Math.min(limit, DEFAULT_PAGE_SIZE);

    // M3: Forzar paginación — usar ?nopaginate=true para el array completo
    if (req.query.nopaginate === 'true') {
      const result = structure.map(item => ({
        folder: item.folder,
        fileName: item.fileName,
        relativePath: item.relativePath,
        isArchive: item.isArchive
      }));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('X-Total-Items', total);
      return res.json(result);
    }

    const start = page * limit;
    const end = start + limit;
    const paginated = structure.slice(start, end).map(item => ({
      folder: item.folder,
      fileName: item.fileName,
      relativePath: item.relativePath,
      isArchive: item.isArchive
    }));

    res.setHeader('X-Total-Items', total);
    res.setHeader('X-Page', page);
    res.setHeader('X-Page-Size', limit);
    if (isTruncated()) res.setHeader('X-Truncated', 'true');
    res.json(paginated);
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/structure/flat');
    res.status(500).json({ error: 'Failed to scan directory' });
  }
});

router.get('/tree', async (req, res) => {
  try {
    const cached = folderCache.get('tree');
    if (cached && (Date.now() - cached.time) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    const structure = await getStructure(process.env.IMAGES_DIR);
    const tree = buildTree(structure);

    folderCache.set('tree', { data: tree, time: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Total-Items', structure.length);
    if (isTruncated()) res.setHeader('X-Truncated', 'true');
    res.json(tree);
  } catch (error) {
    logger.error({ error: error.message }, 'Error en /api/structure/tree');
    res.status(500).json({ error: 'Failed to build tree' });
  }
});

export default router;
