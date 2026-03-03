"""add student_groups junction table for multi-section support

Revision ID: c7d8e9f0a1b2
Revises: 2cc34372e0e1
Create Date: 2025-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = '2cc34372e0e1'
branch_labels = None
depends_on = None


def upgrade():
    # Check if table exists before creating
    from sqlalchemy import inspect
    from alembic import context
    
    conn = context.get_bind()
    inspector = inspect(conn)
    
    if 'student_groups' not in inspector.get_table_names():
        # Create student_groups junction table
        op.create_table(
            'student_groups',
            sa.Column('student_id', sa.String(length=50), nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['student_id'], ['students.student_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('student_id', 'group_id')
        )
        
        # Create index for faster lookups
        op.create_index('idx_student_groups_student', 'student_groups', ['student_id'])
        op.create_index('idx_student_groups_group', 'student_groups', ['group_id'])
        
        # Migrate existing data from students.group_id to student_groups
        # This ensures backward compatibility
        op.execute("""
            INSERT INTO student_groups (student_id, group_id, created_at)
            SELECT student_id, group_id, NOW()
            FROM students
            WHERE group_id IS NOT NULL
        """)


def downgrade():
    # Drop indexes first
    op.drop_index('idx_student_groups_group', 'student_groups')
    op.drop_index('idx_student_groups_student', 'student_groups')
    
    # Drop student_groups table
    op.drop_table('student_groups')
