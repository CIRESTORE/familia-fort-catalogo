#!/usr/bin/env python3
"""Reglas comerciales de Familia Fort aplicadas al catálogo importado."""
from __future__ import annotations

import re
from typing import Any

SPECIAL_PRICES = {
    "kaygt22s6di": {
        "price": 379_900,
        "rule": "Precio fijo Cortasetos Inalámbrico",
    },
    "7v9bc55hij": {
        "price": 800_000,
        "rule": "Precio fijo Cortasetos a Gasolina",
        "payment_terms": "Únicamente pago anticipado",
    },
}

DRILL_ACCESSORY_TERMS = (
    "ACCESORIO",
    "ADAPTADOR",
    "BATERIA",
    "BATERÍA",
    "CARGADOR",
    "DISCO",
    "EXTENSOR",
    "KIT PUNTA",
    "REPUESTO",
)


def normalized_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().upper()


def is_combo_with_drill_or_grinder(product: dict[str, Any]) -> bool:
    name = normalized_text(product.get("name"))
    description = normalized_text(product.get("description"))
    combined = f"{name} {description}"
    if "COMBO" not in combined:
        return False
    return any(term in combined for term in ("TALADRO", "PULIDORA", "PILDORA"))


def is_standalone_drill(product: dict[str, Any]) -> bool:
    name = normalized_text(product.get("name"))
    if "TALADRO" not in name or "COMBO" in name:
        return False
    return not any(term in name for term in DRILL_ACCESSORY_TERMS)


def apply_pricing_rules(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aplica reglas con precedencia: precio especial > combo > taladro.

    `source_price` conserva el precio de origen y hace que la operación sea idempotente.
    """
    for product in products:
        source_price = int(product.get("source_price", product.get("price", 0)) or 0)
        product["source_price"] = source_price
        product.pop("pricing_adjustment", None)
        product.pop("pricing_rule", None)
        product.pop("payment_terms", None)

        special = SPECIAL_PRICES.get(str(product.get("id")))
        if special:
            product["price"] = special["price"]
            product["pricing_adjustment"] = special["price"] - source_price
            product["pricing_rule"] = special["rule"]
            if special.get("payment_terms"):
                product["payment_terms"] = special["payment_terms"]
        elif is_combo_with_drill_or_grinder(product):
            product["price"] = source_price + 50_000
            product["pricing_adjustment"] = 50_000
            product["pricing_rule"] = "Combo con taladro o pulidora"
        elif is_standalone_drill(product):
            product["price"] = source_price + 30_000
            product["pricing_adjustment"] = 30_000
            product["pricing_rule"] = "Taladro"
        else:
            product["price"] = source_price

    return products
