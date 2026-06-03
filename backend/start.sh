#!/bin/sh
# VoyageIQ AI - Production Start Script
set -e
PORT="${PORT:-8000}"
echo "Starting VoyageIQ API on port $PORT"
exec python -m gunicorn "app:create_app('production')" \
    --bind "0.0.0.0:${PORT}" \
    --workers 1 \
    --timeout 120 \
    --preload \
    --log-level info
