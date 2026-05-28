import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// Crear directorio temporal de pruebas y setear IMAGES_DIR
// ANTES de importar el servidor (images.js lee IMAGES_DIR al cargarse)
const TEST_IMAGES_DIR = join(process.cwd(), '__test_images__')

if (!process.env.IMAGES_DIR) {
  // Fallback: crear directorio temporal para los tests
  if (!existsSync(TEST_IMAGES_DIR)) {
    mkdirSync(TEST_IMAGES_DIR, { recursive: true })
    writeFileSync(resolve(TEST_IMAGES_DIR, 'test.jpg'), 'fake-jpeg-data')
    writeFileSync(resolve(TEST_IMAGES_DIR, 'test.png'), 'fake-png-data')
  }
  process.env.IMAGES_DIR = TEST_IMAGES_DIR
}

// Nota: Al importar index.js, VITEST previene que el servidor arranque.
// Creamos un servidor local para los tests.
let server = null
const TEST_PORT = 0 // puerto aleatorio
const BASE_URL = 'http://127.0.0.1'

function getApp() {
  // Carga diferida para evitar side effects al importar el módulo
  return import('../index.js').then(m => m.default)
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `${BASE_URL}:${server?.address()?.port || 3001}`)
    const req = http.request(url, { method }, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body ? tryParse(body) : null
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function tryParse(str) {
  try { return JSON.parse(str) } catch { return str }
}

beforeAll(async () => {
  const app = await getApp()
  return new Promise((resolve) => {
    server = http.createServer(app)
    server.listen(TEST_PORT, '127.0.0.1', resolve)
  })
})

afterAll(() => {
  return new Promise((resolve) => {
    if (server) server.close(() => {
      // Limpiar directorio de prueba creado por este test
      if (process.env.IMAGES_DIR === TEST_IMAGES_DIR && existsSync(TEST_IMAGES_DIR)) {
        rmSync(TEST_IMAGES_DIR, { recursive: true, force: true })
        delete process.env.IMAGES_DIR
      }
      resolve()
    })
  })
})

describe('GET /api/health', () => {
  it('devuelve 200 con status ok', async () => {
    const res = await request('GET', '/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('uptime')
    expect(res.body).toHaveProperty('timestamp')
  })
})

describe('GET /api/structure/stats', () => {
  it('devuelve 200 con estadísticas del escaneo', async () => {
    const res = await request('GET', '/api/structure/stats')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('maxItems')
    expect(res.body).toHaveProperty('truncated')
    expect(res.body).toHaveProperty('lastScanTime')
    expect(res.body).toHaveProperty('lastScanItemCount')
  })
})

describe('GET /api/structure', () => {
  it('devuelve 200 con array de carpetas', async () => {
    const res = await request('GET', '/api/structure')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('incluye header X-Cache', async () => {
    const res = await request('GET', '/api/structure')
    expect(res.headers['x-cache']).toMatch(/HIT|MISS/)
  })
})

describe('GET /api/structure/tree', () => {
  it('devuelve 200 con árbol jerárquico', async () => {
    const res = await request('GET', '/api/structure/tree')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name')
    expect(res.body).toHaveProperty('children')
  })
})

describe('GET /api/structure/flat — paginación', () => {
  it('devuelve status 200 sin parámetros', async () => {
    const res = await request('GET', '/api/structure/flat')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    // Sin parámetros debe paginar por defecto
    expect(res.body.length).toBeLessThanOrEqual(500)
  })

  it('rechaza limit > 2000 con status 400', async () => {
    const res = await request('GET', '/api/structure/flat?limit=5000')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'Page size too large')
  })

  it('incluye headers de paginación', async () => {
    const res = await request('GET', '/api/structure/flat?page=0&limit=10')
    expect(res.status).toBe(200)
    expect(res.headers['x-total-items']).toBeDefined()
    expect(res.headers['x-page']).toBe('0')
  })
})

describe('GET /api/image/* — imagen inexistente', () => {
  it('devuelve 404 para ruta inválida', async () => {
    const res = await request('GET', '/api/image/no_existe_xyz123.jpg')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/thumb/* — thumbnail inexistente', () => {
  it('devuelve 404 para ruta inválida', async () => {
    const res = await request('GET', '/api/thumb/no_existe_xyz123.jpg')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/structure/flat — query nopaginate', () => {
  it('devuelve array completo con ?nopaginate=true', async () => {
    const res = await request('GET', '/api/structure/flat?nopaginate=true')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
