# 📋 Hallazgos a Corregir — ImagenVisualizador

> **Consolidado de ambas auditorías forenses** (25/05/2026)
> **Total: 19 hallazgos** — 3 🔴 críticos · 5 🟠 altos · 5 🟡 medios · 6 🟢 bajos

## ✅ Progreso de Correcciones

| Estado | Hallazgos resueltos |
|--------|---------------------|
| ✅ C-1 | Path Traversal corregido — se importa `sanitizePath` de `utils/pathSanitizer.js` |
| ✅ C-2 | Archivo `-w` eliminado del tracking de Git + `.gitignore` actualizado |
| ✅ A-4 | Rutas de imágenes ahora usan la función correcta (mismo fix que C-1) |
| ✅ A-5 | File Watcher reactivado (`setupFileWatcher` descomentado) |
| ✅ M-1 | Logs de debug que exponían `BASE_DIR` eliminados |
| ✅ M-2 | `MAX_ITEMS` sincronizado a 50,000 en `imageScanner.js` |
| ✅ M-3 | Headers CSP, HSTS, Referrer-Policy, Permissions-Policy agregados a `nginx.conf` |
| ✅ M-5 | Tests actualizados para cubrir casos adicionales de path traversal |
| ✅ B-3 | Sharp importado estáticamente (ya no `await import()` dinámico) |
| ✅ B-4 | `debounce.cancel()` corregido — usa `useRef` para mantener referencia estable |
| ✅ B-5 | Fullscreen ahora usa `containerRef` en vez de `document.documentElement` |
| ✅ B-6 | Helmet instalado y configurado en Express |
| ✅ M-4 | Vite v8.0.14, vitest v4.1.7 — 0 vulnerabilidades |
| ✅ B-1 | `process.exit(1)` mejorado — cleanup del watcher en SIGTERM/SIGINT |
| ✅ B-2 | Logger compartido creado (`utils/logger.js`) — imageScanner, fileWatcher, index usan Pino |
| ⏳ A-1 | Descartado (IMAGES_DIR es carpeta de imágenes legítima) |
| ⏳ A-2 | Session log eliminado del tracking Git (falta filter-branch para purgar historial) |
| ⏳ A-3 | Requiere HTTPS — depende del entorno de despliegue |

---

---

## 🔴 CRÍTICOS — Corregir ahora

