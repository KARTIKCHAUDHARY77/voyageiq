#!/bin/sh
# VoyageIQ AI - Production Start Script
#
# Order matters: schema first, then accounts, then the web server.
# Run a single instance at deploy time (or run the two flask commands as a
# release step) so two replicas never apply migrations at the same moment.
set -e
PORT="${PORT:-8000}"
export FLASK_APP="app:create_app"
export FLASK_ENV="${FLASK_ENV:-production}"

echo "Applying database migrations"
python -m flask db upgrade

echo "Bootstrapping accounts"
python -m flask bootstrap

echo "Starting VoyageIQ API on port $PORT"
exec python -m gunicorn "app:create_app('production')" \
    --bind "0.0.0.0:${PORT}" \
    --workers 2 \
    --timeout 120 \
    --preload \
    --log-level info
