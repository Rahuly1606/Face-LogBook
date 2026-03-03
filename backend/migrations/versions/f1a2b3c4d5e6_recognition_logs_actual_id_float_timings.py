"""recognition_logs: add actual_student_id + float timing columns + metrics indexes

• actual_student_id (VARCHAR 50, FK → students.student_id, indexed)
  Stores ground-truth identity for evaluation / test mode so precision /
  recall / F1 can be computed from stored logs without re-running the pipeline.

• timing columns INTEGER → FLOAT
  Stores sub-millisecond values precisely (e.g. 0.43 ms for FAISS search on
  a warm index with < 500 vectors).

• Index on (created_at) already exists from e1f2a3b4c5d6; compound index
  ix_recognition_logs_result_created added here for the common analytics
  query pattern  WHERE result = 'TP'  ORDER BY created_at.

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-03-03 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# ── Alembic boilerplate ────────────────────────────────────────────────────────
revision = 'f1a2b3c4d5e6'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None

TABLE = 'recognition_logs'


def upgrade():
    inspector = Inspector.from_engine(op.get_bind())
    tables = inspector.get_table_names()

    if TABLE not in tables:
        # Table was never created — nothing to do (handled by e1f2a3b4c5d6)
        return

    existing_cols = {c['name'] for c in inspector.get_columns(TABLE)}
    existing_idx  = {i['name'] for i in inspector.get_indexes(TABLE)}

    # ── 1. Add actual_student_id ──────────────────────────────────────────────
    if 'actual_student_id' not in existing_cols:
        op.add_column(
            TABLE,
            sa.Column(
                'actual_student_id',
                sa.String(50),
                sa.ForeignKey('students.student_id', ondelete='SET NULL'),
                nullable=True,
            ),
        )

    # Index on actual_student_id
    if 'ix_recognition_logs_actual_student_id' not in existing_idx:
        op.create_index(
            'ix_recognition_logs_actual_student_id',
            TABLE,
            ['actual_student_id'],
        )

    # ── 2. Change integer timing columns to FLOAT ─────────────────────────────
    # MySQL requires MODIFY COLUMN; Alembic's alter_column handles the dialect.
    for col in ('detection_time_ms', 'embedding_time_ms', 'search_time_ms', 'total_time_ms'):
        if col in existing_cols:
            op.alter_column(
                TABLE,
                col,
                existing_type=sa.Integer(),
                type_=sa.Float(),
                nullable=True,
            )

    # ── 3. Compound index for analytics queries on result + date ──────────────
    if 'ix_recognition_logs_result_created' not in existing_idx:
        op.create_index(
            'ix_recognition_logs_result_created',
            TABLE,
            ['result', 'created_at'],
        )


def downgrade():
    inspector = Inspector.from_engine(op.get_bind())
    tables = inspector.get_table_names()

    if TABLE not in tables:
        return

    existing_idx = {i['name'] for i in inspector.get_indexes(TABLE)}

    # Remove compound index
    if 'ix_recognition_logs_result_created' in existing_idx:
        op.drop_index('ix_recognition_logs_result_created', table_name=TABLE)

    # Remove actual_student_id index + column
    if 'ix_recognition_logs_actual_student_id' in existing_idx:
        op.drop_index('ix_recognition_logs_actual_student_id', table_name=TABLE)

    existing_cols = {c['name'] for c in inspector.get_columns(TABLE)}
    if 'actual_student_id' in existing_cols:
        op.drop_column(TABLE, 'actual_student_id')

    # Revert timing columns to Integer
    for col in ('detection_time_ms', 'embedding_time_ms', 'search_time_ms', 'total_time_ms'):
        if col in existing_cols:
            op.alter_column(
                TABLE,
                col,
                existing_type=sa.Float(),
                type_=sa.Integer(),
                nullable=True,
            )
