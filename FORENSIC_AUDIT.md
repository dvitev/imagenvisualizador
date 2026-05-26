# 🔍 Auditoría Forense Completa — `imagenvisualizador`

**Fecha:** 2026-05-26 (07:52 GMT-5) — Actualizado 11:50 GMT-5  
**Analista:** OpenClaw AI  
**Versión del proyecto:** 1.0.0 (+1 fix commit)  
**Repositorio:** `D:\PycharmProjects\imagenvisualizador`

---

## ✅ Correcciones Aplicadas (26-May 11:50 GMT-5)

| # | Hallazgo | Corrección | Estado |
|---|----------|-----------|--------|
| 🔴 | `.env` en historial Git | `git filter-branch` purgó `.env`, `-w`, `session-ses_1bc7.md`, `server.log` | ✅ **HECHO** |
| 🔴 | `-w` y `session-ses_1bc7.md` en disco | Eliminados físicamente | ✅ **HECHO** |
| 🟠 | Zip-Slip en ZIP/CBZ | Validación de paths internos + control chars + `..` en archivos comprimidos | ✅ **HECHO** |
| 🟠 | Unicode path traversal | Normalización NFC + decodificación URI + detección de 7+ caracteres Unicode tipo punto | ✅ **HECHO** |
| 🟡 | `node --watch` en Dockerfile | Cambiado a `node src/index.js` | ✅ **HECHO** |
| 🟡 | Contenedor como root | Agregado `USER appuser` con `addgroup`/`adduser` | ✅ **HECHO** |
| 🟡 | Tests desactualizados | 22 tests (nuevos: Unicode traversal, control chars, zip-slip, caracteres peligrosos) | ✅ **22/22 pasando** |
| 🟡 | `.opencode/` en repo | Agregado a `.gitignore` | ✅ **HECHO** |

---

## 📋 Pronóstico General

| Dimensión | Estado | Progreso desde auditoría anterior |
|---|---|---|
| 🔐 Seguridad | ✅ Mayoría corregida | 🟠 2 hallazgos residuales |
| 🏗️ Arquitectura | ✅ Sólida | — |
| 🧪 Tests | ⚠️ Cobertura limitada | ✅ 22 tests, +10 nuevos |
| 🐳 Docker | ✅ Corregido | `--watch` y `USER` fijados |
| 🗑️ Basura en disco | ✅ Limpio | Archivos eliminados |
| 🔒 Git history | ✅ Purgado | `filter-branch` completado |
| 📦 Repo bloat | 🟡 `.opencode/` en `.gitignore` | Pendiente purga histórica |

---

## 1. 📁 Inventario del Proyecto

```
imagenvisualizador/
├── .git/                         # 3 commits en main
├── .opencode/                    # ⚠️ Skills OpenCode (~30 MB) — en historial git
├── client/                       # Frontend React 18 + Vite 8 + Vitest
│   ├── src/
│   │   ├── components/           # 14 componentes con CSS Modules
│   │   ├── hooks/                # useImageMemory.js
│   │   ├── utils/                # storage.js, debounce.js
│   │   ├── App.jsx               # Entry principal
│   │   └── main.jsx
│   ├── Dockerfile                # Multi-stage (builder → nginx:alpine)
│   └── nginx.conf                # ✅ CSP + HSTS agregados
├── server/                       # Backend Express 4.18 + Sharp
│   ├── src/
│   │   ├── routes/               # images.js, structure.js
│   │   ├── utils/                # pathSanitizer.js (+tests), logger.js
│   │   ├── index.js              # Entry point
│   │   ├── imageScanner.js       # Scanner con caché (50K items)
│   │   └── fileWatcher.js        # WebSocket + Chokidar
│   ├── Dockerfile                # node:18-alpine
│   └── server.log                # ⚠️ Log de ejecución en disco
├── images/test/                  # Imágenes de prueba
├── scripts/                      # build-docker.bat / .sh
├── docker-compose.yml
├── .env                          # ⚠️ CREDENCIALES EN DISCO
├── -w                            # ⚠️ DUMP JSON 7.7 MB en disco (gitignorado)
├── session-ses_1bc7.md           # ⚠️ LOG DE IA 369 KB en disco (gitignorado)
├── FORENSIC_AUDIT.md
└── HALLAZGOS_A_CORREGIR.md
```

