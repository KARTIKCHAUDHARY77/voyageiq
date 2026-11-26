"""require organization_id; unique imo and voyage number per organization

Contract step of multi-tenancy. After this, no company-owned row can exist without an
organization, and IMO / voyage numbers are unique per organization instead of globally.

Upgrade refuses to run (with an explanation) if any row has no organization: assign
those rows to an organization first. Downgrade fails if two organizations by then
hold the same IMO number, because the old global constraint cannot hold both.

Revision ID: dfb40a137b82
Revises: c0e6cdc3a6e2
Create Date: 2026-11-26 03:49:08.846534

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dfb40a137b82'
down_revision = 'c0e6cdc3a6e2'
branch_labels = None
depends_on = None


OWNED_TABLES = ('claims', 'copilot_conversations', 'fuel_analytics', 'noon_reports',
                'report_uploads', 'routes', 'vessel_positions', 'vessels', 'voyages')


def _refuse_if_orphans():
    bind = op.get_bind()
    for table in OWNED_TABLES:
        orphans = bind.execute(sa.text(f'SELECT COUNT(*) FROM {table} WHERE organization_id IS NULL')).scalar()
        if orphans:
            raise RuntimeError(
                f'{orphans} row(s) in {table} have no organization_id. Assign them to an '
                f'organization before running this migration.')


def upgrade():
    _refuse_if_orphans()
    with op.batch_alter_table('claims', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('copilot_conversations', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('fuel_analytics', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('noon_reports', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('report_uploads', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('routes', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    with op.batch_alter_table('vessel_positions', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)

    # PostgreSQL names the old global constraint itself. SQLite stored it unnamed, so a
    # naming convention gives the reflected constraint a name we can drop.
    old_imo_unique = ('vessels_imo_number_key' if op.get_bind().dialect.name == 'postgresql'
                      else 'uq_vessels_imo_number')
    with op.batch_alter_table('vessels', schema=None,
                              naming_convention={'uq': 'uq_%(table_name)s_%(column_0_name)s'}) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)
        batch_op.drop_constraint(old_imo_unique, type_='unique')
        batch_op.create_unique_constraint('uq_vessels_org_imo', ['organization_id', 'imo_number'])

    with op.batch_alter_table('voyages', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=False)
        batch_op.create_unique_constraint('uq_voyages_org_number', ['organization_id', 'voyage_number'])



def downgrade():
    with op.batch_alter_table('voyages', schema=None) as batch_op:
        batch_op.drop_constraint('uq_voyages_org_number', type_='unique')
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('vessels', schema=None) as batch_op:
        batch_op.drop_constraint('uq_vessels_org_imo', type_='unique')
        batch_op.create_unique_constraint('vessels_imo_number_key', ['imo_number'])
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('vessel_positions', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('routes', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('report_uploads', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('noon_reports', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('fuel_analytics', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('copilot_conversations', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

    with op.batch_alter_table('claims', schema=None) as batch_op:
        batch_op.alter_column('organization_id',
               existing_type=sa.VARCHAR(length=36),
               nullable=True)

