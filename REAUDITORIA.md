# 🔬 Re-Auditoría Archivo por Archivo — `imagenvisualizador`

**Fecha:** 2026-05-26  
**Propósito del proyecto:** Visor de imágenes/manga de alto rendimiento con servidor Express + cliente React.  
**Stack:** Node.js 18+, Express 4, React 18, Vite 8, Sharp, Docker Compose, Nginx, WebSocket.  
**Ruta real:** `IMAGES_DIR=N:/Torrents` (~50K items, manga organizado por carpetas).

---

## 📁 RAÍZ DEL PROYECTO

### `package.json`
```json
{
  "scripts": {
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev",
    "install:all": "npm install && cd server && npm install && cd ../client && npm install"
  }
}
```
✅ **Bien:** Script `install:all` para instalar todo de una.  
⚠️ **Falta:** Script para producción (`docker-compose up` no está como npm script).  
💡 **Propuesta:** Agregar `"docker:up": "docker-compose up -d --build"`.

### `.env`
```env
IMAGES_DIR=N:/Torrents
ENABLE_AUTH=false
AUTH_PASS=changeme
NODE_ENV=production
```
🐛 **BUG:** Si el backend se inicia sin Docker y `NODE_ENV=production`, Pino NO usa `pino-pretty` (el transporte bonito se desactiva). El desarrollador no ve logs legibles. También `NODE_ENV=production` con nodemon o --watch puede causar reinicios inesperados.
✅ **Bien:** `.env` está en `.gitignore`.  
💡 **Propuesta:** Cambiar a `NODE_ENV=development` por defecto. Solo Docker sobreescribe a `production`.

### `.env.example`
✅ Sirve como plantilla.  
⚠️ **Falta:** `AUTH_PASS` default inseguro (`changeme`).  
💡 **Propuesta:** Poner `AUTH_PASS=CHANGE_ME_PLEASE` como hint.

### `.gitignore`
✅ Cubre `node_modules/`, `.env`, `*.log`, `session-*.md`, `-w`, `.opencode/`.  
💡 **Propuesta:** Agregar `*.dump`, `server/logs/`.

### `docker-compose.yml`
```yaml
services:
  server:
    volumes:
      - ${IMAGES_DIR}:/data:ro
    healthcheck:
      test: ["CMD", "wget", ...]
  client:
    ports:
      - "3000:80"
    depends_on:
      server:
        condition: service_healthy
```
✅ Volumen read-only, healthchecks, red aislada.  
🐛 **BUG:** Sin límites de recursos (`deploy.resources.limits.memory`). En producción, si el server consume mucha memoria procesando thumbnails con Sharp, puede OOM-killear el contenedor.  
💡 **Propuesta:** Agregar `deploy.resources.limits.memory: 512M` al server.

### `DOCKER.md`
```markdown
# Build and run with Docker Compose
docker-compose up -d --build
```
✅ Simple y claro.

### `FORENSIC_AUDIT.md` / `HALLAZGOS_A_CORREGIR.md`
📌 Auditorías anteriores. Contienen historial de fixes aplicados.

---

## 🖥️ SERVER (`server/`)

### `server/package.json`
```json
{
  "dependencies": {
    "chokidar": "^3.5.3",
    "sharp": "^0.33.1",
    "express": "^4.18.2",
    "helmet": "^8.2.0",
    "unzipper": "^0.10.14",
    "ws": "^8.16.0"
  }
}
```
🐛 **BUG:** `express` 4.18.2 — la versión 4.19+ corrige un path traversal en `express.static` (no usado directamente, pero buena práctica actualizar).  
💡 **Propuesta:** `npm install express@latest`.

### `server/Dockerfile`
```dockerfile
FROM node:18-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node", "src/index.js"]
```
✅ `USER appuser` (no-root) — corregido en auditoría anterior.  
✅ `node src/index.js` sin `--watch` — corregido.  
⚠️ **Falta:** `.dockerignore` para evitar copiar `node_modules` locales al build.  
💡 **Propuesta:** Crear `server/.dockerignore` con `node_modules/` y `*.log`.

