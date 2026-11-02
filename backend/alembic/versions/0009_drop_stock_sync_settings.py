"""drop stock sync settings (no provider history sync)

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-02 00:00:00.000000

The provider's AWG/XWG Get Info Transaction list endpoints no longer exist, so
digital stock history is system-generated and never synced. The dedicated sync
settings table is no longer needed.

"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index('idx_stock_sync_settings_user', table_name='stock_sync_settings')
    op.drop_table('stock_sync_settings')


def downgrade() -> None:
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