### C-1 — Path Traversal en `/api/image/*`
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/routes/images.js` (líneas 36-54) |
| **Problema** | La función `sanitizePath` inline bloquea `..` literal pero **no verifica** que el path resuelto esté dentro de `BASE_DIR`. Usa `path.join()` sin `path.resolve()` ni `fs.realpathSync()`. |
| **Ironía** | `server/src/utils/pathSanitizer.js` tiene la implementación **correcta** (con `resolvedPath.startsWith(resolvedBase)`) pero no es importada por las rutas. |
| **Riesgo** | Alto — un atacante podría leer archivos fuera del directorio de imágenes mediante encoding malicioso (doble encoding, null bytes, symlinks). |
| **Solución** | Reemplazar la función inline por `import { sanitizePath } from '../utils/pathSanitizer.js'` y llamar `sanitizePath(requestedPath, BASE_DIR)` en cada handler. |

---

### C-2 — Archivo `-w` de 7.7 MB rastreado en Git
| Campo | Detalle |
|-------|---------|
| **Archivo** | `/-w` (raíz del proyecto) |
| **Qué es** | Un dump JSON del escáner de imágenes (`getStructure()`). Contiene la estructura de carpetas y archivos de `N:/Torrents`. |
| **SHA256** | `442d2de0c76ac5d460220f42db22a54f751b901c8ea5ce8da1f1142d2aa2ab99` |
| **Tamaño** | 7,713,032 bytes |
| **Riesgo** | Infla el repo innecesariamente + posible fuga de estructura de archivos del sistema. |
| **Solución** | `echo "-w" >> .gitignore` y purgar del historial con `git filter-branch`. |

---

### C-3 — `.env` con credenciales en historial Git
| Campo | Detalle |
|-------|---------|
| **Archivo** | `.env` (commiteado en `5e15942`) |
| **Problema** | Aunque `.env` está en `.gitignore`, fue commiteado y quedó en el historial permanentemente. |
| **Contenido expuesto** | `AUTH_USER=admin`, `AUTH_PASS=changeme`, `IMAGES_DIR=N:/Torrents`, `NODE_ENV=production` |
| **Riesgo** | Alto — las credenciales quedan accesibles en el historial de Git aunque se elimine el archivo actual. |
| **Solución** | Purgar con `git filter-branch` y rotar cualquier secreto que haya estado en ese archivo. |

---

## 🟠 ALTOS — Corregir hoy

### A-1 — `IMAGES_DIR` apunta a ruta de Torrents
| Campo | Detalle |
|-------|---------|
| **Archivo** | `.env` (activo) |
| **Valor actual** | `IMAGES_DIR=N:/Torrents` |
| **Riesgo** | Medio — el nombre de la ruta sugiere contenido de descargas P2P. Si sirves contenido desde ahí sin filtro, podrías exponer material sensible o con copyright. |
| **Solución** | Cambiar a una ruta dedicada solo para imágenes del visor, ej: `IMAGES_DIR=D:/imagenes_manga` |

---

### A-2 — Sesión AI de 369 KB commiteada
| Campo | Detalle |
|-------|---------|
| **Archivo** | `session-ses_1bc7.md` |
| **Problema** | Log completo de la sesión de OpenCode/OpenClaw que generó el proyecto. Contiene prompts, contexto, decisiones técnicas. |
| **Riesgo** | Bajo-medio — no hay credenciales pero expone el proceso de desarrollo y contexto interno del proyecto. |
| **Solución** | Agregar `session-*.md` a `.gitignore` y purgar del historial. |

---

### A-3 — Basic Auth sobre HTTP plano
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/index.js` (líneas 64-70) |
| **Problema** | `express-basic-auth` implementa RFC 7617. Las credenciales viajan en el header `Authorization: Basic <base64>`. Base64 NO es cifrado — cualquiera en la red puede interceptarlo. Sin HTTPS, las credenciales viajan en texto plano legible. |
| **Ejemplo** | `echo YWRtaW46Y2hhbmdlbWU= \| base64 -d` → `admin:changeme` |
| **Adicional** | `express-basic-auth` compara contraseñas en texto plano contra el objeto users, no usa bcrypt ni hash. |
| **Solución** | Implementar HTTPS (mkcert para desarrollo local) o migrar a autenticación por JWT/token. |

---

### A-4 — `sanitizePath` correcto existe pero NO se usa
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/utils/pathSanitizer.js` |
| **Problema** | Existe una función de sanitización correcta (con `path.resolve()` + verificación de pertenencia) pero las rutas en `routes/images.js` implementaron su propia versión inline vulnerable. |
| **Solución** | Importar y usar `sanitizePath` de utils en todos los handlers de imágenes. Esto resuelve C-1 también. |

---

### A-5 — File Watcher deshabilitado
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/index.js` (línea 106) |
| **Línea actual** | `// setupFileWatcher(IMAGES_DIR, server);` — comentado |
| **Nota** | `// File watcher desactivado temporalmente para debug` |
| **Impacto** | Sin el watcher, el servidor no detecta cambios en el directorio de imágenes. Si agregas o eliminas imágenes, el cache queda desactualizado hasta el próximo reinicio. |
| **Solución** | Quitar el comentario y reactivar: `setupFileWatcher(IMAGES_DIR, server);` |

---

## 🟡 MEDIOS — Corregir esta semana

