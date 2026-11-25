"""
Authentication routes: login, register, token refresh, logout, change password.
"""
import os
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import TokenBlocklist, User
from ..security import (
    SELF_REGISTER_ROLE,
    is_valid_email,
    limiter,
    normalize_email,
    password_problem,
)

auth_bp = Blueprint('auth', __name__)

# Verified against when the email is unknown, so a missing account and a wrong
# password take the same time and cannot be told apart.
_DUMMY_HASH = generate_password_hash('not-a-real-password')


def _token_response(user, status=200):
    return jsonify({
        'access_token': create_access_token(identity=user.id),
        'refresh_token': create_refresh_token(identity=user.id),
        'user': user.to_dict(),
    }), status


def _revoke(jwt_payload, user_id):
    db.session.add(TokenBlocklist(
        jti=jwt_payload['jti'], token_type=jwt_payload.get('type'), user_id=user_id))


def _registration_open():
    default = 'false' if current_app.config['PRODUCTION'] else 'true'
    return os.environ.get('ALLOW_REGISTRATION', default).lower() == 'true'


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute; 50 per hour')
def login():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get('email'))
    password = data.get('password')
    if not email or not isinstance(password, str) or not password:
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=email).first()
    if user is None:
        check_password_hash(_DUMMY_HASH, password)
        return jsonify({'error': 'Invalid credentials'}), 401
    if not user.check_password(password) or not user.is_active:
        return jsonify({'error': 'Invalid credentials'}), 401

    user.last_login = datetime.utcnow()
    db.session.commit()
    return _token_response(user)


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('5 per hour')
def register():
    if not _registration_open():
        return jsonify({'error': 'Registration is closed. Ask an administrator for an account.'}), 403

    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get('email'))
    password = data.get('password')

    if not is_valid_email(email):
        return jsonify({'error': 'A valid email address is required'}), 400
    problem = password_problem(password, email)
    if problem:
        return jsonify({'error': problem}), 400

    user = User(
        email=email,
        full_name=str(data.get('full_name') or '').strip()[:255] or email.split('@')[0],
        company_name=str(data.get('company_name') or '').strip()[:255],
        role=SELF_REGISTER_ROLE,  # never taken from the request body
    )
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Registration could not be completed'}), 409
    return _token_response(user, 201)


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user = db.session.get(User, get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
@limiter.limit('30 per hour')
def refresh():
    user = db.session.get(User, get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({'error': 'Account unavailable'}), 401
    return jsonify({'access_token': create_access_token(identity=user.id)})


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(verify_type=False)
def logout():
    """Revoke the presented token. Send the refresh token too to end the session fully."""
    _revoke(get_jwt(), get_jwt_identity())
    body = request.get_json(silent=True) or {}
    refresh_token = body.get('refresh_token')
    if isinstance(refresh_token, str) and refresh_token:
        try:
            decoded = decode_token(refresh_token)
            if decoded.get('sub') == get_jwt_identity() and decoded['jti'] != get_jwt()['jti']:
                _revoke(decoded, get_jwt_identity())
        except Exception:
            pass  # an invalid refresh token needs no revoking
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
    return jsonify({'message': 'Logged out'})


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
@limiter.limit('5 per hour')
def change_password():
    user = db.session.get(User, get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    current_pw, new_pw = data.get('current_password'), data.get('new_password')
    if not isinstance(current_pw, str) or not isinstance(new_pw, str):
        return jsonify({'error': 'current_password and new_password are required'}), 400
    if not user.check_password(current_pw):
        return jsonify({'error': 'Current password is incorrect'}), 401
    if current_pw == new_pw:
        return jsonify({'error': 'New password must differ from the current one'}), 400
    problem = password_problem(new_pw, user.email)
    if problem:
        return jsonify({'error': problem}), 400

    user.set_password(new_pw)
    _revoke(get_jwt(), user.id)  # this session's token; others expire within the access TTL
    db.session.commit()
    return jsonify({'message': 'Password updated. Please sign in again.'})
