"""VoyageIQ API entry point."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app(os.environ.get('FLASK_ENV', 'production'))

if __name__ == '__main__':
    # Local development only. Production runs under gunicorn (see start.sh).
    port = int(os.environ.get('PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=app.config.get('DEBUG', False))
