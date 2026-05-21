const CACHE_NAME = 'manga-reader-v2'
const STATIC_CACHE = 'static-v2'
const IMAGE_CACHE = 'images-v2'
const API_CACHE = 'api-v2'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== IMAGE_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
    return
  }

  if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request))
    return
  }

  event.respondWith(handleStaticRequest(request))
})

function isImageRequest(url) {
  const ext = url.pathname.toLowerCase().substring(url.pathname.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(ext) || url.pathname.includes('/api/image/') || url.pathname.includes('/api/thumb/')
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') && !url.pathname.includes('/api/image/') && !url.pathname.includes('/api/thumb/')
}

async function handleImageRequest(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

async function handleApiRequest(request) {
  const url = new URL(request.url)
  
  if (url.pathname.includes('/api/structure')) {
    const response = await fetch(request)
    return response
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    return new Response(JSON.stringify({ error: 'Offline', message: 'No hay conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleStaticRequest(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    if (request.destination === 'document') {
      return caches.match('/index.html')
    }
    throw error
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