### M-1 — Logs de debug exponen `BASE_DIR`
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/routes/images.js` (líneas 47-50) |
| **Código** | `console.log("🔍 BASE_DIR: " + BASE_DIR)` |
| **Riesgo** | Bajo-medio — expone la ruta base del servidor en los logs. En producción, un atacante con acceso a logs sabría exactamente dónde están los archivos. |
| **Solución** | Eliminar los `console.log` de debug o pasarlos a `logger.debug()` |

---

### M-2 — MAX_ITEMS inconsistente entre código y runtime
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/imageScanner.js` (línea: `const MAX_ITEMS = 20000`) |
| **Evidencia** | `server.log` muestra: `⚠️ Límite de 50000 items alcanzado` |
| **Impacto** | Bajo — el código dice 20,000 pero en ejecución se llegó a 50,000. Hay una inconsistencia entre el valor en código fuente y el que realmente se usó en runtime. |
| **Solución** | Sincronizar: cambiar `MAX_ITEMS = 20000` a 50000 (o viceversa) |

---

### M-3 — Sin CSP / HSTS / HTTPS en Nginx
| Campo | Detalle |
|-------|---------|
| **Archivo** | `client/nginx.conf` |
| **Headers actuales** | Solo tiene `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection` |
| **Headers faltantes** | `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` |
| **Solución** | Agregar: |
| | `add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;` |
| | `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` |

---

### M-4 — 2 vulnerabilidades moderate en dependencias del cliente
| Campo | Detalle |
|-------|---------|
| **Archivo** | `client/package.json` |
| **Vulnerabilidades** | `vite@5.0.8` (≤6.4.1) — Path Traversal en `.map` de optimized deps (GHSA-4w7w-66w2-5vf9) |
| | `esbuild@<=0.24.2` — Dev server permite a sitios web leer respuestas (GHSA-67mh-4wv8-2f99) |
| **Nota** | Solo afectan al dev server (`npm run dev`), no a producción (Nginx sirve los assets compilados) |
| **Solución** | `cd client && npm update vite@latest` (major update a v6+) |

---

### M-5 — Tests prueban la función de sanitización NO utilizada
| Campo | Detalle |
|-------|---------|
| **Archivo** | `server/src/utils/pathSanitizer.test.js` |
| **Problema** | Los tests prueban `sanitizePath` de `utils/pathSanitizer.js`, pero las rutas `images.js` usan su propia función inline. Los tests pasan ✅ pero la función real que se ejecuta en producción **no tiene cobertura de tests**. |
| **Solución** | Actualizar tests para que prueben la función real que se usa en `routes/images.js`, o mejor: unificar en una sola implementación y probar esa. |

---

## 🟢 BAJOS — Corregir cuando tengas tiempo

### B-1 — `process.exit(1)` en lugar de manejo graceful
**Archivo:** `server/src/index.js`
**Problema:** Cuando falta `IMAGES_DIR` o el directorio no existe, el servidor llama `process.exit(1)` en vez de lanzar una excepción que el proceso pueda manejar.
**Solución:** Reemplazar `process.exit(1)` por `throw new Error(...)` o un handler centralizado.

---

### B-2 — `console.log` mezclado con logger Pino
**Archivos:** `server/src/imageScanner.js`, `server/src/routes/images.js`, `server/src/fileWatcher.js`
**Problema:** Se configuró Pino como logger (`const logger = pino(...)`) pero el código usa `console.log` y `console.error` en lugar de `logger.info`, `logger.error`, etc.
**Solución:** Reemplazar todos los `console.log/error` por llamadas al logger.

---

### B-3 — Sharp importado dinámicamente en cada llamada
**Archivo:** `server/src/imageScanner.js` (línea ~129)
**Código:** `const sharp = await import('sharp');` — dentro de la función `getImageMetadata()`
**Problema:** Sharp se importa dinámicamente cada vez que se leen metadatos de una imagen (potencialmente miles de veces).
**Solución:** Mover `import sharp from 'sharp'` al inicio del archivo (import estático).

