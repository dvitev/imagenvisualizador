# Visor de Imágenes - Manga Reader Pro

Aplicación web local cliente-servidor para visualizar volúmenes masivos de imágenes organizadas en carpetas anidadas, con un visor tipo lector de manga profesional.

![Versión](https://img.shields.io/badge/versión-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![Licencia](https://img.shields.io/badge/licencia-MIT-yellow)

## 📖 Índice

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [Atajos de Teclado](#-atajos-de-teclado)
- [Optimizaciones](#-optimizaciones)
- [Solución de Problemas](#-solución-de-problemas)

---

## ✨ Características

### Backend (Node.js/Express)

| Característica | Descripción |
|---------------|-------------|
| 🔄 Escaneo asíncrono | Lectura recursiva sin bloquear |
| 📊 Metadatos con Sharp | Width, height, size de cada imagen |
| 🖼️ Thumbnails al vuelo | Redimensionamiento con Sharp |
| 📦 Soporte CBZ/ZIP | Lectura de archivos comprimidos sin extraer |
| 🌳 Estructura Tree | API jerárquica recursiva |
| 🔔 WebSocket en tiempo real | Notificaciones de cambios en filesystem |
| 📝 Logging con Pino | Logs estructurados y bonitos |
| 🔐 Basic Auth | Autenticación opcional |
| 🛡️ Sanitización de rutas | Prevención de Path Traversal |

### Frontend (React + Vite)

| Característica | Descripción |
|---------------|-------------|
| 📖 Modo Manga Reader | Scroll vertical continuo |
| 📄 Modo Paginado | Una página por vez |
| 🖼️ Doble Página (Spread) | Dos páginas side-by-side |
| 🔍 Zoom y Pan | Double-click, pinch, drag |
| 👆 Gestos Táctiles | Swipe para navegar |
| 📚 Navegación entre Capítulos | Banner de navegación |
| 💾 Persistencia de Progreso | localStorage con timestamp |
| 📖 Continuar Leyendo | Sección con últimas lecturas |
| ✓ Estado Leído/En progreso | Iconos y barras en carpetas |
| 🌓 Tema Oscuro/Claro | Toggle con persistencia |
| 🌳 Vista de Árbol | Navegación jerárquica |
| ⚠️ Error Boundaries | Manejo elegante de errores |

---

## 🛠 Requisitos

- **Node.js** >= 18.0.0
- **npm** o **yarn**
- **Navegador moderno** (Chrome, Firefox, Edge, Safari)

---

## 📦 Instalación

### Opción A: Docker (Recomendado)

```bash
# 1. Configurar docker-compose.yml
# Edita la línea de volúmenes con tu ruta de imágenes
# volumes:
#   - /ruta/a/tus/imagenes:/data:ro

# 2. Construir y ejecutar
docker-compose up -d --build

# 3. Acceder
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
```

### Opción B: Manual

### 1. Instalar dependencias

```bash
# Raíz
npm run install:all

# O manualmente
cd server && npm install
cd ../client && npm install
```

### 2. Configurar `.env`

```env
IMAGES_DIR=C:/MiCarpetaDeFotos
PORT=3001
HOST=0.0.0.0
ENABLE_AUTH=false
AUTH_USER=admin
AUTH_PASS=changeme
LOG_LEVEL=info
NODE_ENV=development
```

### 3. Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

---

## 🔌 API Endpoints

### Structure

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/structure` | Carpetas agrupadas con metadatos |
| `GET /api/structure/flat` | Array plano con metadatos |
| `GET /api/structure/tree` | Árbol jerárquico recursivo |

**Response `/api/structure`:**
```json
[
  {
    "folder": "capitulo-1",
    "images": [
      {
        "fileName": "001.jpg",
        "relativePath": "capitulo-1/001.jpg",
        "width": 1200,
        "height": 1800,
        "size": 245678,
        "isArchive": false
      }
    ]
  }
]
```

### Images

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/image/:path` | Imagen original |
| `GET /api/thumb/:path` | Thumbnail 300px webp |
| `GET /api/archive/:path?page=0` | Página de archivo CBZ |

**Headers de caché:**
```
/api/image → Cache-Control: max-age=86400
/api/thumb → Cache-Control: max-age=604800
/api/archive → Cache-Control: max-age=3600
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001/ws')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'structure-updated') {
    console.log('Estructura actualizada:', data.totalItems)
  }
}
```

---

## ⌨️ Atajos de Teclado

### Globales

| Tecla | Acción |
|-------|--------|
| `Ctrl + F` | Buscar carpeta |
| `Alt + T` | Cambiar tema |

### ReaderView

| Tecla | Acción |
|-------|--------|
| `ESC` | Cerrar / Salir de fullscreen |
| `F` | Toggle fullscreen |
| `Espacio` | Play/Pause auto-scroll |
| `Home` | Ir al inicio |
| `End` | Ir al final |
| `S` | Toggle modo Scroll/Paginated |
| `D` | Toggle Doble Página |
| `Z` | Toggle Zoom |
| `←` `→` | Navegar (modo paginado) |

---

## 💾 Persistencia

### Progreso de Lectura

```javascript
// localStorage key: manga-reader-progress
{
  "capitulo-1": {
    "lastIndex": 15,
    "totalImages": 50,
    "timestamp": 1234567890,
    "percent": 32
  }
}
```

### Tema

```javascript
// localStorage key: manga-reader-theme
"dark" // o "light"
```

---

## 🐛 Solución de Problemas

### El servidor no inicia

```
❌ IMAGES_DIR no está definida
```

**Solución:** Configurar `.env` con la ruta correcta.

---

### WebSocket no conecta

Verifica que el puerto esté abierto y que el frontend use la URL correcta:

```javascript
const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws`)
```

---

### Error en thumbnails

```
Error processing thumbnail: Input buffer contains unsupported image format
```

**Solución:** El archivo puede estar corrupto. Se sirve la imagen original como fallback.

---

### Progreso no se guarda

Verifica que localStorage esté habilitado en el navegador. Algunos modos incógnito lo bloquean.

---

## 📊 Métricas

| Métrica | Objetivo |
|---------|----------|
| Escaneo inicial | < 60s para 10k imágenes |
| Thumbnail generation | < 100ms por imagen |
| WebSocket latency | < 50ms |
| FPS en scroll | 60 FPS |
| Memoria RAM | < 300MB |

---

## 🔐 Seguridad

### Path Traversal Prevention

```javascript
// Bloquea: ../etc/passwd
// Bloquea: C:\Windows\System32
// Permite: carpeta/imagen.jpg
```

### Rate Limiting

```
100 requests/segundo por IP
```

### Basic Auth (Opcional)

```env
ENABLE_AUTH=true
AUTH_USER=admin
AUTH_PASS=tu_password_seguro
```

---

## 🧪 Testing

```bash
# Backend tests
cd server && npm test

# Frontend tests
cd client && npm test
```

---

**Desarrollado con ❤️ usando Node.js, Express, React, Vite, Sharp y WebSocket**
