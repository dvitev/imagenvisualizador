import { readdir, stat as fsStat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import logger from './utils/logger.js';

const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const ARCHIVE_EXTENSIONS = new Set(['.cbz']);
const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '@ea_dir']);
const EXCLUDED_EXTENSIONS = new Set(['.zip', '.rar', '.cbr', '.exe', '.pdf', '.txt', '.nfo', '.sfv', '.log', '.tmp', '.torrent']);
const EXCLUDED_DIRS = new Set([
  'torrents', '.git', 'node_modules', '.trash', '$recycle.bin', '__macosx',
  '@recycle', '@downloads', '@incomplete', 'incomplete', 'downloads'
]);

const MAX_DEPTH = 15;
const MAX_ITEMS = 50000;

function shouldExcludeDirectory(dirname) {
  const lowerName = dirname.toLowerCase();
  return EXCLUDED_DIRS.has(lowerName) || lowerName.startsWith('.') || lowerName.startsWith('__');
}

function shouldExcludeFile(filename) {
  const lowerName = filename.toLowerCase();
  const ext = path.extname(lowerName);
  return SYSTEM_FILES.has(lowerName) || EXCLUDED_EXTENSIONS.has(ext);
}

function isValidImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VALID_EXTENSIONS.has(ext) && !SYSTEM_FILES.has(filename.toLowerCase());
}

function isValidArchive(filename) {
  return ARCHIVE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

async function scanDirectoryIterative(baseDir) {
  const results = [];
  const queue = [{ path: baseDir, depth: 0 }];
  let itemCount = 0;

  while (queue.length > 0 && itemCount < MAX_ITEMS) {
    const { path: currentDir, depth } = queue.shift();
    if (depth > MAX_DEPTH) continue;

    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      const dirName = path.basename(currentDir);

      if (shouldExcludeDirectory(dirName) && currentDir !== baseDir) continue;

      for (const entry of entries) {
        if (itemCount >= MAX_ITEMS) break;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!shouldExcludeDirectory(entry.name)) {
            queue.push({ path: fullPath, depth: depth + 1 });
          }
        } else if (entry.isFile() && !shouldExcludeFile(entry.name) && (isValidImage(entry.name) || isValidArchive(entry.name))) {
          const relativePath = path.relative(baseDir, fullPath);
          // Normalizar separadores de Windows (\ -> /) para consistencia
          const normalizedPath = relativePath.split(path.sep).join('/');
          results.push({
            folder: path.dirname(normalizedPath) === '.' ? path.basename(baseDir) : path.dirname(normalizedPath),
            fileName: entry.name,
            relativePath: normalizedPath,
            fullPath,
            isArchive: isValidArchive(entry.name)
          });
          itemCount++;
        }
      }
    } catch (error) {
      logger.warn({ dir: currentDir, error: error.message }, 'Error scanning directory');
    }
  }

  if (itemCount >= MAX_ITEMS) {
    logger.warn({ limit: MAX_ITEMS }, 'Limite de items alcanzado');
  }

  results.sort((a, b) => {
    const fc = a.folder.localeCompare(b.folder);
    return fc !== 0 ? fc : a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
  });

  return results;
}

let cachedStructure = null;
let scanPromise = null;
let cachedTree = null;
let lastScanTime = 0;
const CACHE_DURATION = 300000;

export async function getStructure(baseDir) {
  const now = Date.now();
  if (cachedStructure && (now - lastScanTime) < CACHE_DURATION) return cachedStructure;
  if (scanPromise) return scanPromise;

  logger.info({ dir: baseDir }, 'Iniciando escaneo');
  scanPromise = scanDirectoryIterative(baseDir);

  try {
    cachedStructure = await scanPromise;
    lastScanTime = Date.now();
    logger.info({ items: cachedStructure.length }, 'Escaneo completado');
    return cachedStructure;
  } catch (error) {
    scanPromise = null;
    throw error;
  }
}

export async function getStructureWithMetadata(baseDir) {
  const structure = await getStructure(baseDir);
  return structure.map(item => {
    if (item.isArchive) return { ...item, width: 0, height: 0, size: 0 };
    return { ...item, width: null, height: null, size: null };
  });
}

export async function getImagesWithMetadataInRange(baseDir, startIndex, endIndex) {
  const structure = await getStructure(baseDir);
  const slice = structure.slice(startIndex, endIndex + 1);

  return Promise.all(slice.map(async (item) => {
    if (item.isArchive) return { ...item, width: 0, height: 0, size: 0 };
    try {
      const metadata = await sharp(item.fullPath).metadata();
      const stats = await fsStat(item.fullPath);
      return { ...item, width: metadata.width || 0, height: metadata.height || 0, size: stats.size };
    } catch {
      return { ...item, width: 0, height: 0, size: 0 };
    }
  }));
}

export async function scanDirectory(baseDir) {
  const results = await scanDirectoryIterative(baseDir);
  cachedStructure = results;
  cachedTree = null;
  lastScanTime = Date.now();
  return results;
}

export function buildTree(structure) {
  const root = { name: 'root', path: '', type: 'folder', children: [] };
  const nodeMap = new Map();

  structure.forEach((item) => {
    const parts = item.folder.split('/');
    let currentPath = '';
    let parent = root;

    parts.forEach((part) => {
      currentPath = currentPath ? currentPath + '/' + part : part;
      if (!nodeMap.has(currentPath)) {
        const node = { name: part, path: currentPath, type: 'folder', children: [], totalImages: 0 };
        parent.children.push(node);
        nodeMap.set(currentPath, node);
      }
      parent = nodeMap.get(currentPath);
    });

    parent.children.push({
      name: item.fileName,
      path: item.relativePath,
      type: item.isArchive ? 'archive' : 'image',
      totalImages: 1,
      isArchive: item.isArchive
    });
  });

  function countImages(node) {
    if (node.type !== 'folder') return 1;
    node.totalImages = node.children.reduce((sum, child) => sum + countImages(child), 0);
    return node.totalImages;
  }
  if (root.children.length > 0) countImages(root);

  return root;
}

export async function getTree(baseDir) {
  if (cachedTree) return cachedTree;
  const structure = await getStructure(baseDir);
  cachedTree = buildTree(structure);
  return cachedTree;
}

export function invalidateCache() {
  cachedStructure = null;
  cachedTree = null;
  scanPromise = null;
  lastScanTime = 0;
}
