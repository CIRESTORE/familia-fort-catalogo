#!/usr/bin/env python3
"""Importa el catálogo público autorizado de PROTOOL a un JSON estático de Familia Fort.

El importador conserva únicamente el precio final de venta (pcia). No exporta precios
mayoristas (psib/psia/etc.). Descarga las imágenes al proyecto para que el catálogo sea
independiente del hosting de VerCatálogo.
"""
from __future__ import annotations

import json
import mimetypes
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from pricing_rules import apply_pricing_rules

SOURCE_SLUG = "protoolpowercali"
SOURCE_PAGE = f"https://vercatalogo.com/{SOURCE_SLUG}/products"
API_BASE = f"https://api-latam.vercatalogo.com/{SOURCE_SLUG}"
VC_VERSION = "22.8.3"
PAGE_SIZE = 24
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "assets" / "products"
USER_AGENT = "Mozilla/5.0 (Familia Fort authorized catalog migration)"


def request_bytes(url: str, headers: dict[str, str] | None = None, retries: int = 3) -> bytes:
    merged = {"User-Agent": USER_AGENT, **(headers or {})}
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=merged)
            with urllib.request.urlopen(req, timeout=45) as response:
                return response.read()
        except Exception as exc:  # network retry
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"No se pudo descargar {url}: {last_error}")


def get_session() -> tuple[str, dict]:
    html = request_bytes(SOURCE_PAGE).decode("utf-8", "replace")
    match = re.search(
        r'<script[^>]+id=["\']initial-catalog-data["\'][^>]*>(.*?)</script>',
        html,
        re.S,
    )
    if not match:
        raise RuntimeError("No se encontró initial-catalog-data en VerCatálogo")
    initial = json.loads(match.group(1))
    return initial["session"]["token"], initial.get("settings", {})


def api_json(path: str, token: str):
    url = f"{API_BASE}/{path.lstrip('/')}"
    payload = request_bytes(
        url,
        {
            "X-VC-Version": VC_VERSION,
            "X-VC-Token": token,
            "Accept": "application/json",
        },
    )
    return json.loads(payload)


def safe_custom(raw: str | dict | None) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        return {}


def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def product_sku(name: str, fallback: str) -> str:
    if "/" in name:
        candidate = clean_text(name.split("/", 1)[0])
        if candidate:
            return candidate
    return fallback


def collect_image_urls(record: dict, custom: dict) -> list[str]:
    urls: list[str] = []
    for item in custom.get("images", []):
        if isinstance(item, dict) and item.get("image_url"):
            urls.append(item["image_url"])
    for key in ["url_imagen", "url_imagen_01", "url_imagen_02", "url_imagen_03", "url_imagen_04", "url_imagen_05"]:
        if record.get(key):
            urls.append(record[key])
    seen: set[str] = set()
    return [url for url in urls if not (url in seen or seen.add(url))]


def image_extension(url: str, content_type: str | None = None) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    guessed = mimetypes.guess_extension((content_type or "").split(";", 1)[0])
    return guessed or ".jpg"


def download_image(url: str, product_id: str, index: int) -> str:
    ext = image_extension(url)
    filename = f"{product_id}-{index + 1}{ext}"
    destination = IMAGE_DIR / filename
    if destination.exists() and destination.stat().st_size > 0:
        return f"/assets/products/{filename}"
    data = request_bytes(url)
    destination.write_bytes(data)
    return f"/assets/products/{filename}"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    token, settings = get_session()
    raw_products: list[dict] = []
    page = 0
    while True:
        batch = api_json(
            f"product/search?storage_id=GEN&custom_order=news&page={page}&limit={PAGE_SIZE}",
            token,
        )
        if not isinstance(batch, list):
            raise RuntimeError(f"Respuesta inesperada en página {page}: {type(batch).__name__}")
        if not batch:
            break
        raw_products.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        page += 1
        if page > 100:
            raise RuntimeError("Protección de paginación activada")

    unique: dict[str, dict] = {}
    for record in raw_products:
        unique[str(record["idref"])] = record
    raw_products = list(unique.values())

    products: list[dict] = []
    image_failures: list[dict] = []
    for position, record in enumerate(raw_products, start=1):
        product_id = str(record["idref"])
        custom = safe_custom(record.get("custom"))
        source_images = collect_image_urls(record, custom)
        local_images: list[str] = []
        for image_index, url in enumerate(source_images):
            try:
                local_images.append(download_image(url, product_id, image_index))
            except Exception as exc:
                image_failures.append({"product_id": product_id, "url": url, "error": str(exc)})
        name = clean_text(record.get("desccli") or record.get("descint"))
        products.append(
            {
                "id": product_id,
                "sku": product_sku(name, product_id),
                "name": name,
                "description": clean_text(custom.get("description")),
                "category": clean_text(record.get("categorias")) or "Otros",
                "brand": clean_text(record.get("marcas")),
                "price": int(round(float(record.get("pcia") or 0))),
                "currency": "COP",
                "images": local_images,
                "available": bool(record.get("web", 0)),
                "featured": position <= 12,
            }
        )

    products = apply_pricing_rules(products)
    categories = sorted({p["category"] for p in products}, key=str.casefold)
    catalog = {
        "meta": {
            "brand": "Familia Fort",
            "source": SOURCE_PAGE,
            "product_count": len(products),
            "category_count": len(categories),
            "currency": "COP",
            "retail_price_field": "pcia",
            "wholesale_prices_included": False,
            "images_hosted_locally": True,
            "pricing_rules_applied": True,
        },
        "categories": categories,
        "products": products,
    }
    output = json.dumps(catalog, ensure_ascii=False, indent=2)
    (DATA_DIR / "catalog.json").write_text(output, encoding="utf-8")
    (PUBLIC_DATA_DIR / "catalog.json").write_text(output, encoding="utf-8")
    (DATA_DIR / "source-settings.json").write_text(
        json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "image-failures.json").write_text(
        json.dumps(image_failures, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "products": len(products),
                "categories": len(categories),
                "images": sum(len(p["images"]) for p in products),
                "image_failures": len(image_failures),
                "wholesale_prices_included": False,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
