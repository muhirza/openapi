"""add digital stock history (stock_transactions + stock_sync_settings)

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'stock_transactions',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('family', sa.String(length=10), nullable=False),
        sa.Column('servicetype', sa.String(length=30), nullable=False),
        sa.Column('master_trx_id', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('status_raw', sa.String(length=50), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('voucher_price', sa.Numeric(18, 2), nullable=True),
        sa.Column('price_normal', sa.Numeric(18, 2), nullable=True),
        sa.Column('voucher_type_code', sa.String(length=255), nullable=True),
        sa.Column('source_msisdn', sa.String(length=50), nullable=True),
        sa.Column('destination_msisdn', sa.String(length=50), nullable=True),
        sa.Column('created_dtm', sa.Date(), nullable=True),
        sa.Column('detail_status', sa.String(length=50), nullable=True),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.Column('detail_fetched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_response', sa.JSON(), nullable=True),
        sa.Column('raw_response_unmasked', sa.JSON(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'master_trx_id', name='uq_stock_transactions_user_master'),
    )
    op.create_index('idx_stock_transactions_user', 'stock_transactions', ['user_id'])
    op.create_index(
        'idx_stock_transactions_user_family_date',
        'stock_transactions',
        ['user_id', 'family', 'created_dtm'],
    )

    op.create_table(
        'stock_sync_settings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('interval_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sync_status', sa.String(length=20), nullable=True),
        sa.Column('last_sync_error', sa.String(length=500), nullable=True),
        sa.Column('last_sync_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_stock_sync_settings_user', 'stock_sync_settings', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_stock_sync_settings_user', table_name='stock_sync_settings')
    op.drop_table('stock_sync_settings')

    op.drop_index('idx_stock_transactions_user_family_date', table_name='stock_transactions')
    op.drop_index('idx_stock_transactions_user', table_name='stock_transactions')
    op.drop_table('stock_transactions')