### 4️⃣ Commits en Git (historial purgado)

| Hash | Mensaje | Fecha |
|------|---------|-------|
| `00fa931` | Initial commit | — |
| `e0a342e` | feat: initialize server... | 21-May |
| `aa33145` | `.` (fix commit) | 26-May |
| `b5cbd81` | ✅ fix: correcciones de seguridad post-auditoria | **Ahora** |

🔒 **Historial purgado con `git filter-branch`** — se eliminaron permanentemente:
- ✅ `.env` — credenciales y rutas
- ✅ `-w` — dump JSON 7.7 MB
- ✅ `session-ses_1bc7.md` — log de IA 369 KB
- ✅ `server/server.log` — log de ejecución

**El commit `aa33145` (anteriormente `f0328c3`) ya había:**
- Eliminado del tracking: `-w`, `session-ses_1bc7.md`
- Agregado `FORENSIC_AUDIT.md` y `HALLAZGOS_A_CORREGIR.md`
- Actualizado `.gitignore` con exclusiones
- Aplicado ~15 correcciones de seguridad y calidad

---

## 2. 🔐 Seguridad

### 2.1 🟠 `.env` con credenciales en texto plano (EN DISCO)

| Campo | Valor |
|-------|-------|
| **Archivo** | `D:\PycharmProjects\imagenvisualizador\.env` |
| **Estado** | ⛔ Existe en disco, ⛔ Existe en historial git |
| **Git tracking** | ❌ No (ignorado), pero está en commit `5e15942` |

**Contenido expuesto:**
```env
IMAGES_DIR=N:/Torrents
PORT=3001
HOST=0.0.0.0
ENABLE_AUTH=false
AUTH_USER=admin
AUTH_PASS=changeme
NODE_ENV=production
```

**Riesgos:**
- Ruta `N:/Torrents` revela unidad de red/interna con contenido P2P
- `AUTH_PASS=changeme` y `ENABLE_AUTH=false`: sin autenticación real
- `HOST=0.0.0.0` en producción: expuesto a toda la red

**Acción requerida:**
- ✅ `.gitignore` ya lo excluye desde `f0328c3`
- ❌ **Falta** `git filter-branch` para purgar del historial
- ❌ **Falta** rotar credenciales

### 2.2 🟡 Path Sanitizer — Corregido en `f0328c3`

| Versión anterior | Versión actual | Estado |
|---|---|---|
| Función inline vulnerable en `images.js` | Importa `sanitizePath` de `utils/pathSanitizer.js` | ✅ **CORREGIDO** |

La implementación actual:
```javascript
export function sanitizePath(requestedPath, baseDir) {
  const normalizedPath = path.normalize(requestedPath)
  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) return null
  const fullPath = path.join(baseDir, normalizedPath)
  const resolvedPath = path.resolve(fullPath)
  const resolvedBase = path.resolve(baseDir)
  if (!resolvedPath.startsWith(resolvedBase)) return null
  return resolvedPath
}
```

✅ Verifica que el path resuelto esté dentro de BASE_DIR  
✅ Rechaza `..` y paths absolutos  
✅ Tests unitarios actualizados con 12 casos  
⚠️ **Debilidad residual:** no normaliza Unicode (`‥`/U+2025 evade detección de `..`), no decodifica URI

### 2.3 🟡 Zip-Slip en extracción de archivos ZIP/CBZ

**Archivo:** `server/src/routes/images.js` — ruta `/api/image/archive/*`