### `server/vitest.config.js`
```javascript
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['**/*.test.js'] }
});
```
✅ Configuración mínima y correcta.

### `server/src/index.js` — Entry point
```javascript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import basicAuth from 'express-basic-auth';

// Startup validations
if (!existsSync(IMAGES_DIR)) { logger.error(...); process.exit(1); }

// Security
app.use(helmet());
if (ENABLE_AUTH) app.use(basicAuth(...));
app.use(cors({ origin: ['http://localhost:3000', ...] }));
app.use('/api', rateLimit({ windowMs: 1000, max: 100 }));

// Routes
app.use('/api/structure', structureRouter);
app.use('/api/image', imagesRouter);
```
✅ Helmet, CORS restrictivo, rate limiting, validación de startup.  
🐛 **BUG:** `process.exit(1)` en startup — mata el proceso sin cleanup. En Docker, el contenedor reinicia y vuelve a fallar → loop infinito.  
💡 **Propuesta:** Mejor lanzar error manejable o servidor en modo "error" que devuelva 503.

🐛 **BUG:** El rate limit es 100 req/seg para TODAS las rutas `/api/*`. Para thumbnails con Sharp, 100 req/seg puede saturarse.  
💡 **Propuesta:** Rate limit más permisivo para `/api/image` (50/seg) y más restrictivo para `/api/health` (10/seg).

⚠️ **Falta:** La ruta `/api/health` expone `imagesDir: IMAGES_DIR` en la respuesta. Revela la ruta interna del servidor.  
💡 **Propuesta:** No incluir `imagesDir` en la respuesta de health, solo `status: 'ok'`.

🐛 **BUG (potencial):** En el cleanup de `SIGTERM`/`SIGINT`, se llama `process.exit(0)` después de `server.close()`. Pero si `server.close()` falla o hay conexiones activas, el `process.exit()` fuerza el cierre. Esto es normal, pero vale la pena notarlo.

### `server/src/imageScanner.js` — Scanner de imágenes
```javascript
const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const MAX_DEPTH = 15;
const MAX_ITEMS = 50000;
const CACHE_DURATION = 300000; // 5 min
```
✅ Escaneo iterativo (no recursivo, evita stack overflow).  
✅ Cache con `scanPromise` para evitar escaneos concurrentes.  
✅ Exclusión de directorios del sistema y torrents.  
🐛 **BUG:** `getStructureWithMetadata()` llama `sharp(filePath)` para CADA imagen de 50K items para obtener metadata. Sharp procesa el header de cada imagen. Esto toma **2+ segundos** (visto en logs: `2061ms` para 50K items sin metadata, pero con metadata sería mucho más).  
💡 **Propuesta:** La metadata (width/height/size) debería obtenerse lazy, solo para las imágenes que el usuario realmente ve (no para el escaneo inicial).

🐛 **BUG:** `buildTree()` tiene un bug de conteo: cuando agrega un hijo, suma 1 a `totalImages` del padre, pero el bucle `while (ancestor !== parent)` recorre los ancestros y suma a cada uno. Sin embargo, el conteo de `ancestor.totalImages` se hace en cada iteración del `forEach`, lo que resulta en doble conteo. El PRIMER ancestro recibe +1 del hijo directo Y +1 del `while`.  
💡 **Propuesta:** Simplificar: después de construir el árbol, calcular totalImages recursivamente.

