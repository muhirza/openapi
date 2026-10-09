from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.product import Product
from app.schemas.product import ProductOut, ProductListResponse, SyncProductResult
from app.services.token_service import TokenService, TokenFetchError
from app.services.provider_client import provider_client, ProviderAPIError


class ProductService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def sync_products(self, user_id: int) -> SyncProductResult:
        endpoint = settings.provider_product_endpoint
        header_template = settings.provider_product_headers
        cred_api_name = "product_list"

        token_svc = TokenService(self.db)
        token_obj = await token_svc.get_valid_token(user_id)
        if not token_obj:
            return SyncProductResult(success=False, error="No valid provider token. Configure Get Token first.")
        from app.core.security import decrypt_value
        token = decrypt_value(token_obj.access_token_encrypted)

        creds = await token_svc.get_credentials_by_name(user_id, cred_api_name)
        if not creds:
            return SyncProductResult(success=False, error=f"No credentials configured for {cred_api_name}.")
        api_id, api_key = await token_svc.decrypt_credentials(creds)

        try:
            data = await provider_client.get(
                endpoint=endpoint, header_template=header_template,
                token=token, api_id=api_id, api_key=api_key,
            )
        except ProviderAPIError as e:
            return SyncProductResult(success=False, error=str(e))

        products = self._parse_products(data)
        # Deduplicate by product_code (provider may return duplicates)
        uniq = {}
        for p in products:
            uniq[p["product_code"]] = p
        products = list(uniq.values())

        now = datetime.now(timezone.utc)
        inserted = updated = deactivated = 0

        existing_rows = await self.db.execute(select(Product).where(Product.user_id == user_id))
        existing_map = {row.product_code: row for row in existing_rows.scalars().all()}
        synced_codes = set()

        for p in products:
            code = p["product_code"]
            synced_codes.add(code)
            row = existing_map.get(code)
            if row:
                row.product_name = p.get("product_name") or row.product_name
                row.product_type = p.get("product_type") or row.product_type
                row.owner = p.get("owner") or row.owner
                row.price = p.get("price") or row.price
                row.active = True
                row.last_synced_at = now
                row.updated_at = now
                updated += 1
            else:
                self.db.add(Product(
                    user_id=user_id, product_code=code,
                    product_name=p.get("product_name"), product_type=p.get("product_type"),
                    owner=p.get("owner"), price=p.get("price"),
                    active=True, last_synced_at=now,
                ))
                inserted += 1

        for code, row in existing_map.items():
            if code not in synced_codes and row.active:
                row.active = False
                row.updated_at = now
                deactivated += 1

        await self.db.commit()

        total_active = (await self.db.execute(
            select(func.count(Product.id)).where(Product.user_id == user_id, Product.active == True)
        )).scalar_one()

        return SyncProductResult(
            success=True, inserted=inserted, updated=updated,
            deactivated=deactivated, total_active=total_active, synced_at=now,
        )

    async def list_products(
        self,
        user_id: int,
        active: Optional[bool] = None,
        search: Optional[str] = None,
        brand: Optional[str] = None,
        name: Optional[str] = None,
        product_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 25,
        sort_by: Optional[str] = None,
        sort_dir: str = "asc",
    ) -> ProductListResponse:
        base_query = select(Product).where(Product.user_id == user_id)
        if active is not None:
            base_query = base_query.where(Product.active == active)
        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                Product.product_code.ilike(pattern)
                | Product.product_name.ilike(pattern)
                | Product.product_type.ilike(pattern)
            )
        if brand:
            base_query = base_query.where(Product.owner.ilike(f"%{brand}%"))
        if name:
            base_query = base_query.where(Product.product_name.ilike(f"%{name}%"))
        if product_type:
            base_query = base_query.where(Product.product_type.ilike(product_type))

        total = (
            await self.db.execute(
                select(func.count()).select_from(base_query.subquery())
            )
        ).scalar_one()

        total_pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 1
        page = max(1, min(page, total_pages))

        # Apply sorting
        sort_column_map = {
            "product_code": Product.product_code,
            "product_name": Product.product_name,
            "product_type": Product.product_type,
            "owner": Product.owner,
            "price": Product.price,
            "active": Product.active,
            "last_synced_at": Product.last_synced_at,
        }
        sort_col = sort_column_map.get(sort_by) if sort_by else None
        if sort_col:
            order = sort_col.desc() if sort_dir.lower() == "desc" else sort_col.asc()
            base_query = base_query.order_by(order, Product.id)
        else:
            # Sort by name (not type) so all brands are interleaved
            # and visible across all pages without filtering.
            base_query = base_query.order_by(
                Product.active.desc(), Product.product_name
            )

        rows = await self.db.execute(
            base_query.offset((page - 1) * per_page).limit(per_page)
        )
        products = [ProductOut.model_validate(r) for r in rows.scalars().all()]

        active_count = (await self.db.execute(
            select(func.count(Product.id)).where(Product.user_id == user_id, Product.active == True)
        )).scalar_one()
        inactive_count = (await self.db.execute(
            select(func.count(Product.id)).where(Product.user_id == user_id, Product.active == False)
        )).scalar_one()

        brands = (
            await self.db.execute(
                select(Product.owner)
                .where(Product.user_id == user_id, Product.owner.isnot(None), Product.owner != "")
                .distinct()
                .order_by(Product.owner)
            )
        ).scalars().all()
        product_types = (
            await self.db.execute(
                select(Product.product_type)
                .where(Product.user_id == user_id, Product.product_type.isnot(None), Product.product_type != "")
                .distinct()
                .order_by(Product.product_type)
            )
        ).scalars().all()

        return ProductListResponse(
            products=products,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            active_count=active_count,
            inactive_count=inactive_count,
            brands=list(brands),
            product_types=list(product_types),
        )

    async def get_status(self, user_id: int) -> dict:
        last_synced = (await self.db.execute(
            select(func.max(Product.last_synced_at)).where(Product.user_id == user_id)
        )).scalar_one_or_none()
        active_count = (await self.db.execute(
            select(func.count(Product.id)).where(Product.user_id == user_id, Product.active == True)
        )).scalar_one()
        inactive_count = (await self.db.execute(
            select(func.count(Product.id)).where(Product.user_id == user_id, Product.active == False)
        )).scalar_one()
        return {
            "last_synced_at": last_synced,
            "active_count": active_count,
            "inactive_count": inactive_count,
            "total": active_count + inactive_count,
        }

    @staticmethod
    def _parse_products(data) -> List[dict]:
        rows = []
        if not isinstance(data, list):
            if isinstance(data, dict):
                for key in ("data", "products", "items", "result"):
                    if key in data and isinstance(data[key], list):
                        data = data[key]
                        break
            else:
                return rows

        for row in data:
            if not isinstance(row, dict):
                continue
            code = (row.get("productCode") or row.get("product_code") or row.get("code") or "").strip()
            if not code:
                continue

            price_raw = row.get("price") or row.get("Price") or row.get("denomination")
            price = None
            if price_raw is not None:
                try:
                    price = Decimal(str(price_raw))
                except InvalidOperation:
                    price = None

            rows.append({
                "product_code": code,
                "product_name": (row.get("productName") or row.get("product_name") or row.get("name") or "").strip() or None,
                "product_type": (row.get("productType") or row.get("product_type") or row.get("type") or "").strip() or None,
                "owner": (row.get("owner") or row.get("Owner") or "").strip() or None,
                "price": price,
            })

        return rows