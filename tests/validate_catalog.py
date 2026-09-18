#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog_path = ROOT / "public" / "data" / "catalog.json"
catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
products = catalog["products"]
assert catalog["meta"]["wholesale_prices_included"] is False
assert len(products) == catalog["meta"]["product_count"]
assert len({p["id"] for p in products}) == len(products)
assert len({p["category"] for p in products}) == catalog["meta"]["category_count"]
assert all(isinstance(p["price"], int) and p["price"] >= 0 for p in products)
assert all(p["currency"] == "COP" for p in products)
assert all("wholesale" not in p and "psib" not in p and "precio_mayorista" not in p for p in products)
missing = []
for product in products:
    for image in product["images"]:
        path = ROOT / "public" / image.lstrip("/")
        if not path.exists() or path.stat().st_size == 0:
            missing.append(str(path))
assert not missing, f"Imágenes faltantes: {missing[:10]}"
print(json.dumps({
    "products": len(products),
    "categories": catalog["meta"]["category_count"],
    "images": sum(len(p["images"]) for p in products),
    "unique_ids": len({p["id"] for p in products}),
    "wholesale_fields": 0,
    "missing_images": len(missing),
}, ensure_ascii=False))
