"""Hand-calculated material, tensor, load-case and deformation checks."""
import json
import math
import unittest

import numpy as np

from annular_pipe_fem import solve_annular_pipe
from tcvn5574_checks import (check_settings, evaluate_checks, material_catalog,
                              principal_stresses, solve_pipe_with_checks)


class TcvnChecksTests(unittest.TestCase):
    def setUp(self):
        self.base = {"r_inner": .8, "r_outer": 1.0, "E": 30e9, "nu": .2,
                     "prestress": 5e6, "nr": 3, "ntheta": 32,
                     "tcvn": {"enabled": True, "grade": "B30"}}

    @staticmethod
    def row(result, name):
        return next(r for r in result["tcvn_checks"]["rows"] if r["id"] == name)

    def test_catalog_table_values_and_no_double_material_factor(self):
        catalog = material_catalog()["grades"]
        self.assertEqual(catalog["B20"], {"Rb_MPa": 11.5, "Rbt_MPa": .9,
                                         "Rb_ser_MPa": 15, "Rbt_ser_MPa": 1.35, "Eb_GPa": 27.5})
        self.assertEqual(catalog["B100"]["Eb_GPa"], 43)
        result = solve_pipe_with_checks(self.base)
        material = result["tcvn_checks"]["material"]
        self.assertAlmostEqual(material["Rb_effective_Pa"], 17e6*.9)
        self.assertAlmostEqual(material["Rbt_effective_Pa"], 1.15e6)
        self.assertEqual(material["E_used_Pa"], 30e9)
        self.assertEqual(material["Eb_table_Pa"], 32.5e9)

    def test_working_factors_have_different_compression_tension_effects(self):
        result = solve_pipe_with_checks({**self.base, "tcvn": {
            "grade": "B30", "duration": "sustained", "vertical_pour_over_1_5m": True}})
        m = result["tcvn_checks"]["material"]
        self.assertAlmostEqual(m["Rb_effective_Pa"], 17e6*.9*.9*.85)
        self.assertAlmostEqual(m["Rbt_effective_Pa"], 1.15e6*.9)

    def test_principal_stress_includes_shear_and_axial_prestress(self):
        eigen = principal_stresses({"sigma_r": 0, "sigma_theta": 0, "tau_rt": 3e6, "sigma_z": -5e6})
        self.assertEqual(eigen, (3e6, -3e6, -5e6))
        for angle in (0, .25, 1.2):
            c, s = math.cos(angle), math.sin(angle)
            # Rotate principal stresses (4, -2) MPa into the local r/theta axes.
            point = {"sigma_r": (4*c*c-2*s*s)*1e6, "sigma_theta": (4*s*s-2*c*c)*1e6,
                     "tau_rt": 6*c*s*1e6, "sigma_z": -5e6}
            np.testing.assert_allclose(principal_stresses(point), (4e6, -2e6, -5e6), atol=1e-8)

    def test_zero_external_load_still_checks_effective_prestress(self):
        result = solve_pipe_with_checks({**self.base, "pressures": [], "prestress": 20e6})
        check = self.row(result, "uls_compression")
        self.assertEqual(check["status"], "exceeded")
        self.assertAlmostEqual(check["demand"], 20e6)
        self.assertAlmostEqual(check["ratio"], 20/15.3)

    def test_poisson_expansion_is_not_reported_as_tensile_cracking(self):
        result = solve_pipe_with_checks({**self.base, "pressures": []})
        self.assertEqual(self.row(result, "sls_cracking")["demand"], 0)
        self.assertEqual(self.row(result, "sls_cracking")["status"], "within_limits")
        self.assertAlmostEqual(result["tcvn_checks"]["deformation"]["equivalent_tensile_strain"], .2*5e6/30e9)

    def test_user_limits_pass_fail_missing_and_no_full_code_pass(self):
        result = solve_pipe_with_checks(self.base)
        self.assertEqual(self.row(result, "sls_radial")["status"], "not_assessed")
        self.assertFalse(result["tcvn_checks"]["full_tcvn_verification"])
        self.assertNotIn("strength_ok", result["summary"])
        result = solve_pipe_with_checks({**self.base, "tcvn": {"grade": "B30",
             "radial_displacement_limit_m": .001, "diameter_change_limit_ratio": .001}})
        self.assertEqual(self.row(result, "sls_radial")["status"], "within_limits")
        self.assertEqual(self.row(result, "sls_diameter")["status"], "within_limits")
        result = solve_pipe_with_checks({**self.base, "tcvn": {"grade": "B30",
             "radial_displacement_limit_m": .00001, "diameter_change_limit_ratio": .00001}})
        self.assertEqual(self.row(result, "sls_radial")["status"], "exceeded")
        self.assertEqual(self.row(result, "sls_diameter")["status"], "exceeded")

    def test_cracked_elastic_deformation_cannot_be_marked_as_passing(self):
        result = solve_pipe_with_checks({**self.base,
            "pressures": [{"boundary": "inner", "pressure": 1e6}],
            "tcvn": {"grade": "B30", "radial_displacement_limit_m": .1}})
        self.assertEqual(self.row(result, "sls_cracking")["status"], "exceeded")
        self.assertEqual(self.row(result, "sls_radial")["status"], "not_assessed")

    def test_sustained_load_deformation_is_not_instantaneous_pass(self):
        result = solve_pipe_with_checks({**self.base, "tcvn": {"grade": "B30", "duration": "sustained",
                                                               "radial_displacement_limit_m": .1}})
        self.assertEqual(self.row(result, "sls_radial")["status"], "not_assessed")
        self.assertFalse(result["tcvn_checks"]["deformation"]["elastic_uncracked_short_term"])

    def test_uls_resolves_contact_instead_of_scaling_the_sls_solution(self):
        result = solve_pipe_with_checks({**self.base,
            "supports": [{"target": "outer", "kind": "lower", "value": -.0002}],
            "tcvn": {"grade": "B30", "uls_load_factor": 2}})
        cases = result["tcvn_checks"]["cases"]
        self.assertEqual(cases["SLS"]["summary"]["active_unilateral_dofs"], 0)
        self.assertEqual(cases["ULS"]["summary"]["active_unilateral_dofs"], 32)
        self.assertAlmostEqual(cases["ULS"]["summary"]["prestress"], 5e6)
        # SLS displacement remains available and is not overwritten by ULS.
        self.assertGreater(result["nodal"]["u_r"][0], -.0002)

    def test_prescribed_motion_not_scaled_and_prestress_factor_is_separate(self):
        result = solve_pipe_with_checks({**self.base, "pressures": [],
            "supports": [{"target": "outer", "kind": "fixed", "value": .00001}],
            "tcvn": {"grade": "B30", "uls_load_factor": 2, "uls_prestress_factor": 1.1}})
        uls = result["tcvn_checks"]["cases"]["ULS"]["summary"]
        self.assertAlmostEqual(uls["prestress"], 5.5e6)
        self.assertAlmostEqual(uls["u_r_min"], .00001)

    def test_even_odd_diametral_checks_and_rigid_translation_cancellation(self):
        for nt in (16, 17):
            with self.subTest(nt=nt):
                p = {**self.base, "ntheta": nt, "include_check_points": True}
                base = solve_annular_pipe(p)
                angles = np.deg2rad(np.array(base["mesh"]["polar"])[:, 1])
                base["nodal"]["u_r"] = (-.0001 + .0003*np.cos(angles)).tolist()
                settings = check_settings({"grade": "B30"})
                check = evaluate_checks(base, base, p, settings)
                # Odd mesh uses linear periodic interpolation; small sampling error is expected.
                self.assertAlmostEqual(check["deformation"]["diameter_change"]["absolute_m"], .0002, delta=6e-6)

    def test_check_sampling_includes_surfaces_and_maps_match_worst_points(self):
        result = solve_pipe_with_checks(self.base)
        self.assertEqual(len(result["check_points"]), 8*result["summary"]["nel"])
        check = self.row(result, "uls_compression")
        self.assertAlmostEqual(check["ratio"], max(e["eta_uls_compression"] for e in result["element_results"]))
        self.assertIn(check["critical"]["point_id"][0], "GC")
        json.dumps(result, allow_nan=False)

    def test_disabled_checks_preserve_old_solver_contract(self):
        result = solve_pipe_with_checks({**self.base, "tcvn": {"enabled": False}})
        self.assertNotIn("tcvn_checks", result)
        self.assertNotIn("check_points", result)

    def test_invalid_settings_and_minimum_prestressed_grade(self):
        for settings in ({"grade": "C30"}, {"duration": "x"}, {"uls_load_factor": -1},
                         {"uls_load_factor": math.nan}, {"uls_load_factor": True},
                         {"radial_displacement_limit_m": 0}, {"diameter_change_limit_ratio": -1},
                         {"vertical_pour_over_1_5m": "false"}):
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                check_settings(settings)
        result = solve_pipe_with_checks({**self.base, "tcvn": {"grade": "B15"}})
        self.assertEqual(self.row(result, "prestressed_grade")["status"], "exceeded")


if __name__ == "__main__":
    unittest.main()
