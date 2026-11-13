import unittest

from annular_solid_fem import solve_annular_solid


class AnnularSolidFemTests(unittest.TestCase):
    def setUp(self):
        self.params = {
            "r_inner": 0.05,
            "r_outer": 0.1,
            "height": 0.08,
            "force": 100_000.0,
            "E": 200.0e9,
            "nu": 0.3,
            "yield_strength": 250.0e6,
            "nr": 8,
            "nz": 8,
        }

    def test_force_balance_and_unilateral_stops(self):
        result = solve_annular_solid(self.params)
        summary = result["summary"]

        self.assertAlmostEqual(summary["bottom_reaction"], self.params["force"], places=5)
        self.assertLess(summary["vertical_force_balance_error"], 1.0e-5)
        self.assertLessEqual(summary["max_outward_penetration"], 1.0e-10)
        self.assertGreater(summary["sigma_vm_max"], 0.0)
        self.assertTrue(summary["strength_ok"])

    def test_linear_response_scales_with_force(self):
        base = solve_annular_solid(self.params)["summary"]
        doubled = solve_annular_solid({
            **self.params,
            "force": 2.0 * self.params["force"],
        })["summary"]

        self.assertAlmostEqual(
            doubled["max_abs_uz"] / base["max_abs_uz"],
            2.0,
            places=6,
        )
        self.assertAlmostEqual(
            doubled["sigma_vm_max"] / base["sigma_vm_max"],
            2.0,
            places=6,
        )

    def test_invalid_geometry_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "bán kính"):
            solve_annular_solid({**self.params, "r_outer": self.params["r_inner"]})

    def test_strength_check_fails_above_yield(self):
        result = solve_annular_solid({
            **self.params,
            "yield_strength": 1.0e6,
        })

        self.assertFalse(result["summary"]["strength_ok"])
        self.assertGreater(result["summary"]["utilization"], 1.0)


if __name__ == "__main__":
    unittest.main()