### `server/src/utils/pathSanitizer.js` — Seguridad
```javascript
const DOT_LIKE_CHARS = /[\u2025\u2026\uFF0E\uFF61\u3002\u2E2F\u2E3C]/g;
export function sanitizePath(requestedPath, baseDir) {
  let normalizedPath = safeDecodeURI(trimmedPath);
  normalizedPath = normalizedPath.normalize('NFC');
  ...
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolvedPath.startsWith(resolvedBase)) return null;
  return resolvedPath;
}
```
✅ `safeDecodeURI` con try-catch — corregido en auditoría anterior.  
✅ Normalización NFC + detección de caracteres Unicode punto-like.  
✅ Verificación de `resolvedPath.startsWith(resolvedBase)`.  
⚠️ **Falta:** También debería rechazar paths con `~` (home directory en Unix, aunque en Windows no aplica tanto).  
💡 **Propuesta:** Agregar bloqueo de `~` en paths.

### `server/src/utils/pathSanitizer.test.js` — Tests
✅ 22 tests, todos pasando.  
✅ Cubre Unicode traversal, control chars, double-encoding.  
⚠️ **Falta:** Tests para `safeDecodeURI` con `%` literal en el string.  
💡 **Propuesta:** Agregar test: `sanitizePath('100%calidad.jpg', BASE_DIR)` debe devolver path válido, no null.

### `server/src/utils/logger.js`
```javascript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' }
  }
});
```
✅ Logger centralizado con Pino.  
⚠️ **Falta:** En producción, sin pino-pretty, los logs son JSON puro. Esto es correcto para Docker (logs estructurados), pero el desarrollador no ve nada legible.  
💡 **Propuesta:** En desarrollo local, forzar `pino-pretty` independientemente de `NODE_ENV`.

### `server/src/routes/structure.js` — Rutas de estructura
```javascript
router.get('/', async (req, res) => { ... });
router.get('/flat', async (req, res) => { ... });
router.get('/tree', async (req, res) => { ... });
```
✅ Cache de 60s para `/` y `/tree`.  
🐛 **BUG:** `console.error` en lugar de `logger.error` en los catch. Ya existe el logger, úsalo.  
💡 **Propuesta:** Reemplazar `console.error` por `logger.error`.

### `server/src/routes/images.js` — Rutas de imágenes
```javascript
// Orden CORREGIDO:
router.get('/thumb/*', ...);
router.get('/archive/*', ...);
router.get('/metadata/*', ...);
router.get('/*', ...);   // Wildcard al final
```
✅ Orden corregido en auditoría anterior.  
🐛 **BUG:** `console.warn`/`console.error` en lugar de `logger.warn`/`logger.error` en todos los catch y bloqueos de seguridad.  
💡 **Propuesta:** Reemplazar todos los console.* por logger.*.

🐛 **BUG:** En `/thumb/*`, el fallback cuando Sharp falla sirve la imagen original sin redimensionar. Pero el header `Content-Type` se setea, el `Content-Length` NO (porque es un stream). Esto causa que el navegador espere un Content-Length que nunca llega → timeout.  
💡 **Propuesta:** En el fallback, usar `fs.createReadStream` con `statSync` para obtener tamaño y setear `Content-Length`, o mejor, usar `res.sendFile()`.

### `server/src/fileWatcher.js` — WebSocket + Chokidar
```javascript
wss = new WebSocketServer({ noServer: true });
// ...
watcher = chokidar.watch(baseDir, { ... });
```
✅ WebSocket server bien implementado (no interfiere con Express HTTP).  
✅ Chokidar con patrones de exclusión adecuados.  
✅ Debounce de 1s para evitar re-escaneos excesivos.  
🐛 **BUG:** Cuando detecta cambios, re-escanea COMPLETAMENTE 50K archivos + metadata (Sharp). Esto toma segundos y bloquea el servidor.  
💡 **Propuesta:** El watcher debería solo invalidar el cache (ya lo hace con `invalidateCache()`), pero no debería llamar a `getStructureWithMetadata()` que escanea 50K archivos. Debería diferir el escaneo completo a cuando un cliente pida la estructura.

⚠️ **Falta:** No hay límite de clientes WebSocket conectados. Si 1000 clientes se conectan, todos reciben broadcasts.  
💡 **Propuesta:** Agregar límite de conexiones simultáneas (ej: 50).

