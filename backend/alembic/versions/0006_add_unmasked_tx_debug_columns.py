"""add unmasked debug columns to local_transactions

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('local_transactions', sa.Column('metadata_unmasked', sa.JSON(), nullable=True))
    op.add_column('local_transactions', sa.Column('raw_response_unmasked', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('local_transactions', 'raw_response_unmasked')
    op.drop_column('local_transactions', 'metadata_unmasked')
