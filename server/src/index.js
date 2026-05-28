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

export default app;

const PORT = process.env.PORT || 3001;
const IMAGES_DIR = process.env.IMAGES_DIR;
const HOST = process.env.HOST || '0.0.0.0';

// --- Startup validations con graceful error ---
let startupError = null;
if (!IMAGES_DIR) {
  startupError = 'IMAGES_DIR no está definida en el archivo .env';
} else if (!existsSync(IMAGES_DIR)) {
  startupError = `La ruta especificada no existe: ${IMAGES_DIR}`;
} else if (!statSync(IMAGES_DIR).isDirectory()) {
  startupError = `La ruta especificada no es un directorio: ${IMAGES_DIR}`;
}

// Registrar middleware y rutas SIEMPRE (también en tests), no solo al arrancar
if (!startupError) {
  app.use(helmet());

  // C4: Rechazar arranque si auth está activada con password por defecto
  if (process.env.ENABLE_AUTH === 'true' && process.env.AUTH_PASS === 'changeme') {
    logger.fatal(
      'SECURITY VIOLATION: ENABLE_AUTH is true but AUTH_PASS is still "changeme". '
      + 'Change AUTH_PASS to a strong password before enabling authentication.'
    );
    process.exit(1);
  }

  if (process.env.ENABLE_AUTH === 'true' && process.env.AUTH_USER && process.env.AUTH_PASS) {
    app.use(basicAuth({
      users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
      challenge: true,
      realm: 'Image Viewer'
    }));
    logger.info('Autenticación básica habilitada');
  }

  app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET'],
    allowedHeaders: ['Content-Type']
  }));

  app.use(express.json());

  const strictLimiter = rateLimit({ windowMs: 1000, max: 10, message: { error: 'Too many requests' } });
  const defaultLimiter = rateLimit({ windowMs: 1000, max: 50, message: { error: 'Too many requests' } });

  app.use('/api/health', strictLimiter);
  app.use('/api', defaultLimiter);

  // --- Routes ---
  app.use('/api/structure', structureRouter);
  app.use('/api/image', imagesRouter);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
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
}

// Solo arrancar el servidor si se ejecuta directamente (no al importar para tests)
if (!process.env.VITEST) {
  if (startupError) {
    logger.error(startupError);

    app.get('*', (req, res) => {
      res.status(503).json({
        error: 'Servicio no disponible',
        message: startupError,
        hint: 'Revisa el archivo .env y la configuración de IMAGES_DIR'
      });
    });

    server.listen(PORT, HOST, () => {
      logger.info(`Servidor en modo ERROR en http://${HOST}:${PORT}`);
      logger.info('Corrige IMAGES_DIR en .env y reinicia');
    });
  } else {
    logger.info(`Ruta de imágenes válida: ${IMAGES_DIR}`);

    const startServer = async () => {
      logger.info('Escaneando directorio de imágenes...');

      try {
        const startTime = Date.now();
        await scanDirectory(IMAGES_DIR);
        const scanTime = Date.now() - startTime;
        logger.info(`Escaneo completado en ${scanTime}ms`);

        const cleanupWatcher = setupFileWatcher(IMAGES_DIR, server);
        logger.info('File watcher activo — monitoreando cambios');

        server.listen(PORT, HOST, () => {
          logger.info(`Servidor corriendo en http://${HOST}:${PORT}`);
          logger.info(`Frontend: http://localhost:3000`);
          logger.info(`WebSocket: ws://${HOST}:${PORT}/ws`);
        });

        // Graceful shutdown
        const shutdown = (signal) => {
          logger.info(`Señal ${signal} recibida, cerrando servidor...`);
          cleanupWatcher();
          server.close(() => {
            logger.info('Servidor cerrado');
            process.exit(0);
          });
          setTimeout(() => process.exit(1), 5000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

      } catch (error) {
        logger.error({ error: error.message }, 'Error durante el escaneo');

        app.get('*', (req, res) => {
          res.status(503).json({
            error: 'Error de escaneo',
            message: error.message
          });
        });

        server.listen(PORT, HOST, () => {
          logger.info(`Servidor en modo ERROR en http://${HOST}:${PORT}`);
        });
      }
    };

    startServer();
  }
}
