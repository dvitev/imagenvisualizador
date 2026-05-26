import { readdir, stat as fsStat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import logger from './utils/logger.js';

const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const ARCHIVE_EXTENSIONS = new Set(['.cbz']);
const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '@ea_dir']);
const EXCLUDED_EXTENSIONS = new Set(['.zip', '.rar', '.cbr', '.exe', '.pdf', '.txt', '.nfo', '.sfv', '.log', '.tmp', '.torrent']);
const EXCLUDED_DIRS = new Set([
  'torrents', 
  '.git', 
  'node_modules', 
  '.trash', 
  '$recycle.bin', 
  '__macosx', 
  '@recycle',
  '@downloads',
  '@incomplete',
  'incomplete',
  'downloads'
]);

const MAX_DEPTH = 15;
const MAX_ITEMS = 50000;

function shouldExcludeDirectory(dirname) {
  const lowerName = dirname.toLowerCase();
  return EXCLUDED_DIRS.has(lowerName) || 
         lowerName.startsWith('.') || 
         lowerName.startsWith('__');
}

function shouldExcludeFile(filename) {
  const lowerName = filename.toLowerCase();
  const ext = path.extname(lowerName);
  
  if (SYSTEM_FILES.has(lowerName)) return true;
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  
  return false;
}

function isValidImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VALID_EXTENSIONS.has(ext) && !SYSTEM_FILES.has(filename.toLowerCase());
}

function isValidArchive(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ARCHIVE_EXTENSIONS.has(ext);
}

async function scanDirectoryIterative(baseDir) {
  const results = [];
  const queue = [{ path: baseDir, depth: 0 }];
  let itemCount = 0;
  
  while (queue.length > 0 && itemCount < MAX_ITEMS) {
    const { path: currentDir, depth } = queue.shift();
    
    if (depth > MAX_DEPTH) {
      continue;
    }
    
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      const dirName = path.basename(currentDir);
      
      if (shouldExcludeDirectory(dirName) && currentDir !== baseDir) {
        continue;
      }
      
      for (const entry of entries) {
        if (itemCount >= MAX_ITEMS) break;
        
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          if (!shouldExcludeDirectory(entry.name)) {
            queue.push({ path: fullPath, depth: depth + 1 });
          }
        } else if (entry.isFile()) {
          if (shouldExcludeFile(entry.name)) {
            continue;
          }
          
          if (isValidImage(entry.name) || isValidArchive(entry.name)) {
            const relativePath = path.relative(baseDir, fullPath);
            const folder = path.dirname(relativePath);
            
            results.push({
              folder: folder === '.' ? path.basename(baseDir) : folder,
              fileName: entry.name,
              relativePath: relativePath.replace(/\\/g, '/'),
              fullPath: fullPath,
              isArchive: isValidArchive(entry.name)
            });
            
            itemCount++;
          }
        }
      }
    } catch (error) {
      logger.warn({ dir: currentDir, error: error.message }, 'Error scanning directory');
    }
  }
  
  if (itemCount >= MAX_ITEMS) {
    logger.warn({ limit: MAX_ITEMS }, 'Limite de items alcanzado. Algunos archivos no fueron incluidos.');
  }
  
  results.sort((a, b) => {
    const folderCompare = a.folder.localeCompare(b.folder);
    if (folderCompare !== 0) return folderCompare;
    return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' });
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
  
  if (cachedStructure && (now - lastScanTime) < CACHE_DURATION) {
    return cachedStructure;
  }
  
  if (scanPromise) {
    return scanPromise;
  }
  
  logger.info({ dir: baseDir }, 'Iniciando escaneo de directorio');
  const startTime = now;
  
  scanPromise = scanDirectoryIterative(baseDir);
  
  try {
    cachedStructure = await scanPromise;
    const scanTime = Date.now() - startTime;
    logger.info({ scanTime, items: cachedStructure.length }, 'Escaneo completado');
    lastScanTime = now;
    return cachedStructure;
  } catch (error) {
    scanPromise = null;
    throw error;
  }
}

export async function getStructureWithMetadata(baseDir) {
  const structure = await getStructure(baseDir);
  
  const withMetadata = await Promise.all(
    structure.map(async (item) => {
      if (item.isArchive) {
        return {
          ...item,
          width: 0,
          height: 0,
          size: 0
        };
      }
      const metadata = await getImageMetadata(item.fullPath);
      return {
        ...item,
        ...metadata
      };
    })
  );
  
  return withMetadata;
}

export async function getImagesWithMetadataInRange(baseDir, startIndex, endIndex) {
  const structure = await getStructure(baseDir);
  const slice = structure.slice(startIndex, endIndex + 1);
  
  const withMetadata = await Promise.all(
    slice.map(async (item) => {
      if (item.isArchive) {
        return { ...item, width: 0, height: 0, size: 0 };
      }
      const metadata = await getImageMetadata(item.fullPath);
      return { ...item, ...metadata };
    })
  );
  
  return withMetadata;
}

async function getImageMetadata(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    const stats = await fsStat(filePath);
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: stats.size
    };
  } catch (error) {
    return { width: 0, height: 0, size: 0 };
  }
}

export async function scanDirectory(baseDir) {
  const results = await scanDirectoryIterative(baseDir);
  cachedStructure = results;
  cachedTree = null;
  lastScanTime = Date.now();
  return results;
}

export function buildTree(structure) {
  const root = { name: 'root', path: '', type: 'folder', children: [], totalImages: 0 };
  
  structure.forEach((item) => {
    const parts = item.folder.split('/');
    let current = root;
    
    parts.forEach((part, index) => {
      const pathSoFar = parts.slice(0, index + 1).join('/');
      let child = current.children.find(c => c.name === part && c.type === 'folder');
      
      if (!child) {
        child = {
          name: part,
          path: pathSoFar,
          type: 'folder',
          children: [],
          totalImages: 0
        };
        current.children.push(child);
      }
      
      current = child;
    });
    
    if (item.isArchive) {
      current.children.push({
        name: item.fileName,
        path: item.relativePath,
        type: 'archive',
        totalImages: 1
      });
      current.totalImages += 1;
    } else {
      current.children.push({
        name: item.fileName,
        path: item.relativePath,
        type: 'image',
        totalImages: 1
      });
      current.totalImages += 1;
    }
    
    let parent = current;
    let ancestor = root;
    while (ancestor !== parent) {
      ancestor.totalImages += 1;
      const nextAncestor = ancestor.children.find(c => c.path === parent.path);
      if (!nextAncestor) break;
      ancestor = nextAncestor;
    }
  });
  
  return root;
}

export async function getTree(baseDir) {
  if (cachedTree) {
    return cachedTree;
  }
  
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
