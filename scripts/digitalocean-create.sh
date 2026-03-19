#!/bin/bash
# Create DigitalOcean droplets for VPN Control API
# Prerequisites: doctl configured (doctl auth init)
# Usage: ./scripts/digitalocean-create.sh

set -e

DROPLET_SIZE=s-1vcpu-1gb
IMAGE=ubuntu-22-04-x64
REGION=nyc1

echo "Creating Control API droplet..."
doctl compute droplet create vpn-control-api \
  --size $DROPLET_SIZE \
  --image $IMAGE \
  --region $REGION \
  --enable-ipv6 \
  --tag-names vpn,control-api

echo "Creating VPN server droplet..."
doctl compute droplet create vpn-wireguard-1 \
  --size $DROPLET_SIZE \
  --image $IMAGE \
  --region $REGION \
  --enable-ipv6 \
  --tag-names vpn,wireguard

echo "Droplets created. Next steps:"
echo "1. SSH into droplets and run scripts/wireguard-setup.sh on vpn-wireguard-1"
echo "2. Install Node.js, PostgreSQL, Redis on vpn-control-api"
echo "3. Deploy app with scripts/deploy.sh"
