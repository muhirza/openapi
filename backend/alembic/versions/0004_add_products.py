"""add products table (product catalog cache)

Revision ID: 0004
Revises: 0003
Create Date: 2025-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'products',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('product_code', sa.String(length=255), nullable=False, index=True),
        sa.Column('product_name', sa.String(length=500), nullable=True),
        sa.Column('product_type', sa.String(length=255), nullable=True),
        sa.Column('owner', sa.String(length=100), nullable=True),
        sa.Column('price', sa.Numeric(18, 2), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'product_code', name='uq_products_user_code'),
    )
    op.create_index('idx_products_user_active', 'products', ['user_id', 'active'])


def downgrade() -> None:
    op.drop_index('idx_products_user_active')
    op.drop_table('products')