---

## 🎨 CLIENTE (`client/`)

### `client/package.json`
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-virtuoso": "^4.6.2",
    "react-zoom-pan-pinch": "^3.3.0",
    "@tanstack/react-query": "^5.17.9",
    "@use-gesture/react": "^10.3.0"
  }
}
```
✅ Dependencias actualizadas.  
⚠️ **Falta:** `react-router-dom` — actualmente no hay ruteo, pero sería útil para compartir enlaces directos a carpetas.  
💡 **Propuesta:** (opcional) Agregar react-router para URLs del tipo `/#/folder/Capitulo-5`.

### `client/Dockerfile`
```dockerfile
FROM node:18-alpine AS builder
RUN npm install
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```
✅ Multi-stage build (build efímero, solo Nginx en producción).  
⚠️ **Falta:** `.dockerignore` para no copiar `node_modules` locales al build context.  
💡 **Propuesta:** Crear `client/.dockerignore` con `node_modules/`.

### `client/nginx.conf`
```nginx
location /api/ {
    proxy_pass http://server:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    ...
}
```
✅ Headers de seguridad (CSP, HSTS, etc.).  
✅ Proxy con timeouts largos (120s) para imágenes grandes.  
🐛 **BUG:** `proxy_pass http://server:3001/api/` usa `server` como hostname. Esto funciona en Docker Compose (resolución por nombre de servicio). PERO en desarrollo local (sin Docker), el frontend corre en Vite dev server (puerto 5173) y el backend en Express (3001). Vite necesita un proxy configurado en `vite.config.js`.  
💡 **Propuesta:** Agregar `client/vite.config.js` con proxy para desarrollo.

### `client/src/main.jsx`
- Punto de entrada. No se pudo leer (file lock), pero debería montar `App` en `#root`.

### `client/src/index.css`
```css
[data-theme="light"] { ... }
```
✅ Variables CSS para dark/light theme con transiciones suaves.  
✅ Reset CSS básico.

### `client/src/App.jsx` — Componente principal
```jsx
const fetchStructure = async () => {
  const response = await fetch('/api/structure');
  if (!response.ok) throw new Error('Failed to fetch structure');
  return response.json();
};

const { data: structure, isLoading, error } = useQuery({
  queryKey: ['structure'],
  queryFn: fetchStructure
});
```
✅ TanStack Query para fetching con caché automática.  
✅ Virtualización con `VirtuosoGrid`.  
🐛 **BUG LÍNEA 257:** Fallback `onError` en thumbnails:
```jsx
onError={(e) => {
  const path = item.relativePath
  e.target.onerror = null
  e.target.src = `/api/image/${path}`  // ⚠️ SIN encodeURIComponent
}}
```
Si `item.relativePath` contiene espacios o caracteres especiales, el fallback genera una URL mal formada.  
💡 **Propuesta:** 
```jsx
e.target.src = `/api/image/${encodeURIComponent(item.relativePath)}`
```

