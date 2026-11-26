"""
VoyageIQ AI - Flask application factory.
"""
import logging
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

from .extensions import db, migrate
from .security import limiter
from config import config, resolve_secrets

DEMO_EMAILS = ('admin@voyageiq.com', 'captain@oceancargo.com', 'analyst@oceancargo.com')


def create_app(config_name=None):
    """Application factory pattern."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'production')

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    resolve_secrets(app.config, production=app.config['PRODUCTION'])
    if os.environ.get('FLASK_DEBUG') == '1' and not app.config['PRODUCTION']:
        app.config['DEBUG'] = True

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    db.init_app(app)
    limiter.init_app(app)
    jwt = JWTManager(app)

    # CORS: exact-match allowlist. The API authenticates with a bearer header,
    # not cookies, so credentials are not enabled.
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}},
        allow_headers=['Content-Type', 'Authorization'],
        methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        supports_credentials=False,
        max_age=600,
    )

    @jwt.token_in_blocklist_loader
    def _is_revoked(_header, payload):
        from .models import TokenBlocklist
        return db.session.query(TokenBlocklist.id).filter_by(jti=payload['jti']).first() is not None

    @jwt.expired_token_loader
    def _expired(_header, _payload):
        return jsonify({'error': 'Token expired'}), 401

    @jwt.invalid_token_loader
    def _invalid(_reason):
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def _missing(_reason):
        return jsonify({'error': 'Authentication required'}), 401

    @jwt.revoked_token_loader
    def _revoked(_header, _payload):
        return jsonify({'error': 'Token has been revoked'}), 401

    @app.after_request
    def security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'no-referrer')
        response.headers.setdefault('Cache-Control', 'no-store')
        if app.config['PRODUCTION']:
            response.headers.setdefault(
                'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        return response

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        if isinstance(err, HTTPException):
            return jsonify({'error': err.description}), err.code
        app.logger.error('Unhandled error: %s', err, exc_info=True)
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

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

    @app.route('/api/health')
    def health():
        return {'status': 'healthy'}

    # render_as_batch: migrations also run on SQLite (tests), which cannot ALTER constraints.
    migrate.init_app(app, db, render_as_batch=True)

    @app.cli.command('bootstrap')
    def bootstrap_command():
        """Create the first admin / lock demo accounts. Run after `flask db upgrade`."""
        _bootstrap_accounts(app)

    # Development and tests build the schema from the models. Everywhere else the
    # database is created and changed only by migrations, so a missing table is a
    # loud deployment error instead of something papered over at startup.
    if app.config['AUTO_CREATE_SCHEMA']:
        with app.app_context():
            db.create_all()
            _bootstrap_accounts(app)

    return app


def _bootstrap_accounts(app):
    """Seed demo data (opt-in), lock demo logins otherwise, and create the first admin."""
    from .models import User

    if app.config['SEED_DEMO_DATA']:
        if User.query.first() is None:
            try:
                from .utils.seed_data import generate_seed_data
                generate_seed_data()
                app.logger.warning('Demo data seeded. Do not use SEED_DEMO_DATA in production.')
            except Exception as e:
                db.session.rollback()
                app.logger.error('Seed data error: %s', e)
    else:
        # Accounts seeded by older versions share a published password.
        locked = User.query.filter(User.email.in_(DEMO_EMAILS), User.is_active.is_(True)).all()
        for u in locked:
            u.is_active = False
        if locked:
            db.session.commit()
            app.logger.warning('Deactivated %d demo account(s) with published passwords.', len(locked))

    admin_email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if admin_email and admin_password and not User.query.filter_by(role='admin', is_active=True).first():
        from .security import password_problem
        problem = password_problem(admin_password, admin_email)
        if problem:
            app.logger.error('ADMIN_PASSWORD rejected: %s', problem)
            return
        user = User.query.filter_by(email=admin_email).first() or User(
            email=admin_email, full_name='Administrator', company_name='')
        user.role = 'admin'
        user.is_active = True
        user.set_password(admin_password)
        db.session.add(user)
        db.session.commit()
        app.logger.warning('Bootstrap admin ready: %s. Remove ADMIN_PASSWORD from the environment.', admin_email)
