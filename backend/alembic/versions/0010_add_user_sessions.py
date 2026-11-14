"""add user sessions (server-side, revocable auth)

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-04 00:00:00.000000

Replaces stateless JWTs with opaque session tokens stored hashed, so idle
timeouts are enforced server-side and logout actually revokes access.

The app also calls Base.metadata.create_all on startup, which can create this
table before the migration runs (e.g. uvicorn --reload in dev). Creation is
therefore guarded so the migration stays safe in that order.

"""
from alembic import op
import sqlalchemy as sa


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def _has_index(table: str, name: str) -> bool:
    return any(
        index['name'] == name
        for index in sa.inspect(op.get_bind()).get_indexes(table)
    )


def upgrade() -> None:
    if not _has_table('user_sessions'):
        op.create_table(
            'user_sessions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                'user_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                'last_seen_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('user_agent', sa.String(length=255), nullable=True),
            sa.Column('ip_address', sa.String(length=64), nullable=True),
        )

    # Names match the ones SQLAlchemy generates from the model's index=True /
    # unique=True so a create_all-created table does not get duplicate indexes.
    for name, columns, unique in (
        ('ix_user_sessions_token_hash', ['token_hash'], True),
        ('ix_user_sessions_user_id', ['user_id'], False),
        ('idx_user_sessions_expiry', ['expires_at'], False),
    ):
        if not _has_index('user_sessions', name):
            op.create_index(name, 'user_sessions', columns, unique=unique)


def downgrade() -> None:
    if not _has_table('user_sessions'):
        return

    for name in (
        'idx_user_sessions_expiry',
        'ix_user_sessions_user_id',
        'ix_user_sessions_token_hash',
    ):
        if _has_index('user_sessions', name):
            op.drop_index(name, table_name='user_sessions')

    op.drop_table('user_sessions')
