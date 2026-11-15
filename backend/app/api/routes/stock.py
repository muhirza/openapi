from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.stock import StockListResponse
from app.services.provider_client import ProviderAPIError
from app.services.stock_service import SUPPORTED_FAMILIES, StockService
from app.services.token_service import TokenFetchError

router = APIRouter()


@router.get("/stock/{family}", response_model=StockListResponse)
async def get_stock(
    family: str,
    ro_type: Optional[str] = Query(None, description="XWG only (default: MINI-GROSIR)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Digital stock for the AWG or XWG family."""
    if family.lower() not in SUPPORTED_FAMILIES:
        raise HTTPException(status_code=404, detail="Keluarga stok tidak dikenal")

    svc = StockService(db)
    try:
        return await svc.get_stock(current_user.id, family=family.lower(), ro_type=ro_type)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
