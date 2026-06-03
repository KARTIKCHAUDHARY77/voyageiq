"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""VoyageIQ API - Entry Point"""
import os
import sys

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
