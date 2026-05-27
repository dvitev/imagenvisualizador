import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import { invalidateCache } from './imageScanner.js';
import logger from './utils/logger.js';

let wss = null;
let watcher = null;
const MAX_WS_CLIENTS = 50;

export function setupFileWatcher(baseDir, server) {
  const clients = new Set();

  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    if (clients.size >= MAX_WS_CLIENTS) {
      ws.close(1013, 'Too many connections');
      logger.warn('WebSocket connection rejected — max clients reached');
      return;
    }

    clients.add(ws);
    logger.debug('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      logger.debug('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error({ error: error.message }, 'WebSocket error');
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
      /(^|[\/\\])([Tt][Oo][Rr][Rr][Ee][Nn][Tt][Ss])([\/\\]|$)/,
      /\.(zip|cbz|rar|cbr|exe|pdf|txt|nfo|sfv|log|tmp|torrent)$/
    ],
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500
    },
    depth: 10
  });

  // M4: Solo invalidar cache, NO re-escanear con Sharp
  // El escaneo completo se hace cuando un cliente pide /api/structure
  const debouncedInvalidate = debounce(() => {
    logger.info('Cambios detectados, invalidando cache...');
    invalidateCache();

    const message = JSON.stringify({
      type: 'structure-updated',
      timestamp: Date.now()
    });

    clients.forEach((client) => {
      if (client.readyState === 1) client.send(message);
    });

    logger.info('Cache invalidada — clientes notificados vía WebSocket');
  }, 1000);

  watcher
    .on('add', (filePath) => { logger.debug({ file: filePath }, 'Archivo añadido'); debouncedInvalidate(); })
    .on('unlink', (filePath) => { logger.debug({ file: filePath }, 'Archivo eliminado'); debouncedInvalidate(); })
    .on('addDir', (dirPath) => { logger.debug({ dir: dirPath }, 'Carpeta añadida'); debouncedInvalidate(); })
    .on('unlinkDir', (dirPath) => { logger.debug({ dir: dirPath }, 'Carpeta eliminada'); debouncedInvalidate(); })
    .on('error', (error) => { logger.error({ error: error.message }, 'Error en file watcher'); });

  logger.info('File watcher inicializado');

  return () => {
    if (watcher) watcher.close();
    if (wss) wss.clients.forEach(client => client.close());
    logger.info('File watcher detenido');
  };
}

export function broadcastMessage(message) {
  if (!wss) return;
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(messageStr);
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
