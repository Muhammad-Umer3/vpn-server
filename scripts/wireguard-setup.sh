#!/bin/bash
# WireGuard server setup for Ubuntu 22.04 on DigitalOcean
# Run as root or with sudo

set -e

WG_INTERFACE=${WG_INTERFACE:-wg0}
WG_PORT=${WG_PORT:-51820}
WG_NETWORK=${WG_NETWORK:-10.0.0.0/24}
WG_SERVER_IP=${WG_SERVER_IP:-10.0.0.1}

echo "Installing WireGuard..."
apt-get update
apt-get install -y wireguard

echo "Generating server keys..."
cd /etc/wireguard
umask 077
wg genkey | tee server_private.key | wg pubkey > server_public.key

SERVER_PRIVATE=$(cat server_private.key)
SERVER_PUBLIC=$(cat server_public.key)

echo "Creating $WG_INTERFACE.conf..."
cat > $WG_INTERFACE.conf << EOF
[Interface]
Address = $WG_SERVER_IP/24
ListenPort = $WG_PORT
PrivateKey = $SERVER_PRIVATE
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF

echo "Enabling IP forwarding..."
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p

echo "Starting WireGuard..."
systemctl enable wg-quick@$WG_INTERFACE
systemctl start wg-quick@$WG_INTERFACE

echo ""
echo "=== WireGuard server configured ==="
echo "Server public key: $SERVER_PUBLIC"
echo "Add to .env:"
echo "  WG_SERVER_PUBLIC_KEY=$SERVER_PUBLIC"
echo "  WG_SERVER_ENDPOINT=<your-droplet-ip>:$WG_PORT"
echo "  WG_CONFIG_PATH=/etc/wireguard/$WG_INTERFACE.conf"
echo "  WG_NETWORK=$WG_NETWORK"
echo ""
