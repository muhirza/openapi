"""Bounded Excel export for the local transaction ledger.

Exports are intentionally filtered and size-limited: a full-table dump would be
large, so the endpoint refuses result sets above MAX_EXPORT_ROWS and the workbook
is written in write-only mode to keep memory bounded.
"""

from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.local_transaction import LocalTransaction

# Hard ceiling for a single export.
MAX_EXPORT_ROWS = 20000

COLUMNS = (
    ("Date", 12),
    ("Time", 10),
    ("Type", 18),
    ("Product", 34),
    ("Destination", 18),
    ("Amount", 16),
    ("Status", 12),
    ("Source", 10),
    ("Provider Reference", 30),
    ("Local Reference", 38),
    ("Payment Method", 16),
)


def _fmt_date(value: Optional[datetime]) -> str:
    return value.strftime("%Y-%m-%d") if value else ""


def _fmt_time(value: Optional[datetime]) -> str:
    return value.strftime("%H:%M:%S") if value else ""


def export_filename(
    start_date: Optional[str] = None, end_date: Optional[str] = None
) -> str:
    """Name the file after the applied date filter.

    Both sides set  -> TransactionHistory_{start}_to_{end}.xlsx
    Start only      -> TransactionHistory_from_{start}.xlsx
    End only        -> TransactionHistory_until_{end}.xlsx
    No date filter  -> TransactionHistory_{today}.xlsx
    """
    if start_date and end_date:
        suffix = f"{start_date}_to_{end_date}"
    elif start_date:
        suffix = f"from_{start_date}"
    elif end_date:
        suffix = f"until_{end_date}"
    else:
        suffix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"TransactionHistory_{suffix}.xlsx"


async def export_transactions_xlsx(
    db: AsyncSession,
    *,
    user_id: int,
    conditions: list,
    total: int,
) -> BytesIO:
    """Build an .xlsx workbook for the already-filtered rows.

    `conditions` are the same SQLAlchemy filters used by the list endpoint.
    Write-only mode streams rows into the workbook instead of holding a cell
    object per value, so even a 20k-row export stays small in memory.
    """
    from openpyxl import Workbook
    from openpyxl.cell import WriteOnlyCell
    from openpyxl.styles import Font

    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Transactions")

    header = []
    for name, _width in COLUMNS:
        cell = WriteOnlyCell(ws, value=name)
        cell.font = Font(bold=True)
        header.append(cell)
    ws.append(header)
    for index, (_name, width) in enumerate(COLUMNS, start=1):
        ws.column_dimensions[chr(64 + index)].width = width

    rows = await db.execute(
        select(LocalTransaction)
        .where(*conditions)
        .order_by(LocalTransaction.created_at.desc())
        .limit(MAX_EXPORT_ROWS)
    )

    for record in rows.scalars():
        ws.append(
            [
                _fmt_date(record.created_at),
                _fmt_time(record.created_at),
                record.transaction_type,
                record.product_name or record.product_code or "",
                record.destination or "",
                float(record.amount) if record.amount is not None else None,
                record.status,
                record.source,
                record.provider_reference or "",
                record.transaction_ref or "",
                record.payment_method or "",
            ]
        )

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
