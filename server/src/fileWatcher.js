import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import { invalidateCache } from './imageScanner.js';

let wss = null;
let watcher = null;

export function setupFileWatcher(baseDir, server) {
  const clients = new Set();
  
  wss = new WebSocketServer({ noServer: true });
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔌 WebSocket client connected');
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('🔌 WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  watcher = chokidar.watch(baseDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../,
      /(^|[\/\\])torrents/,
      /\.zip$/,
      /\.cbz$/,
      /\.rar$/,
      /\.cbr$/,
      /\.exe$/,
      /\.pdf$/,
      /\.txt$/,
      /\.nfo$/,
      /\.sfv$/,
      /\.log$/,
      /\.tmp$/,
      /\.torrent$/
    ],
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500
    },
    depth: 10
  });
  
  const debouncedScan = debounce(async () => {
    console.log('📁 Cambios detectados, re-escaneando...');
    invalidateCache();
    
    try {
      const { getStructureWithMetadata } = await import('./imageScanner.js');
      const structure = await getStructureWithMetadata(baseDir);
      
      const message = JSON.stringify({
        type: 'structure-updated',
        timestamp: Date.now(),
        totalItems: structure.length
      });
      
      clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
      
      console.log(`✅ Estructura actualizada: ${structure.length} elementos`);
    } catch (error) {
      console.error('❌ Error re-escaneando:', error.message);
    }
  }, 1000);
  
  watcher
    .on('add', (path) => {
      console.log(`📄 Archivo añadido: ${path}`);
      debouncedScan();
    })
    .on('unlink', (path) => {
      console.log(`🗑️ Archivo eliminado: ${path}`);
      debouncedScan();
    })
    .on('addDir', (path) => {
      console.log(`📁 Carpeta añadida: ${path}`);
      debouncedScan();
    })
    .on('unlinkDir', (path) => {
      console.log(`🗑️ Carpeta eliminada: ${path}`);
      debouncedScan();
    })
    .on('error', (error) => {
      console.error('❌ Error en file watcher:', error);
    });
  
  console.log('👁️ File watcher inicializado');
  
  return () => {
    if (watcher) {
      watcher.close();
    }
    if (wss) {
      wss.clients.forEach(client => client.close());
    }
  };
}

export function broadcastMessage(message) {
  if (!wss) return;
  
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(messageStr);
    }
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