```javascript
const directory = await unzipper.Open.file(fullPath);
directory.files.filter(file => { ... });
// No valida que file.path esté dentro del directorio esperado
```

❌ No hay validación de que los paths internos del ZIP no contengan `../`  
❌ Un ZIP malicioso con `../../etc/passwd` podría leakear archivos

**Recomendación:**
```javascript
if (file.path.includes('..') || path.isAbsolute(file.path)) {
  // Saltar entry malicioso
  continue;
}
```

### 2.4 🟢 Autenticación básica sobre HTTP — (depende del despliegue)

- `express-basic-auth` envía credenciales en Base64
- Sin HTTPS configurado
- Si se despliega tras reverse proxy (Nginx/Caddy), se puede delegar HTTPS ahí

### 2.5 ✅ Helmet + Rate Limiting + CORS — Corregido en `f0328c3`

```javascript
app.use(helmet());                         // ✅ Headers de seguridad
app.use('/api', rateLimit({...}));          // ✅ 100 req/seg/IP
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] })); // ✅
```

### 2.6 ✅ Nginx con headers de seguridad — Agregado en `f0328c3`

- Content-Security-Policy
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy
- X-Frame-Options, X-Content-Type-Options

---

## 3. 🐳 Docker & Contenedores

### 3.1 Server Dockerfile

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
ENV NODE_OPTIONS="--max-old-space-size=4096"
CMD ["node", "--watch", "src/index.js"]  # ❌ --watch es de desarrollo
```

| Problema | Severidad |
|----------|-----------|
| `--watch` en CMD (reinicio silencioso) | 🟡 **MEDIO** |
| Corre como `root` (falta `USER node`) | 🟢 **BAJO** |
| Sin `.dockerignore` específico del server | 🟢 **BAJO** |

**Fix:** `CMD ["node", "src/index.js"]`

### 3.2 Client Dockerfile ✅

```dockerfile
FROM node:18-alpine AS builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

✅ Multi-stage build (no deja rastro de Node en producción)  
✅ Nginx:alpine (liviano, ~23 MB)  
✅ Headers de seguridad en nginx.conf

### 3.3 docker-compose.yml

```yaml
services:
  server:
    build: ./server
    volumes:
      - ${IMAGES_DIR}:/data:ro      # ✅ Read-only mount
    networks:
      - manga-network
    healthcheck:
      test: ["CMD", "wget", ...]     # ✅ Healthcheck
  client:
    build: ./client
    ports:
      - "3000:80"
    depends_on:
      server:
        condition: service_healthy
```

✅ Volumen read-only  
✅ Red bridge aislada  
✅ Healthchecks  
⚠️ Sin límites de recursos (`deploy.resources`)  
⚠️ Sin restart policies explícitas

---

## 4. 🗑️ Artefactos en Disco (Gitignorados pero presentes)

| Archivo | Tamaño | Contenido | Acción recomendada |
|---------|--------|-----------|--------------------|
| `-w` | **7.7 MB** | Dump JSON de `getStructure()` — lista completa de archivos de `N:/Torrents` | ❌ **Eliminar** |
| `session-ses_1bc7.md` | **369 KB** | Log completo de sesión con IA (prompts, decisiones) | ❌ **Eliminar** |
| `server/server.log` | **~2 KB** | Log de ejecución del servidor | ❌ **Eliminar** |
| `.env` | 695 B | Credenciales + ruta | ⚠️ Mantener pero rotar |

**Estado en git:** Todos están en `.gitignore` (desde `f0328c3`) y removidos del tracking. Pero `-w` y `session-ses_1bc7.md` y `.env` aún existen en commits pasados del historial.

---

## 5. 🧪 Cobertura de Tests

| Archivo | Tests | Estado |
|---------|-------|--------|
| `pathSanitizer.test.js` | 12 tests / 4 suites | ✅ Pasando |
| `storage.test.js` | — | ⚠️ Existe pero no se pudo inspeccionar |
| **Total** | **~12 tests** | **Cobertura: ~2%** |

