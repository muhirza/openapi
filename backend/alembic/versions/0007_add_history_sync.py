"""add provider history auto-sync

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'local_transactions',
        sa.Column('source', sa.String(length=20), nullable=False, server_default='app'),
    )
    op.add_column(
        'local_transactions',
        sa.Column('provider_transaction_id', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'local_transactions',
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'idx_local_transactions_provider_tx',
        'local_transactions',
        ['user_id', 'provider_transaction_id'],
    )

    op.create_table(
        'user_sync_settings',
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
    op.create_index('idx_user_sync_settings_user', 'user_sync_settings', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_user_sync_settings_user', table_name='user_sync_settings')
    op.drop_table('user_sync_settings')

    op.drop_index('idx_local_transactions_provider_tx', table_name='local_transactions')
    op.drop_column('local_transactions', 'synced_at')
    op.drop_column('local_transactions', 'provider_transaction_id')
    op.drop_column('local_transactions', 'source')