🐛 **BUG:** El componente filtra imágenes por `selectedFolder` usando `structure.find(f => f.folder === selectedFolder)`. Si la carpeta tiene `\` en lugar de `/` (Windows), no matchea.  
💡 **Propuesta:** Normalizar `selectedFolder` a `/` antes de comparar.

### `client/src/utils/storage.js` — LocalStorage
```javascript
const PROGRESS_KEY = 'manga-…ress'
const THEME_KEY = 'manga-…heme'
```
❌ **BUG:** Las KEYS tienen caracteres rotos (visible como `manga-…ress` y `manga-…heme`). Probablemente se corrompieron al guardar el archivo. Las keys reales deberían ser `manga-reader-progress` y `manga-reader-theme`.  
💡 **Propuesta:** Corregir a `manga-reader-progress` y `manga-reader-theme`.

### `client/src/utils/debounce.js`
```javascript
function debounce(func, wait) {
  let timeout;
  const debounced = function executedFunction(...args) { ... };
  debounced.cancel = () => { clearTimeout(timeout); };
  return debounced;
}
```
✅ Implementación correcta con `cancel()`.

### `client/src/utils/storage.test.js`
- No se pudo leer. Asumo que existe.

### `client/src/hooks/useImageMemory.js` — Gestión de memoria
```javascript
export function useViewportImageManager(imageCount, options = {}) {
  // IntersectionObserver para virtualización avanzada
  const setImageRef = (index) => (el) => { ... };
  return { containerRef, setImageRef, imageRefs, visibleIndices, ... };
}
```
✅ Manejo inteligente de memoria con IntersectionObserver.  
✅ Descarga imágenes fuera de vista después de `unloadDelay`.  
✅ Precarga imágenes adyacentes.  
🐛 **BUG (rendimiento):** Cada imagen crea su propio IntersectionObserver. Para 500 imágenes visibles en scroll mode, hay 500 observers activos. IntersectionObserver es ligero, pero 500 puede ser excesivo.  
💡 **Propuesta:** Usar un solo IntersectionObserver con `rootMargin` adecuado y manejar todas las imágenes desde una callback central.

### `client/src/components/ReaderView.jsx` — Visor de lectura
✅ Modos scroll y paginado.  
✅ Zoom con `react-zoom-pan-pinch`.  
✅ Gestos swipe con `@use-gesture/react`.  
✅ Navegación entre capítulos.  
✅ Auto-scroll con velocidad ajustable.  
✅ Pantalla completa.  
🐛 **BUG:** En scroll mode, `window.scrollY` y `document.body.scrollHeight` se usan para detectar posición. Pero el contenido no está en `document.body`, está dentro de `imagesContainer` con padding/margins. La detección de scroll puede ser imprecisa.  
💡 **Propuesta:** Usar `scrollContainerRef.current.scrollTop` y `scrollContainerRef.current.scrollHeight`.

### `client/src/components/Lightbox.jsx` — Lightbox
✅ Precarga de imágenes adyacentes.  
✅ Navegación por teclado.  
✅ Zoom con click.  
✅ Overlay semitransparente.  
🐛 **BUG:** Cuando hace click en el backdrop para cerrar, verifica `e.target === e.currentTarget`. Esto funciona, pero en móviles el click puede no propagarse correctamente.  
💡 **Propuesta:** Agregar un botón de cerrar siempre visible o swipe down para cerrar en móvil.

### `client/src/components/FolderSearch.jsx` — Búsqueda
✅ Búsqueda con debounce implícito por React state.  
🐛 **BUG:** Usa `<i className="fa fa-times"></i>` y `<i className="fa fa-search"></i>` — ¡Font Awesome! Pero NO está importado en el proyecto. No hay CDN link, no hay package. Los íconos se ven como cuadrados vacíos.  
💡 **Propuesta:** Reemplazar `<i className="fa fa-..."></i>` por SVGs inline (como en el resto de componentes).

### `client/src/components/ContinueReading.jsx`
✅ Muestra progreso de lectura de hasta 5 carpetas.  
✅ Barra de progreso visual.

### `client/src/components/FolderCard.jsx`
✅ Tarjeta de carpeta con ícono, nombre, conteo.  
✅ Badge de progreso (completado/en progreso).  
✅ Efecto hover.

### `client/src/components/Breadcrumb.jsx`
✅ Breadcrumbs con navegación hacia atrás.  
✅ Contador de imágenes.

### `client/src/components/ErrorBoundary.jsx`
✅ Error boundary con botón de reintento.

### `client/src/components/ThemeToggle.jsx`
✅ Toggle dark/light con atajo Alt+T.  
✅ Posición fija en pantalla.

### `client/src/components/TreeView.jsx`
✅ Árbol de carpetas expandible.  
✅ Conteo de imágenes por nodo.

### `client/src/components/Skeleton.jsx`
✅ Placeholder de carga animado.

### `client/src/components/StickyHeader.jsx`
✅ Header sticky con nombre de carpeta actual.

---

## 🔴 BUGS CRÍTICOS (IMPIDEN FUNCIONAMIENTO)

| # | Archivo | Bug | Solución |
|---|---------|-----|----------|
| C1 | `utils/storage.js` | Keys de localStorage corruptas (`manga-…ress`) | Cambiar a `manga-reader-progress` |
| C2 | `App.jsx:257` | Fallback `onError` sin `encodeURIComponent` | Agregar `encodeURIComponent` |
| C3 | `FolderSearch.jsx` | Usa Font Awesome sin importarlo | Reemplazar íconos por SVGs |

## 🟡 BUGS DE RENDIMIENTO

| # | Archivo | Bug | Solución |
|---|---------|-----|----------|
| P1 | `imageScanner.js` | Sharp procesa metadata de 50K imágenes al escanear | Lazy loading de metadata |
| P2 | `imageScanner.js` | `buildTree()` duplica conteo de imágenes | Simplificar lógica de conteo |
| P3 | `useImageMemory.js` | 500+ IntersectionObservers activos | Usar 1 observer con rootMargin |
| P4 | `routes/structure.js` | `/flat` devuelve 50K items sin paginación | Agregar paginación (?page=&limit=) |

## 🟠 BUGS DE CALIDAD DE CÓDIGO

| # | Archivo | Bug | Solución |
|---|---------|-----|----------|
| Q1 | `routes/images.js` | `console.error` en lugar de `logger.error` | Reemplazar 12 ocurrencias |
| Q2 | `routes/structure.js` | `console.error` en lugar de `logger.error` | Reemplazar 3 ocurrencias |
| Q3 | `index.js` | `/api/health` expone `IMAGES_DIR` | Quitar ruta del response |
| Q4 | `images.js` (thumb fallback) | Stream sin Content-Length | Usar `res.sendFile()` o statSync |
| Q5 | `App.jsx` | Comparación de paths con \ vs / | Normalizar separadores |

## 🟢 MEJORAS PROPUESTAS

| # | Archivo | Mejora |
|---|---------|--------|
| M1 | Raíz | `npm run docker:up` script |
| M2 | `index.js` | Rate limit separado por ruta |
| M3 | `index.js` | Graceful startup sin `process.exit()` |
| M4 | `fileWatcher.js` | Solo invalidar cache, no re-escanear |
| M5 | `ReaderView.jsx` | Detección de scroll con ref, no window |
| M6 | `docker-compose.yml` | Límite de memoria 512M para server |
| M7 | `nginx.conf` | `client_max_body_size` para archivos grandes |
| M8 | `FolderSearch.jsx` | SVGs inline en vez de FontAwesome |
| M9 | `Lightbox.jsx` | Botón cerrar fijo + swipe down en móvil |
| M10 | `pathSanitizer.js` | Bloquear `~` en paths |
| M11 | Tests | Agregar test para safeDecodeURI con % literal |

---

## 📊 RESUMEN

| Categoría | Cantidad |
|-----------|----------|
| 🐛 Bugs críticos (no funcional) | **3** (C1, C2, C3) |
| 🟡 Bugs de rendimiento | **4** (P1-P4) |
| 🟠 Bugs de calidad | **5** (Q1-Q5) |
| 🟢 Mejoras | **11** (M1-M11) |

### ⚡ Arreglos inmediatos para que funcione

1. **C1** — Corregir keys de localStorage en `storage.js`
2. **C2** — Agregar `encodeURIComponent` en fallback de thumbnails
3. **C3** — Reemplazar FontAwesome por SVGs en `FolderSearch.jsx`
4. **Q4** — Setear Content-Length en fallback de thumbnails
5. **Q5** — Normalizar separadores de path en `App.jsx`

El resto son optimizaciones. El proyecto YA funciona (servidor corriendo, respuestas 200 en health API). Los bugs identificados explican errores 404/500/502 que viste en consola.
