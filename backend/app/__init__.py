"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ AI - Maritime Intelligence Platform
Flask Application Factory
"""
import os
from flask import Flask, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .extensions import db
from config import config



def create_app(config_name=None):
    """Application factory pattern."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Create upload directory
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Initialize extensions
    db.init_app(app)
    JWTManager(app)
    CORS(app,
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         expose_headers=['Content-Type', 'Authorization'],
    )
    # Allow all Vercel preview URLs via wildcard
    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin', '')
        if origin.endswith('.vercel.app') or origin in ['http://localhost:5173', 'http://localhost:3000']:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return response
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.vessels import vessels_bp
    from .routes.voyages import voyages_bp
    from .routes.reports import reports_bp
    from .routes.analytics import analytics_bp
    from .routes.claims import claims_bp
    from .routes.optimization import optimization_bp
    from .routes.copilot import copilot_bp
    from .routes.weather import weather_bp
    from .routes.uploads import uploads_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(vessels_bp, url_prefix='/api/vessels')
    app.register_blueprint(voyages_bp, url_prefix='/api/voyages')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(claims_bp, url_prefix='/api/claims')
    app.register_blueprint(optimization_bp, url_prefix='/api/optimization')
    app.register_blueprint(copilot_bp, url_prefix='/api/copilot')
    app.register_blueprint(weather_bp, url_prefix='/api/weather')
    app.register_blueprint(uploads_bp, url_prefix='/api/uploads')
    
    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'service': 'VoyageIQ API', 'version': '1.0.0'}
    
    with app.app_context():
        try:
            # checkfirst=True prevents duplicate type errors on PostgreSQL
            db.create_all(checkfirst=True)
        except Exception as e:
            print(f"db.create_all warning (continuing): {e}")
            try:
                db.session.rollback()
                db.create_all(checkfirst=True)
            except Exception:
                pass
        _seed_demo_data()
    
    return app


def _seed_demo_data():
    """Seed database with realistic demo data."""
    from .models import User, Vessel, Voyage, NoonReport, Claim, FuelAnalytic
    from .utils.seed_data import generate_seed_data
    
    if User.query.first() is None:
        try:
            generate_seed_data()
        except Exception as e:
            print(f"Seed data error (non-fatal): {e}")
