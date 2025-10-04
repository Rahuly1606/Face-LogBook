"""Add import_jobs table for background bulk imports

Revision ID: c1a2b3c4d5e6
Revises: b9af6984ff95
Create Date: 2025-10-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1a2b3c4d5e6'
down_revision = 'b9af6984ff95'
branch_labels = None
depends_on = None


def upgrade():
    # Create import_jobs table
    op.create_table('import_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('total_records', sa.Integer(), nullable=True),
        sa.Column('processed_records', sa.Integer(), nullable=True),
        sa.Column('successful_records', sa.Integer(), nullable=True),
        sa.Column('failed_records', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('successes', sa.Text(), nullable=True),
        sa.Column('failures', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('import_jobs')
