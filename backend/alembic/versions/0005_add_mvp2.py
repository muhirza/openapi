"""add user_pins table and extend local_transactions (MVP2)

Revision ID: 0005
Revises: 0004
Create Date: 2025-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_pins',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('pin_encrypted', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_pins_user_id'),
    )
    op.create_index('ix_user_pins_user_id', 'user_pins', ['user_id'])

    op.add_column('local_transactions', sa.Column('request_timestamp', sa.DateTime(timezone=True), nullable=True))
    op.add_column('local_transactions', sa.Column('provider_response_timestamp', sa.DateTime(timezone=True), nullable=True))
    op.add_column('local_transactions', sa.Column('http_status_code', sa.Integer(), nullable=True))
    op.add_column('local_transactions', sa.Column('error_code', sa.String(length=50), nullable=True))
    op.add_column('local_transactions', sa.Column('error_message', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('local_transactions', 'error_message')
    op.drop_column('local_transactions', 'error_code')
    op.drop_column('local_transactions', 'http_status_code')
    op.drop_column('local_transactions', 'provider_response_timestamp')
    op.drop_column('local_transactions', 'request_timestamp')
    op.drop_index('ix_user_pins_user_id', table_name='user_pins')
    op.drop_table('user_pins')
