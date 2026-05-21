import { Router } from 'express';
import { getStructure } from '../imageScanner.js';

const router = Router();

const folderCache = new Map();
const CACHE_DURATION = 60000;

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
        acc[item.folder] = {
          folder: item.folder,
          images: []
        };
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
    res.json(result);
  } catch (error) {
    console.error('Error en /api/structure:', error);
    res.status(500).json({ error: 'Failed to scan directory', message: error.message });
  }
});

router.get('/flat', async (req, res) => {
  try {
    const structure = await getStructure(process.env.IMAGES_DIR);
    
    const result = structure.map(item => ({
      folder: item.folder,
      fileName: item.fileName,
      relativePath: item.relativePath,
      isArchive: item.isArchive
    }));
    
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(result);
  } catch (error) {
    console.error('Error en /api/structure/flat:', error);
    res.status(500).json({ error: 'Failed to scan directory', message: error.message });
  }
});

router.get('/tree', async (req, res) => {
  try {
    const cached = folderCache.get('tree');
    if (cached && (Date.now() - cached.time) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    
    const { buildTree } = await import('../imageScanner.js');
    const structure = await getStructure(process.env.IMAGES_DIR);
    const tree = buildTree(structure);
    
    folderCache.set('tree', { data: tree, time: Date.now() });
    
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Cache', 'MISS');
    res.json(tree);
  } catch (error) {
    console.error('Error en /api/structure/tree:', error);
    res.status(500).json({ error: 'Failed to build tree', message: error.message });
  }
});

export default router;
