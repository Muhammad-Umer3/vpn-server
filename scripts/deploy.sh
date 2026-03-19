#!/bin/bash
# DigitalOcean deployment script for VPN Control API
# Prerequisites: doctl, docker (for building image)
# Usage: ./scripts/deploy.sh [droplet-name]

set -e

DROPLET_NAME=${1:-vpn-control-api}
IMAGE_NAME=vpn-control-api

echo "Building..."
npm run build

echo "Building Docker image..."
docker build -t $IMAGE_NAME -f docker/Dockerfile .

echo "Tagging for DigitalOcean Container Registry..."
# doctl registry login (run once)
# docker tag $IMAGE_NAME registry.digitalocean.com/YOUR_REGISTRY/$IMAGE_NAME
# docker push registry.digitalocean.com/YOUR_REGISTRY/$IMAGE_NAME

echo "Deploy complete. Next steps:"
echo "1. Push image to DigitalOcean Container Registry"
echo "2. Create/update App Platform app or Droplet with the image"
echo "3. Set env vars: DATABASE_URL, REDIS_URL, JWT_SECRET, WG_*"
echo "4. Run db/schema.sql on your PostgreSQL instance"
