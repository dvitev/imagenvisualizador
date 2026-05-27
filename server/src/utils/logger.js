import pino from 'pino';

// Usar pino-pretty en desarrollo O cuando se ejecuta en terminal interactiva
const usePretty = process.env.NODE_ENV !== 'production' || process.stdout.isTTY;

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(usePretty ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    }
  } : {})
});

export default logger;
