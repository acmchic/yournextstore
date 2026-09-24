from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ImageFormat = Literal["webp", "png", "jpeg"]


class ProductSummary(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None = None
    default_artwork_id: str | None = None
    default_template_id: str | None = None


class PrintArea(BaseModel):
    dst_quad: list[tuple[float, float]] = Field(min_length=4, max_length=4)
    dst_quads: list[list[tuple[float, float]]] | None = None
    displacement_strength: float = 8.0
    shadow_opacity: float = 0.35
    highlight_opacity: float = 0.16
    artwork_fit: Literal["contain", "cover"] = "contain"
    surface_mode: Literal["assets", "auto", "none"] = "assets"


class RenderJob(BaseModel):
    product_id: str
    artwork_id: str
    template_id: str
    variant_id: str | None = None
    base_source: str
    artwork_source: str
    mask_source: str | None = None
    displacement_source: str | None = None
    shadow_source: str | None = None
    highlight_source: str | None = None
    garment_color: str | None = None
    print_area: PrintArea
    version: str = "1"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CartItemUpsert(BaseModel):
    variant_id: str
    quantity: int = Field(default=1, ge=0, le=99)
    mode: Literal["add", "set"] = "add"


class OrderAddressInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    line1: str = Field(min_length=1, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    postal_code: str = Field(min_length=1, max_length=40)
    country_code: str = Field(min_length=2, max_length=2)
    phone: str | None = Field(default=None, max_length=40)


class OrderCreate(BaseModel):
    cart_id: str
    email: str = Field(min_length=3, max_length=320)
    shipping_address: OrderAddressInput


class ContactMessageCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    message: str = Field(min_length=1, max_length=10000)
