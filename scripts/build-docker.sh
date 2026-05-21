#!/bin/bash

# Manga Reader Pro - Docker Build & Run Script

set -e

echo "🔨 Building Manga Reader Pro..."

# Build and start all services
docker-compose up -d --build

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Services:"
echo "   - Client (Nginx): http://localhost:3000"
echo "   - Server (API): http://localhost:3001"
echo ""
echo "📋 Useful commands:"
echo "   docker-compose logs -f          # View logs"
echo "   docker-compose down             # Stop services"
echo "   docker-compose restart          # Restart services"
echo ""
