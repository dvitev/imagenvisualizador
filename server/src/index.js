import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';
import rateLimit from 'express-rate-limit';
import basicAuth from 'express-basic-auth';
import http from 'http';
import logger from './utils/logger.js';

import structureRouter from './routes/structure.js';
import imagesRouter from './routes/images.js';
import { scanDirectory } from './imageScanner.js';
import { setupFileWatcher } from './fileWatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const IMAGES_DIR = process.env.IMAGES_DIR;

// --- Startup validations ---
if (!IMAGES_DIR) {
  logger.error('IMAGES_DIR no está definida en el archivo .env');
  logger.error('   Copia .env.example a .env y configura la ruta de tu carpeta de imágenes');
  process.exit(1);
}

if (!existsSync(IMAGES_DIR)) {
  logger.error(`La ruta especificada no existe: ${IMAGES_DIR}`);
  logger.error('   Verifica que la ruta sea correcta y accesible');
  process.exit(1);
}

const stats = statSync(IMAGES_DIR);
if (!stats.isDirectory()) {
  logger.error(`La ruta especificada no es un directorio: ${IMAGES_DIR}`);
  process.exit(1);
}

logger.info(`Ruta de imágenes válida: ${IMAGES_DIR}`);

// --- Security middleware ---
app.use(helmet());

if (process.env.ENABLE_AUTH === 'true' && process.env.AUTH_USER && process.env.AUTH_PASS) {
  app.use(basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
    realm: 'Image Viewer'
  }));
  logger.info('Autenticación básica habilitada');
}

// --- CORS ---
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// --- Rate limiting ---
const limiter = rateLimit({
  windowMs: 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api', limiter);

// --- Routes ---
app.use('/api/structure', structureRouter);
app.use('/api/image', imagesRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    imagesDir: IMAGES_DIR,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/api/ws-info', (req, res) => {
  res.json({
    websocket: 'ws://localhost:' + PORT + '/ws',
    events: ['structure-updated']
  });
});

const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  logger.info('Escaneando directorio de imágenes...');
  
  try {
    const startTime = Date.now();
    await scanDirectory(IMAGES_DIR);
    const scanTime = Date.now() - startTime;
    
    logger.info(`Escaneo completado en ${scanTime}ms`);
    
    // Inicializar file watcher para cambios en tiempo real
    const cleanupWatcher = setupFileWatcher(IMAGES_DIR, server);
    logger.info('File watcher activo — monitoreando cambios en el directorio de imágenes');
    
    server.listen(PORT, HOST, () => {
      logger.info(`Servidor corriendo en http://${HOST}:${PORT}`);
      logger.info(`Imágenes: ${IMAGES_DIR}`);
      logger.info(`Frontend: http://localhost:3000`);
      logger.info(`WebSocket: ws://${HOST}:${PORT}/ws`);
    });
    
    // Limpiar watcher al cerrar
    process.on('SIGTERM', () => {
      logger.info('Señal SIGTERM recibida, cerrando servidor...');
      cleanupWatcher();
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('Señal SIGINT recibida, cerrando servidor...');
      cleanupWatcher();
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error(`Error durante el escaneo: ${error.message}`);
    process.exit(1);
  }
};

startServer();
