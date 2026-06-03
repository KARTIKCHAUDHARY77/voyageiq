#!/bin/bash
# VoyageIQ AI — Backend Setup Script
# Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.

echo "🚢 VoyageIQ AI — Backend Setup"
echo "================================"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
echo "✅ Python version: $PYTHON_VERSION"

# Warn if Python 3.13+
if python3 -c "import sys; exit(0 if sys.version_info < (3,13) else 1)" 2>/dev/null; then
    echo "✅ Python version compatible"
else
    echo "⚠️  Python 3.13 detected — using compatible package versions"
fi

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip -q

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete! Starting backend..."
    echo "🌐 API running at: http://localhost:5000"
    echo ""
    python run.py
else
    echo ""
    echo "❌ Installation failed. Trying with relaxed versions..."
    pip install Flask Flask-CORS Flask-JWT-Extended Flask-SQLAlchemy \
        psycopg2-binary SQLAlchemy marshmallow pandas numpy scikit-learn \
        openpyxl PyPDF2 pdfplumber reportlab python-dotenv requests \
        openai Werkzeug Pillow joblib python-dateutil gunicorn
    python run.py
fi
