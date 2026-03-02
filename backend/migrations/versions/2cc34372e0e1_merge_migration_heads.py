"""merge_migration_heads

Revision ID: 2cc34372e0e1
Revises: add_import_jobs_table, b9af6984ff95
Create Date: 2025-10-04 12:02:28.059037

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2cc34372e0e1'
down_revision = ('c1a2b3c4d5e6', 'b9af6984ff95')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
