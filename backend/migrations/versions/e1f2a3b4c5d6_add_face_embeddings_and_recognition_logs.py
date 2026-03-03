"""add face_embeddings and recognition_logs tables

Revision ID: e1f2a3b4c5d6
Revises: d8e9f0a1b2c3
Create Date: 2026-03-03 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = 'e1f2a3b4c5d6'
down_revision = 'd8e9f0a1b2c3'
branch_labels = None
depends_on = None


def _existing_tables():
    bind = op.get_bind()
    return Inspector.from_engine(bind).get_table_names()


def upgrade():
    existing = _existing_tables()

    # ── face_embeddings ────────────────────────────────────────────────────
    if 'face_embeddings' not in existing:
        op.create_table(
            'face_embeddings',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('student_id', sa.String(50), sa.ForeignKey('students.student_id', ondelete='CASCADE'), nullable=False),
            sa.Column('pose', sa.String(10), nullable=False),
            sa.Column('embedding', sa.LargeBinary(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint('student_id', 'pose', name='uq_student_pose'),
        )
        op.create_index('idx_face_embeddings_student', 'face_embeddings', ['student_id'])

        # Seed face_embeddings from existing students.embedding (treat as 'front' pose)
        op.execute("""
            INSERT INTO face_embeddings (student_id, pose, embedding, created_at)
            SELECT student_id, 'front', embedding, NOW()
            FROM students
            WHERE embedding IS NOT NULL
        """)

    # ── recognition_logs ───────────────────────────────────────────────────
    if 'recognition_logs' not in existing:
        op.create_table(
            'recognition_logs',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('student_id_predicted', sa.String(50), sa.ForeignKey('students.student_id', ondelete='SET NULL'), nullable=True),
            sa.Column('similarity_score', sa.Float(), nullable=True),
            sa.Column('second_best_score', sa.Float(), nullable=True),
            sa.Column('confidence_ratio', sa.Float(), nullable=True),
            sa.Column('detection_time_ms', sa.Integer(), nullable=True),
            sa.Column('embedding_time_ms', sa.Integer(), nullable=True),
            sa.Column('search_time_ms', sa.Integer(), nullable=True),
            sa.Column('total_time_ms', sa.Integer(), nullable=True),
            sa.Column('threshold', sa.Float(), nullable=True),
            sa.Column('result', sa.String(30), nullable=False, server_default='success'),
            sa.Column('source', sa.String(20), nullable=True),
            sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), index=True),
        )
        op.create_index('idx_recognition_logs_student', 'recognition_logs', ['student_id_predicted'])
        op.create_index('idx_recognition_logs_created', 'recognition_logs', ['created_at'])


def downgrade():
    existing = _existing_tables()
    if 'recognition_logs' in existing:
        op.drop_index('idx_recognition_logs_created', 'recognition_logs')
        op.drop_index('idx_recognition_logs_student', 'recognition_logs')
        op.drop_table('recognition_logs')
    if 'face_embeddings' in existing:
        op.drop_index('idx_face_embeddings_student', 'face_embeddings')
        op.drop_table('face_embeddings')
