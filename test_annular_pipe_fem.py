"""Independent elasticity and contact benchmarks for the long-pipe model."""
import math
import unittest

import numpy as np

from annular_pipe_fem import pipe_mesh, solve_annular_pipe


class AnnularPipeTests(unittest.TestCase):
    def setUp(self):
        self.base = {"r_inner": 0.8, "r_outer": 1.0, "E": 30e9, "nu": 0.2,
                     "prestress": 5e6, "nr": 8, "ntheta": 96}

    def test_lame_solution_and_mesh_convergence(self):
        # Lame thick-cylinder solution with constant axial resultant:
        # delta sigma_z = 0, u = [(1-nu) A r + (1+nu) B/r] / E.
        a, b, pressure, nu, young = 0.8, 1.0, 1e6, 0.2, 30e9
        aa = -pressure * b*b / (b*b-a*a)
        bb = -pressure * a*a*b*b / (b*b-a*a)
        exact = ((1-nu)*aa*b + (1+nu)*bb/b) / young
        fine = solve_annular_pipe(self.base)
        coarse = solve_annular_pipe({**self.base, "nr": 2, "ntheta": 24})
        outer = fine["mesh"]["outer_nodes"]
        computed = np.mean([fine["nodal"]["u_r"][i-1] for i in outer])
        coarse_outer = coarse["mesh"]["outer_nodes"]
        coarse_u = np.mean([coarse["nodal"]["u_r"][i-1] for i in coarse_outer])
        self.assertLess(abs(computed/exact - 1), 0.005)
        self.assertLess(abs(computed-exact), abs(coarse_u-exact))
        # Check stress against the radial Lame distribution, not the code's
        # own integration or displacement formula.
        for stress in fine["gauss_results"]:
            r = stress["radius"]
            self.assertAlmostEqual(stress["sigma_theta"] / (aa+bb/r**2), 1, delta=0.025)
            self.assertLess(abs(stress["delta_sigma_z"]), 0.025 * pressure)
        self.assertLess(abs(fine["summary"]["axial_force_increment"]), 1e-4)
        # N_theta = -p*b across a radial cut in the continuum limit.
        self.assertAlmostEqual(fine["sections"][0]["N_theta"] / (-pressure*b), 1, delta=0.005)

    def test_fixed_incremental_axial_strain(self):
        result = solve_annular_pipe({**self.base, "axial_mode": "fixed_strain"})
        expected_sz = 2 * 0.2 * (-1e6/(1-0.8**2))
        mean = result["summary"]["axial_force_increment"] / result["summary"]["mesh_area"]
        self.assertAlmostEqual(mean/expected_sz, 1, delta=0.005)
        self.assertEqual(result["summary"]["delta_epsilon_z"], 0)

    def test_prestress_is_effective_reference_not_a_second_load(self):
        zero = solve_annular_pipe({**self.base, "prestress": 0})
        initial = solve_annular_pipe(self.base)
        np.testing.assert_allclose(initial["nodal"]["u_r"], zero["nodal"]["u_r"], atol=1e-12)
        for a, b in zip(initial["gauss_results"], zero["gauss_results"]):
            self.assertAlmostEqual(a["sigma_z"] - b["sigma_z"], -5e6, places=5)
        only = solve_annular_pipe({**self.base, "pressures": []})
        self.assertLess(only["summary"]["u_max"], 1e-12)
        for section in only["sections"]:
            self.assertAlmostEqual(section["N_z"], -5e6 * only["summary"]["section_thickness"], places=5)
            self.assertAlmostEqual(section["M_z"], 0, places=7)

    def test_outward_stop_opens_under_external_pressure(self):
        free = solve_annular_pipe(self.base)
        result = solve_annular_pipe({**self.base, "supports": [
            {"target": "outer", "direction": "r", "kind": "upper", "value": 0}]})
        self.assertEqual(result["summary"]["active_unilateral_dofs"], 0)
        np.testing.assert_allclose(result["nodal"]["u_r"], free["nodal"]["u_r"], atol=1e-11)
        self.assertLess(max(abs(r["reaction_r"]) for r in result["reactions"]), 1e-3)

    def test_outward_stop_engages_under_internal_pressure(self):
        result = solve_annular_pipe({**self.base,
            "pressures": [{"boundary": "inner", "pressure": 1e6}],
            "supports": [{"target": "outer", "direction": "r", "kind": "upper", "value": 0}]})
        for i in result["mesh"]["outer_nodes"]:
            self.assertLess(abs(result["nodal"]["u_r"][i-1]), 1e-12)
        self.assertEqual(result["summary"]["active_unilateral_dofs"], 96)
        self.assertTrue(all(r["reaction_r"] < 0 for r in result["reactions"]))
        self.assertLess(result["summary"]["free_residual"], 1e-3)

    def test_gap_and_lower_stop(self):
        result = solve_annular_pipe({**self.base, "supports": [
            {"target": "outer", "direction": "r", "kind": "lower", "value": -2e-5}]})
        for i in result["mesh"]["outer_nodes"]:
            self.assertAlmostEqual(result["nodal"]["u_r"][i-1], -2e-5, places=11)
        self.assertTrue(all(r["reaction_r"] > 0 for r in result["reactions"]))

    def test_unbalanced_load_needs_physical_support(self):
        with self.assertRaisesRegex(ValueError, "không thể cân bằng"):
            solve_annular_pipe({**self.base, "nr": 2, "ntheta": 24,
                                "pressures": [], "nodal_loads": [{"node_id": 1, "force_r": 1000}]})
        result = solve_annular_pipe({**self.base, "nr": 2, "ntheta": 24,
            "pressures": [], "nodal_loads": [{"node_id": 1, "force_r": -1000}],
            "supports": [{"target": "outer", "direction": "r", "kind": "fixed", "value": 0}]})
        self.assertLess(abs(result["summary"]["force_balance_x"]), 1e-4)
        self.assertLess(abs(result["summary"]["force_balance_y"]), 1e-4)
        self.assertLess(abs(result["summary"]["moment_balance"]), 1e-4)

    def test_validation(self):
        for params in ({"r_inner": 2}, {"ntheta": 12.5}, {"r_outer": math.inf},
                       {"nu": 0.5}, {"prestress": -1}, {"axial_mode": "unknown"},
                       {"nodal_loads": [{"node_id": 0}]},
                       {"supports": [{"node_id": 1, "kind": "lower", "value": 1},
                                     {"node_id": 1, "kind": "upper", "value": 0}]}):
            with self.subTest(params=params), self.assertRaises(ValueError):
                solve_annular_pipe({**self.base, "nr": 1, "ntheta": 8, **params})
        self.assertEqual(pipe_mesh({"nr": 1, "ntheta": 8})["nel"], 8)

    def test_partial_pressure_contact_balance_and_nonzero_prescription(self):
        model = {**self.base, "nr": 3, "ntheta": 32}
        result = solve_annular_pipe({**model,
            "pressures": [{"boundary": "outer", "pressure": 1e6,
                           "start_deg": 0, "end_deg": 180}],
            "supports": [{"target": "outer", "kind": "upper", "value": 0}]})
        for reaction in result["reactions"]:
            self.assertLessEqual(reaction["reaction_r"], 1e-3)
            self.assertLessEqual(result["nodal"]["u_r"][reaction["node_id"]-1], 1e-10)
        for key in ("force_balance_x", "force_balance_y", "moment_balance"):
            self.assertLess(abs(result["summary"][key]), 1e-3)
        prescribed = solve_annular_pipe({**model, "pressures": [],
            "supports": [{"target": "outer", "kind": "fixed", "value": 1e-4}]})
        for node in prescribed["mesh"]["outer_nodes"]:
            self.assertAlmostEqual(prescribed["nodal"]["u_r"][node-1], 1e-4, places=12)


if __name__ == "__main__":
    unittest.main()