---

### B-4 — `debounce.cancel()` en ReaderView sin efecto real
**Archivo:** `client/src/components/ReaderView.jsx` (líneas 154-157)
**Problema:** El cleanup del `useEffect` llama `debouncedSave.cancel()` pero la función debounce devuelta puede no tener el método `.cancel()` correctamente vinculado.
**Solución:** Verificar la implementación de debounce y asegurar que `.cancel()` limpia el timeout correctamente.

---

### B-5 — Fullscreen en documento completo en vez del contenedor
**Archivo:** `client/src/components/ReaderView.jsx`
**Código:** `document.documentElement.requestFullscreen()`
**Problema:** Pone en fullscreen toda la página en vez de solo el visor de imágenes.
**Solución:** Usar `containerRef.current.requestFullscreen()` para fullscreen solo del contenedor del lector.

---

### B-6 — Sin helmet middleware en Express
**Archivo:** `server/src/index.js`
**Problema:** No se usa `helmet`, un middleware que agrega headers de seguridad HTTP automáticamente (CSP, X-Frame-Options, etc.).
**Solución:** `npm install helmet` y `app.use(helmet())`

---

## 📊 Resumen por categoría

| Categoría | Cantidad | IDs |
|-----------|----------|-----|
| 🔴 **Seguridad — Path Traversal** | 1 | C-1 |
| 🔴 **Git / Repo** | 2 | C-2, C-3 |
| 🟠 **Configuración** | 1 | A-1 |
| 🟠 **Git / Repo** | 1 | A-2 |
| 🟠 **Seguridad — Autenticación** | 1 | A-3 |
| 🟠 **Código duplicado** | 1 | A-4 |
| 🟠 **Funcionalidad deshabilitada** | 1 | A-5 |
| 🟡 **Logging** | 1 | M-1 |
| 🟡 **Código inconsistente** | 1 | M-2 |
| 🟡 **Seguridad — Headers** | 1 | M-3 |
| 🟡 **Dependencias** | 1 | M-4 |
| 🟡 **Testing** | 1 | M-5 |
| 🟢 **Calidad de código** | 6 | B-1 a B-6 |

---

## 🚀 Acciones inmediatas (código)

### 1. Arreglar Path Traversal (C-1 + A-4)
```javascript
// En server/src/routes/images.js:
// ✅ AGREGAR al inicio:
import { sanitizePath } from '../utils/pathSanitizer.js';
// ❌ ELIMINAR la función inline sanitizePath() ~líneas 36-54
// ✅ REEMPLAZAR en cada handler:
//   Antes: const sanitizedPath = sanitizePath(requestedPath);
//   Después: const sanitizedPath = sanitizePath(requestedPath, BASE_DIR);
```

### 2. Reactivar File Watcher (A-5)
```javascript
// En server/src/index.js, línea 106:
// ❌ Antes: // setupFileWatcher(IMAGES_DIR, server);
// ✅ Después:
setupFileWatcher(IMAGES_DIR, server);
```

### 3. Agregar Helmet (B-6)
```bash
cd server && npm install helmet
```
```javascript
// En server/src/index.js:
import helmet from 'helmet';
app.use(helmet());
```

### 4. Limpiar Git (C-2, C-3, A-2)
```bash
# Agregar al .gitignore
echo "" >> .gitignore
echo "# Archivos no deseados en repo" >> .gitignore
echo "-w" >> .gitignore
echo "session-*.md" >> .gitignore
echo "server/*.log" >> .gitignore

# Purgar del historial
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env -w session-ses_1bc7.md server/server.log" \
  --prune-empty --tag-name-filter cat -- --all

# Forzar push al remote
git push origin --force --all
```

---

*Documento generado a partir de FORENSIC_AUDIT.md — 25/05/2026 23:20 GMT-5*
