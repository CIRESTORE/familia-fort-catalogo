#!/usr/bin/env python3
"""Reglas comerciales de Familia Fort aplicadas al catálogo importado."""
from __future__ import annotations

import re
from typing import Any

SPECIAL_PRICES = {
    # Precios definidos a partir del comparativo Homecenter del 2026-09-19.
    "vj16dguzq4k": {"price": 279_900, "rule": "Precio ajustado por mercado - 4076B"},
    "zp3qdomqjyh": {"price": 299_900, "rule": "Precio ajustado por mercado - 7002"},
    "2ocbl6k817h": {"price": 269_900, "rule": "Precio ajustado por mercado - 4037"},
    "lywxr9bd6h": {"price": 229_900, "rule": "Precio ajustado por mercado - LO110MC"},
    "htm9558tgqn": {"price": 209_000, "rule": "Precio ajustado por mercado - 747"},
    "d5dr51a6hzl": {"price": 599_900, "rule": "Precio ajustado por mercado - 355A"},
    "q33bjj0558p": {"price": 599_900, "rule": "Precio ajustado por mercado - 355A ENUM"},
    "ivf5gtsesul": {"price": 329_900, "rule": "Precio ajustado por mercado - DM110RL"},
    "meq1ndqu5ki": {"price": 259_900, "rule": "Precio ajustado por mercado - 82A001"},
    "8q8bwfvdmco": {"price": 359_900, "rule": "Precio ajustado por mercado - 706"},
    "2gfsrsp5vd8": {"price": 169_900, "rule": "Precio ajustado por mercado - REV1D"},
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

CATEGORY_INCREASES = {
    "PULIDORAS ELECTRICAS INALAMBRICAS": (20_000, "Pulidoras"),
    "PISTOLA DE IMPACTO INALAMBRICA": (30_000, "Pistolas y llaves de impacto"),
    "ROTOMARTILLO 110V/INALAMBRICO": (30_000, "Rotomartillos"),
    "DEMOLEDORES 110V": (50_000, "Demoledores"),
    "SIERRAS Y CALADORAS COLILLADORAS TRONSAD": (30_000, "Sierras y caladoras"),
    "COMPRESORES": (40_000, "Compresores"),
    "LIJADORAS": (20_000, "Lijadoras"),
    "RUTEADORA Y REBORDEADORA": (20_000, "Ruteadoras y rebordeadoras"),
    "HERRAMIENTA AGRICOLA*JARDIN": (50_000, "Maquinaria agrícola y jardín"),
}


CATEGORY_ACCESSORY_TERMS = (
    "ADAPTACION",
    "ADAPTACIÓN",
    "ADAPTADOR",
    "ADAPATADOR",
    "BASE",
    "BOQUILLA",
    "CADENA",
    "DISCO",
    "ESPADA",
    "HOJA",
    "JUEGO DE COPA",
    "MANGUERA",
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


def category_adjustment(product: dict[str, Any]) -> tuple[int, str] | None:
    category = normalized_text(product.get("category"))
    name = normalized_text(product.get("name"))
    rule = CATEGORY_INCREASES.get(category)
    if not rule or any(term in name for term in CATEGORY_ACCESSORY_TERMS):
        return None
    return rule


def apply_pricing_rules(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aplica reglas con precedencia: especial > combo > taladro > categoría.

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
        elif (category_rule := category_adjustment(product)):
            adjustment, label = category_rule
            product["price"] = source_price + adjustment
            product["pricing_adjustment"] = adjustment
            product["pricing_rule"] = label
        else:
            product["price"] = source_price

    return products
