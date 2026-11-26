"""noon_reports.report_time is nullable: unknown is NULL, not the current time

Revision ID: b7e2c91a40d3
Revises: dfb40a137b82
Create Date: 2026-11-26

Manual entry and file imports used to fill a missing report time with the moment the
report was *entered*, which is a fabricated value. A report without a time now stores NULL.

Downgrade restores NOT NULL, which is only possible if no row has a NULL time.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7e2c91a40d3'
down_revision = 'dfb40a137b82'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('noon_reports', schema=None) as batch_op:
        batch_op.alter_column('report_time', existing_type=sa.Time(), nullable=True)


def downgrade():
    nulls = op.get_bind().execute(sa.text('SELECT COUNT(*) FROM noon_reports WHERE report_time IS NULL')).scalar()
    if nulls:
        raise RuntimeError(
            f'{nulls} noon report(s) have no report time. Set a time on them (or delete them) '
            'before downgrading; NOT NULL cannot be restored otherwise.')
    with op.batch_alter_table('noon_reports', schema=None) as batch_op:
        batch_op.alter_column('report_time', existing_type=sa.Time(), nullable=False)
