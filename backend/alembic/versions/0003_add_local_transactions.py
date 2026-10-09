"""add local_transactions table

Revision ID: 0003
Revises: 0002
Create Date: 2025-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'local_transactions',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('transaction_ref', sa.String(length=255), nullable=False, index=True),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('product_code', sa.String(length=255), nullable=True),
        sa.Column('product_name', sa.String(length=500), nullable=True),
        sa.Column('product_type', sa.String(length=255), nullable=True),
        sa.Column('amount', sa.Numeric(18, 2), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('provider_reference', sa.String(length=255), nullable=True),
        sa.Column('destination', sa.String(length=50), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('raw_response', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_local_transactions_user', 'local_transactions', ['user_id'])
    op.create_index('idx_local_transactions_ref', 'local_transactions', ['transaction_ref'])


def downgrade() -> None:
    op.drop_index('idx_local_transactions_ref')
    op.drop_index('idx_local_transactions_user')
    op.drop_table('local_transactions')