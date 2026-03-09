#!/bin/bash
# Bootstrap Let's Encrypt certificates.
# Run this ONCE on the server before `docker compose up -d`.
# Requires: DNS for extendedsavasana.com pointing to this server.

set -e

DOMAINS=(extendedsavasana.com www.extendedsavasana.com)
EMAIL="your@email.com"   # <-- replace with your email
STAGING=0                # Set to 1 to test against staging CA (avoids rate limits)

DATA_PATH="./certbot"

# ── Check DNS is pointed here before proceeding ──────────────────────────────
echo "### Checking DNS for ${DOMAINS[0]} ..."
RESOLVED=$(dig +short "${DOMAINS[0]}" A | tail -n1)
SERVER_IP=$(curl -s https://api.ipify.org)
if [ "$RESOLVED" != "$SERVER_IP" ]; then
    echo ""
    echo "WARNING: ${DOMAINS[0]} resolves to $RESOLVED but this server is $SERVER_IP"
    echo "Make sure your DNS A record points to this server before continuing."
    echo "Press Ctrl-C to abort, or Enter to continue anyway."
    read -r
fi

# ── Skip if cert already exists ───────────────────────────────────────────────
if [ -d "$DATA_PATH/conf/live/${DOMAINS[0]}" ]; then
    echo "Certificate already exists at $DATA_PATH/conf/live/${DOMAINS[0]}."
    echo "To force renewal, run: docker compose run --rm certbot renew --force-renewal"
    exit 0
fi

# ── Download recommended TLS parameters ───────────────────────────────────────
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
    echo "### Downloading recommended TLS parameters ..."
    mkdir -p "$DATA_PATH/conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
        -o "$DATA_PATH/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
        -o "$DATA_PATH/conf/ssl-dhparams.pem"
fi

# ── Create a temporary self-signed cert so nginx can start ───────────────────
echo "### Creating temporary self-signed certificate ..."
mkdir -p "$DATA_PATH/conf/live/${DOMAINS[0]}"
docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout /etc/letsencrypt/live/${DOMAINS[0]}/privkey.pem \
    -out /etc/letsencrypt/live/${DOMAINS[0]}/fullchain.pem \
    -subj '/CN=localhost'" certbot

# ── Start nginx with the dummy cert ──────────────────────────────────────────
echo "### Starting nginx ..."
docker compose up --force-recreate -d nginx
echo "Waiting for nginx to be ready ..."
sleep 5

# ── Delete the dummy cert and request the real one ───────────────────────────
echo "### Removing temporary certificate ..."
docker compose run --rm --entrypoint "rm -rf /etc/letsencrypt/live/${DOMAINS[0]} \
    /etc/letsencrypt/archive/${DOMAINS[0]} \
    /etc/letsencrypt/renewal/${DOMAINS[0]}.conf" certbot

echo "### Requesting Let's Encrypt certificate ..."
DOMAIN_ARGS=""
for d in "${DOMAINS[@]}"; do DOMAIN_ARGS="$DOMAIN_ARGS -d $d"; done

STAGING_ARG=""
[ "$STAGING" != "0" ] && STAGING_ARG="--staging"

docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    $DOMAIN_ARGS \
    --rsa-key-size 4096 \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

# ── Reload nginx with the real cert ──────────────────────────────────────────
echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo ""
echo "Done. SSL is live at https://extendedsavasana.com"
echo "Certificates will auto-renew every 12 hours via the certbot container."
