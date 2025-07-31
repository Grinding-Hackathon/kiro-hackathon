#!/bin/bash

# SSL Certificate Setup Script
# This script sets up SSL certificates for production deployment

set -e

DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}
SSL_DIR="./infrastructure/nginx/ssl"

echo "🔐 Setting up SSL certificates for domain: $DOMAIN"

# Create SSL directory
mkdir -p $SSL_DIR

# Check if Let's Encrypt certificates exist
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Let's Encrypt certificates found, copying..."
    
    # Copy Let's Encrypt certificates
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/key.pem
    
    echo "✅ SSL certificates copied successfully"
    
else
    echo "⚠️  Let's Encrypt certificates not found. Generating self-signed certificates for development..."
    
    # Generate self-signed certificate for development/testing
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $SSL_DIR/key.pem \
        -out $SSL_DIR/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    echo "⚠️  Self-signed certificate generated. For production, use Let's Encrypt:"
    echo "   sudo certbot certonly --standalone -d $DOMAIN -m $EMAIL --agree-tos"
fi

# Set proper permissions
chmod 600 $SSL_DIR/key.pem
chmod 644 $SSL_DIR/cert.pem

# Generate Diffie-Hellman parameters for enhanced security
if [ ! -f "$SSL_DIR/dhparam.pem" ]; then
    echo "🔑 Generating Diffie-Hellman parameters (this may take a while)..."
    openssl dhparam -out $SSL_DIR/dhparam.pem 2048
    echo "✅ Diffie-Hellman parameters generated"
fi

# Create certificate renewal script for Let's Encrypt
cat > ./scripts/renew-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Renewal Script
set -e

DOMAIN=${1:-"your-domain.com"}
SSL_DIR="./infrastructure/nginx/ssl"

echo "🔄 Renewing SSL certificates for $DOMAIN"

# Renew certificates
certbot renew --quiet

# Copy renewed certificates
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/key.pem
    
    # Reload nginx
    docker-compose -f infrastructure/docker-compose.prod.yml exec nginx nginx -s reload
    
    echo "✅ SSL certificates renewed and nginx reloaded"
else
    echo "❌ Certificate renewal failed"
    exit 1
fi
EOF

chmod +x ./scripts/renew-ssl.sh

echo "✅ SSL setup completed!"
echo "📋 Next steps:"
echo "1. For production, obtain Let's Encrypt certificates:"
echo "   sudo certbot certonly --standalone -d $DOMAIN -m $EMAIL --agree-tos"
echo "2. Set up automatic renewal with cron:"
echo "   0 2 * * * /path/to/renew-ssl.sh $DOMAIN"
echo "3. Update nginx configuration with your actual domain name"