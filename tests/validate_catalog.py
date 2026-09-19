#!/usr/bin/env python3
import json
from collections import Counter
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
by_id = {p["id"]: p for p in products}
assert by_id["kaygt22s6di"]["price"] == 379_900
assert by_id["7v9bc55hij"]["price"] == 800_000
assert by_id["7v9bc55hij"]["payment_terms"] == "Únicamente pago anticipado"
drill_adjustments = sum(p.get("pricing_rule") == "Taladro" for p in products)
combo_adjustments = sum(p.get("pricing_rule") == "Combo con taladro o pulidora" for p in products)
assert drill_adjustments == 59
assert combo_adjustments == 21
pricing_counts = Counter(p.get("pricing_rule") for p in products)
expected_category_counts = {
    "Pulidoras": 37,
    "Pistolas y llaves de impacto": 17,
    "Rotomartillos": 8,
    "Demoledores": 5,
    "Sierras y caladoras": 13,
    "Compresores": 8,
    "Lijadoras": 8,
    "Ruteadoras y rebordeadoras": 8,
    "Maquinaria agrícola y jardín": 2,
}
for rule, expected in expected_category_counts.items():
    assert pricing_counts[rule] == expected, (rule, pricing_counts[rule], expected)
assert sum(count for rule, count in pricing_counts.items() if rule is not None) == 188
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
    "drills_adjusted": drill_adjustments,
    "combos_adjusted": combo_adjustments,
    "cordless_hedge_trimmer": by_id["kaygt22s6di"]["price"],
    "gas_hedge_trimmer": by_id["7v9bc55hij"]["price"],
    "total_adjusted": 188,
    "new_category_adjustments": sum(expected_category_counts.values()),
}, ensure_ascii=False))
