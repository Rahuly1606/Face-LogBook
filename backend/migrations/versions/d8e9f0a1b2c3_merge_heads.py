"""merge heads

Revision ID: d8e9f0a1b2c3
Revises: a1b2c3d4e5f6, c7d8e9f0a1b2
Create Date: 2026-03-03 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd8e9f0a1b2c3'
down_revision = ('a1b2c3d4e5f6', 'c7d8e9f0a1b2')
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge migration, no operations needed
    pass


def downgrade():
    # This is a merge migration, no operations needed
    pass
