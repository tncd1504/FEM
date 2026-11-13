"""Composite elasticity and independent embedded-line benchmarks."""
import math
import unittest

import numpy as np

from annular_pipe_fem import solve_annular_pipe
from annular_pipe_rc import solve_reinforced_pipe, solve_reinforced_with_checks


class ReinforcedPipeTests(unittest.TestCase):
    def setUp(self):
        self.base = {"r_inner": .2, "r_outer": .3, "E": 39.5e9, "nu": .2,
                     "prestress": 5e6, "nr": 6, "ntheta": 96, "compare_plain": False,
                     "reinforcement": {"longitudinal_count": 12, "longitudinal_diameter": .012,
                                       "hoop_diameter": .006, "hoop_pitch": .1, "cover": .03,
                                       "E_s": 200e9}}

    def test_zero_steel_recovers_plain_solution(self):
        params = {**self.base, "reinforcement": {"longitudinal_count": 0, "hoop_diameter": 0}}
        rc, plain = solve_reinforced_pipe(params), solve_annular_pipe(params)
        np.testing.assert_allclose(rc["nodal"]["u_r"], plain["nodal"]["u_r"], atol=1e-12)
        self.assertFalse(rc["reinforcement"]["has_steel"])
        self.assertEqual(rc["summary"]["strain_energy_increment_steel"], 0)

    def test_longitudinal_composite_axial_equilibrium_against_lame(self):
        # Circular continuum plus axial steel, no hoops. Lame A/B unchanged;
        # Ac*delta_sz + As*Es*ez = 0 and Ec*ez = delta_sz - 2*nu*A.
        params = {**self.base, "nr": 10,
                  "reinforcement": {**self.base["reinforcement"], "hoop_diameter": 0}}
        result = solve_reinforced_pipe(params)
        a, b, e, nu = .2, .3, 39.5e9, .2
        ac = math.pi*(b*b-a*a)
        area_s = 12*math.pi*.012**2/4
        aa, bb = -1e6*b*b/(b*b-a*a), -1e6*a*a*b*b/(b*b-a*a)
        ez = -2*nu*aa*ac/(e*ac+200e9*area_s)
        sz = -200e9*area_s*ez/ac
        u_outer = ((1-nu)*aa*b+(1+nu)*bb/b-nu*sz*b)/e
        self.assertAlmostEqual(result["summary"]["delta_epsilon_z"]/ez, 1, delta=.005)
        outer = np.array(result["mesh"]["outer_nodes"])-1
        self.assertAlmostEqual(np.mean(np.array(result["nodal"]["u_r"])[outer])/u_outer, 1, delta=.005)
        self.assertLess(abs(result["summary"]["axial_force_increment"]), 1e-4)
        self.assertAlmostEqual(result["summary"]["axial_force_increment_steel"], 200e9*area_s*result["summary"]["delta_epsilon_z"], places=7)
        self.assertAlmostEqual(result["summary"]["axial_force_increment_concrete"], -result["summary"]["axial_force_increment_steel"], places=5)

    def test_hoop_line_against_two_region_lame_interface_solution(self):
        # nu=0 decouples axial response. A zero-thickness hoop at h has
        # [sigma_r] = Es*(Ah/pitch)*u(h)/h**2 and continuous radial u.
        params = {**self.base, "nu": 0, "nr": 10,
                  "reinforcement": {**self.base["reinforcement"], "longitudinal_count": 0}}
        result = solve_reinforced_pipe(params)
        a, b, h, ec, es = .2, .3, .267, 39.5e9, 200e9
        ah = math.pi*.006**2/(4*.1)
        k = es*ah/(ec*h*h)
        matrix = np.array([[1, -1/a**2, 0, 0], [0, 0, 1, -1/b**2],
                           [h, 1/h, -h, -1/h],
                           [-1-k*h, 1/h**2-k/h, 1, -1/h**2]])
        ai, bi, ao, bo = np.linalg.solve(matrix, [0, -1e6, 0, 0])
        u_outer = (ao*b+bo/b)/ec
        u_h = (ai*h+bi/h)/ec
        outer = np.array(result["mesh"]["outer_nodes"])-1
        self.assertAlmostEqual(np.mean(np.array(result["nodal"]["u_r"])[outer])/u_outer, 1, delta=.006)
        mean_hoop = np.mean([p["stress_total"] for p in result["reinforcement"]["hoop_results"]])
        self.assertAlmostEqual(mean_hoop/(es*u_h/h), 1, delta=.015)

    def test_hoop_strain_matches_geometric_extension_of_embedded_segment(self):
        result = solve_reinforced_pipe(self.base)
        nt, nr = 96, 6
        rho = result["reinforcement"]["geometry"]["hoop_radius"]
        radial_index = min(int((rho-.2)/(.1/nr)), nr-1)
        fraction = (rho-(.2+radial_index*.1/nr))/(.1/nr)
        xy = np.array(result["mesh"]["coordinates"])
        u = np.c_[result["nodal"]["u_x"], result["nodal"]["u_y"]]
        for point in result["reinforcement"]["hoop_results"]:
            j, next_j = point["sector"], (point["sector"]+1) % nt
            n1, n2 = radial_index*nt+j, (radial_index+1)*nt+j
            n3, n4 = radial_index*nt+next_j, (radial_index+1)*nt+next_j
            x1, x2 = (1-fraction)*xy[n1]+fraction*xy[n2], (1-fraction)*xy[n3]+fraction*xy[n4]
            u1, u2 = (1-fraction)*u[n1]+fraction*u[n2], (1-fraction)*u[n3]+fraction*u[n4]
            edge = x2-x1
            strain = float(edge @ (u2-u1)/(edge @ edge))
            self.assertAlmostEqual(point["strain_increment"], strain, places=11)

    def test_axially_fixed_longitudinal_steel_has_no_increment(self):
        params = {**self.base, "axial_mode": "fixed_strain",
                  "reinforcement": {**self.base["reinforcement"], "hoop_diameter": 0}}
        rc, plain = solve_reinforced_pipe(params), solve_annular_pipe(params)
        np.testing.assert_allclose(rc["nodal"]["u_r"], plain["nodal"]["u_r"], atol=1e-12)
        self.assertTrue(all(p["stress_increment"] == 0 for p in rc["reinforcement"]["longitudinal_results"]))

    def test_initial_stress_is_counted_once_and_not_reapplied_as_load(self):
        params = {**self.base, "pressures": [],
                  "reinforcement": {**self.base["reinforcement"], "initial_longitudinal_stress": -10e6}}
        result = solve_reinforced_pipe(params)
        self.assertLess(result["summary"]["u_max"], 1e-14)
        area = result["reinforcement"]["summary"]["longitudinal_area"]
        self.assertAlmostEqual(result["summary"]["axial_force_initial_steel"], -10e6*area)
        self.assertAlmostEqual(result["reinforcement"]["longitudinal_results"][0]["stress_total"], -10e6)

    def test_more_hoop_steel_reduces_uniform_pressure_compliance(self):
        low = solve_reinforced_pipe(self.base)
        high = solve_reinforced_pipe({**self.base, "reinforcement": {**self.base["reinforcement"], "hoop_pitch": .05}})
        self.assertLess(high["summary"]["strain_energy_increment"], low["summary"]["strain_energy_increment"])
        self.assertGreater(high["summary"]["strain_energy_increment_steel"], 0)

    def test_components_add_and_steel_checks_are_separate(self):
        result = solve_reinforced_with_checks({**self.base, "tcvn": {"grade": "B60", "uls_prestress_factor": 1.1},
            "reinforcement": {**self.base["reinforcement"], "initial_longitudinal_stress": -10e6}})
        for section in result["sections"]:
            for name in ("N_theta", "M_theta", "N_z", "M_z"):
                self.assertAlmostEqual(section[name], section[name+"_concrete"]+section[name+"_steel"], places=8)
        checks = result["tcvn_checks"]
        self.assertEqual(checks["material"]["gamma_b2"], 1)
        self.assertTrue(any("longitudinal_results" in r["id"] for r in checks["rows"]))
        area = result["reinforcement"]["summary"]["longitudinal_area"]
        self.assertAlmostEqual(checks["cases"]["ULS"]["summary"]["axial_force_initial_steel"], -11e6*area)
        self.assertFalse(checks["full_tcvn_verification"])

    def test_d600_load_balance_and_comparison(self):
        n, nr = 48, 4
        node = lambda angle: nr*n+round(angle*n/360)+1
        result = solve_reinforced_with_checks({**self.base, "nr": nr, "ntheta": n, "pressures": [],
            "supports": [{"target": "node", "node_id": node(a), "kind": "upper", "value": 0} for a in (0, 180, 270)],
            "nodal_loads": [{"node_id": node(a), "force_r": -20000} for a in (60, 120)],
            "compare_plain": True})
        ground = next(r for r in result["reactions"] if r["node_id"] == node(270))
        self.assertAlmostEqual(-ground["reaction_r"], 20000*math.sqrt(3), places=5)
        for key in ("force_balance_x", "force_balance_y", "moment_balance"):
            self.assertLess(abs(result["summary"][key]), 1e-4)
        self.assertLess(result["summary"]["u_max"], result["comparison_plain"]["summary"]["u_max"])

    def test_bad_geometry_and_material_are_rejected(self):
        for values in ({"cover": .2}, {"cover": -.01}, {"hoop_pitch": 0}, {"hoop_pitch": .003}, {"E_s": 0},
                       {"longitudinal_count": 1.5}, {"longitudinal_count": 0, "initial_longitudinal_stress": 1},
                       {"longitudinal_count": 200, "longitudinal_diameter": .02},
                       {"longitudinal_grade": "PC"}, {"hoop_diameter": .003}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                solve_reinforced_pipe({**self.base, "reinforcement": {**self.base["reinforcement"], **values}})


if __name__ == "__main__":
    unittest.main()
