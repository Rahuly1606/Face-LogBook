"""add_registration_links_table

Revision ID: a1b2c3d4e5f6
Revises: 2cc34372e0e1
Create Date: 2026-03-03 00:00:00.000000

Adds the `registration_links` table used for student self-registration.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'a1b2c3d4e5f6'
down_revision = '2cc34372e0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'registration_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('registration_links', schema=None) as batch_op:
        batch_op.create_index('ix_registration_links_group_id', ['group_id'], unique=False)
        batch_op.create_index('ix_registration_links_token', ['token'], unique=True)


def downgrade():
    with op.batch_alter_table('registration_links', schema=None) as batch_op:
        batch_op.drop_index('ix_registration_links_token')
        batch_op.drop_index('ix_registration_links_group_id')

    op.drop_table('registration_links')