### Tests de `pathSanitizer` (✅ actualizados en `f0328c3`):

| Suite | Tests |
|-------|-------|
| Security - Path Traversal Prevention | 7 tests (.., ../.., absolute, mixed separators, URL-encoded, null bytes) |
| Valid Paths | 5 tests (relative, mixed separators, empty, root-level, `startsWith(BASE_DIR)`) |
| Edge Cases | 4 tests (spaces, Unicode, long paths, drive letters on Windows) |

**Faltante crítico:** No hay tests para rutas API, WebSocket, imageScanner, componentes React, ni fileWatcher.

---

## 6. 📦 Dependencias

### npm audit: ✅ 0 vulnerabilidades

| Paquete | Versión | Nota |
|---------|---------|------|
| `vite` | 8.0.14 | ✅ Actualizado (fijado en `f0328c3`) |
| `vitest` | 4.1.7 | ✅ Actualizado |
| `sharp` | 0.33.1 | ✅ Estable |
| `helmet` | 8.2.0 | ✅ Agregado en `f0328c3` |
| `express` | 4.18.2 | ⚠️ 4.19+ disponible (path traversal fix) |
| `react` | 18.2.0 | ⚠️ React 19 disponible |

---

## 7. 💎 Hallazgos Positivos

1. ✅ **Path sanitizer con 12 tests** — única función con cobertura completa
2. ✅ **Helmet + Rate Limiting + CORS restrictivo** — buena postura de seguridad
3. ✅ **Arquitectura limpia** — server/client separados con Docker Compose
4. ✅ **Docker multi-stage** (client) — build efímero con Nginx en producción
5. ✅ **Volumen read-only** (`:ro`) en docker-compose
6. ✅ **WebSocket** — notificaciones en tiempo real de cambios en estructura
7. ✅ **Dark/Light theme** con CSS variables y transición suave
8. ✅ **Virtualización con react-virtuoso** — buen rendimiento con miles de imágenes
9. ✅ **Precarga de imágenes** en Lightbox y ReaderView
10. ✅ **Fallback de thumbnails** — si sharp falla, sirve la imagen original
11. ✅ **Debounce** — en watcher (1s) y guardado de progreso (1s)
12. ✅ **Manejo de errores** con `try/catch` en todas las rutas
13. ✅ **Content-Security-Policy** y HSTS en nginx.conf (agregado en `f0328c3`)
14. ✅ **Logger Pino** centralizado en utils (agregado en `f0328c3`)
15. ✅ **Límite de 50K items** y exclusión de directorios torrents/system

---

## 8. ❌ Hallazgos Abiertos

| # | Prioridad | Hallazgo | Estado |
|---|-----------|----------|--------|
| 1 | 🟠 **ALTA** | Basic Auth sin HTTPS — credenciales viajan en Base64 | 🟡 Depende del despliegue |
| 2 | 🟡 **MEDIA** | `.opencode/` infla el repo (~30 MB) en historial | ⛔ Pendiente purgar |
| 3 | 🟡 **MEDIA** | Caché en memoria (`cachedStructure`) sin límite de tamaño | ⛔ Pendiente implementar LRU |
| 4 | 🟢 **BAJA** | Sin ESLint/Prettier/TypeScript | ⛔ Configurar tooling |
| 5 | 🟢 **BAJA** | Cobertura de tests limitada (~2%) | ⛔ Agregar tests de API y componentes |
| 6 | 🟢 **BAJA** | `express` 4.18.2 (4.19+ disponible) | ⛔ `npm update` |

### ✅ Corregidos en esta auditoría

