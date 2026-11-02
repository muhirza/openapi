from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.models.user import User
from app.db.session import get_db
from app.schemas.balance import BalanceResponse, BalanceSummary
from app.services.balance_service import BalanceService
from app.services.token_service import TokenFetchError
from app.services.provider_client import ProviderAPIError

router = APIRouter()


@router.get("/balance")
async def get_all_balances(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch all balances (eload, dompul).

    Errors per balance type are swallowed; each returns None if it fails.
    The summary includes an error field per type if known (via future extension).
    """
    svc = BalanceService(db)
    return await svc.fetch_all_balances(current_user.id)


@router.get("/balance/{balance_type}")
async def get_balance(
    balance_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single balance by type (eload | dompul)."""
    svc = BalanceService(db)
    try:
        return await svc.fetch_balance(current_user.id, balance_type)
    except (ValueError, TokenFetchError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))