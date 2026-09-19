#!/usr/bin/env python3
import copy
import unittest

from scripts.pricing_rules import apply_pricing_rules


class PricingRulesTests(unittest.TestCase):
    def test_special_cordless_hedge_trimmer_has_exact_price(self):
        products = [{"id": "kaygt22s6di", "name": "DRILL cortasetos batería", "price": 320000, "description": ""}]
        result = apply_pricing_rules(copy.deepcopy(products))[0]
        self.assertEqual(result["price"], 379900)
        self.assertEqual(result["source_price"], 320000)

    def test_gas_hedge_trimmer_has_exact_price_and_prepaid_term(self):
        products = [{"id": "7v9bc55hij", "name": "CORTASETOS A GASOLINA", "price": 550000, "description": ""}]
        result = apply_pricing_rules(copy.deepcopy(products))[0]
        self.assertEqual(result["price"], 800000)
        self.assertEqual(result["payment_terms"], "Únicamente pago anticipado")

    def test_combo_with_drill_gets_fifty_thousand_increase_only(self):
        products = [{"id": "combo1", "name": "COMBO TALADRO Y PULIDORA", "price": 200000, "description": ""}]
        result = apply_pricing_rules(copy.deepcopy(products))[0]
        self.assertEqual(result["price"], 250000)
        self.assertEqual(result["pricing_adjustment"], 50000)

    def test_combo_components_can_be_detected_in_description(self):
        products = [{"id": "combo2", "name": "COMBO TAPU68DK", "price": 430000, "description": "Taladro y pistola de impacto"}]
        result = apply_pricing_rules(copy.deepcopy(products))[0]
        self.assertEqual(result["price"], 480000)

    def test_standalone_drill_gets_thirty_thousand_increase(self):
        products = [{"id": "drill1", "name": "TALADRO PERCUTOR 1/2", "price": 100000, "description": ""}]
        result = apply_pricing_rules(copy.deepcopy(products))[0]
        self.assertEqual(result["price"], 130000)
        self.assertEqual(result["pricing_adjustment"], 30000)

    def test_drill_accessories_are_not_increased(self):
        names = ["CARGADOR BATERÍA TALADRO", "KIT PUNTA TALADRO", "TUBO EXTENSOR DE TALADRO", "ACCESORIO PARA TALADRO"]
        products = [{"id": str(i), "name": name, "price": 50000, "description": ""} for i, name in enumerate(names)]
        results = apply_pricing_rules(copy.deepcopy(products))
        self.assertTrue(all(product["price"] == 50000 for product in results))

    def test_reapplying_rules_is_idempotent(self):
        products = [{"id": "drill1", "name": "TALADRO PERCUTOR", "price": 100000, "description": ""}]
        first = apply_pricing_rules(copy.deepcopy(products))
        second = apply_pricing_rules(copy.deepcopy(first))
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
