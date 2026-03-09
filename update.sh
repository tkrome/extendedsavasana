#!/bin/bash
# Extended Savasana — maintenance update script
# Pulls latest base images, rebuilds app, prunes old layers.
# Safe to run while the site is live — docker compose does a rolling replace.

set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGFILE="/var/log/extended-savasana-update.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

log "=== Starting update ==="
cd "$COMPOSE_DIR"

# Pull latest versions of base images (nginx, certbot, node alpine)
log "Pulling base images..."
docker compose pull --quiet

# Rebuild the app image so it picks up the latest node:22-alpine patches
log "Rebuilding app..."
docker compose up -d --build --pull always

# Remove dangling images to reclaim disk space
log "Pruning old images..."
docker image prune -f

log "=== Update complete ==="
