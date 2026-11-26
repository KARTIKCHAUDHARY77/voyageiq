"""
Migrations are the only way the production schema is created, so they are tested:
they must build the schema from nothing, match the models exactly (no drift), and
be reversible.
"""
import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, text

from app.extensions import db


@pytest.fixture
def empty_database(app):
    """A database with no tables at all, as on a first deploy."""
    def wipe():
        db.drop_all()
        # Not part of the models, so drop_all() leaves it behind. A stale version
        # row would make upgrade() think the schema is already in place.
        db.session.execute(text("DROP TABLE IF EXISTS alembic_version"))
        db.session.commit()
        db.session.remove()

    with app.app_context():
        wipe()
        yield
        wipe()


def _tables():
    return set(inspect(db.engine).get_table_names()) - {"alembic_version"}


def test_upgrade_creates_the_schema_from_nothing(app, empty_database):
    with app.app_context():
        assert _tables() == set()
        upgrade()
        assert {"users", "vessels", "voyages", "noon_reports", "claims", "token_blocklist"} <= _tables()


def test_migrated_schema_matches_models(app, empty_database):
    """If this fails, a model changed without a migration (run `flask db migrate`)."""
    with app.app_context():
        upgrade()
        with db.engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), db.metadata)
        assert diff == [], f"Models and migrations disagree: {diff}"


def test_downgrade_removes_everything(app, empty_database):
    with app.app_context():
        upgrade()
        downgrade(revision="base")
        assert _tables() == set()