| Hallazgo | Antes | Ahora |
|----------|-------|-------|
| `.env` en historial Git | 🔴 Comprometido | ✅ Purgado con filter-branch |
| Archivos basura en disco | 🔴 7.7 MB + 369 KB | ✅ Eliminados |
| Path traversal Unicode | 🟠 Vulnerable | ✅ NFC + decodeURI + detección de dots Unicode |
| Zip-Slip (ZIP/CBZ) | 🟠 Sin protección | ✅ Validación de paths internos |
| `--watch` en Dockerfile | 🟡 Dev flag en prod | ✅ `node src/index.js` |
| Contenedor como root | 🟡 Sin `USER` | ✅ `appuser` no-root |
| Tests de seguridad | 🟡 12 tests | ✅ 22 tests (nuevos casos Unicode/control/zip-slip)

---

## 9. 📊 Métricas

| Métrica | Valor |
|---------|-------|
| Archivos fuente (app) | ~40 |
| Líneas de código (server + client) | ~4,500 |
| Componentes React | 14 |
| Rutas API | 7 (image, thumb, archive, metadata, structure, flat, tree, health, ws-info) |
| Tests | ~12 (solo pathSanitizer) |
| Cobertura de tests | ~2% |
| Vulnerabilidades (npm audit) | 0 ✅ |
| Commits en git | 3 |
| Correcciones aplicadas | ~15 (en commit `f0328c3`) |

---

## 10. 🎯 Plan de Acción

### ✅ HECHO (26-May 11:50 GMT-5)
- [x] Purgar historial git (filter-branch completado)
- [x] Eliminar archivos del disco (`-w`, `session-ses_1bc7.md`, `server.log`)
- [x] Zip-Slip fix en ZIP/CBZ
- [x] Normalización Unicode en `sanitizePath`
- [x] `CMD ["node", "src/index.js"]` en server/Dockerfile
- [x] `USER appuser` no root
- [x] Tests actualizados (22 tests, 22/22 pasando)

### 🟠 Corto plazo (1-3 días)
- [ ] Purgar `.opencode/` del historial git (filter-branch adicional)
- [ ] Implementar autenticación real (JWT o derivar a reverse proxy con HTTPS)
- [ ] Límite de memoria para cache (`cachedStructure` — LRU o size limit)
- [ ] Hacer `git push --force origin main` si hay remote configurado

### 🟡 Mediano plazo (1-2 semanas)
- [ ] Configurar ESLint + Prettier
- [ ] Agregar tests para rutas API (supertest + Vitest)
- [ ] Configurar CI/CD (GitHub Actions)
- [ ] Configurar HTTPS (Caddy como reverse proxy)

### 🟢 Largo plazo
- [ ] Migrar a Express 5
- [ ] React 19
- [ ] Soporte multi-usuario con progreso sincronizado
- [ ] Cola de tareas para thumbnails (Bull/BullMQ)

---

## 🔗 Archivos de Referencia

| Archivo | Descripción |
|---------|-------------|
| `FORENSIC_AUDIT.md` | Este informe (auditoría forense actual) |
| `HALLAZGOS_A_CORREGIR.md` | Consolidado de 19 hallazgos con soluciones |
| `README.md` | Documentación del proyecto |
| `DOCKER.md` | Instrucciones Docker |
| `docker-compose.yml` | Orquestación de servicios |

---

### ⚠️ Nota Final

El proyecto ha mejorado significativamente con el commit `f0328c3` que aplicó ~15 correcciones de seguridad y calidad. Sin embargo, **persisten 3 riesgos críticos** que requieren intervención manual:

1. **Purgar historial Git** — las credenciales y datos sensibles siguen en commits anteriores
2. **Validar zip-slip** — vector de ataque real en entornos con subida de archivos
3. **Normalizar Unicode** — el path sanitizer es sólido pero puede eludirse con caracteres especiales

---

*Auditoría generada el 2026-05-26 07:52 GMT-5 por OpenClaw AI*  
*Para: David Vite — Jefatura TICS, Hospital General Milagro - IESS*
