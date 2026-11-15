"""add transaction brand snapshot + buy-pulsa synthetic products

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-14 00:00:00.000000

Why:
- Buy Pulsa has no catalog product code, so analytics could not attribute its
  brand. The brand is now resolved from the destination MSISDN prefix and
  stored on the transaction.
- The Buy Pulsa denomination is treated as its product identity so Top Products
  can show "Pulsa 5.000" instead of one Unknown product row.

The prefix logic is intentionally duplicated here (instead of importing the
service) so this migration stays reproducible even if the resolver evolves.
"""
import json
import re
from decimal import Decimal

from alembic import op
import sqlalchemy as sa


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


SMARTFREN_PREFIX = "6288"
XL_PREFIXES = ("62817", "62818", "62819", "62859", "62877", "62878")
AXIS_PREFIXES = ("62831", "62832", "62833", "62838")


def _normalize_msisdn(value) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value))
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    if not digits.startswith("62") or not (10 <= len(digits) <= 15):
        return None
    return digits


def _resolve_brand(value) -> str | None:
    digits = _normalize_msisdn(value)
    if not digits:
        return None
    if digits.startswith(SMARTFREN_PREFIX):
        return "SMARTFREN"
    if any(digits.startswith(prefix) for prefix in XL_PREFIXES):
        return "XL"
    if any(digits.startswith(prefix) for prefix in AXIS_PREFIXES):
        return "AXIS"
    return None


def upgrade() -> None:
    op.add_column(
        "local_transactions",
        sa.Column("brand", sa.String(length=50), nullable=True),
    )

    bind = op.get_bind()

    # Product-based flows keep the catalog owner as their brand snapshot.
    bind.execute(
        sa.text(
            """
            UPDATE local_transactions AS lt
            SET brand = NULLIF(TRIM(p.owner), '')
            FROM products AS p
            WHERE p.user_id = lt.user_id
              AND p.product_code = lt.product_code
              AND lt.brand IS NULL
            """
        )
    )

    # Buy Pulsa: derive the brand from the destination and synthesize a product
    # identity from the requested denomination (metadata.denom, else amount).
    rows = bind.execute(
        sa.text(
            """
            SELECT id, destination, amount, metadata
            FROM local_transactions
            WHERE transaction_type = 'buy_pulsa'
            """
        )
    ).mappings().all()

    for row in rows:
        meta = row["metadata"]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (TypeError, ValueError):
                meta = None

        denom = meta.get("denom") if isinstance(meta, dict) else None
        if denom is None:
            denom = row["amount"]
        if denom is None:
            continue

        try:
            denom_int = int(Decimal(str(denom)))
        except (TypeError, ValueError, ArithmeticError):
            continue

        label = f"{denom_int:,}".replace(",", ".")
        bind.execute(
            sa.text(
                """
                UPDATE local_transactions
                SET brand = :brand,
                    product_code = :code,
                    product_name = :name
                WHERE id = :id
                """
            ),
            {
                "brand": _resolve_brand(row["destination"]),
                "code": f"PULSA_{denom_int}",
                "name": f"Pulsa {label}",
                "id": row["id"],
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE local_transactions
            SET product_code = NULL, product_name = NULL
            WHERE transaction_type = 'buy_pulsa'
              AND product_code LIKE 'PULSA_%'
            """
        )
    )
    op.drop_column("local_transactions", "brand")
