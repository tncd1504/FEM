"""Independent element, continuum, contact, and HTTP checks for the 3D pile."""
import json
import math
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import numpy as np

from pile_app import PileRequestHandler
from pile_solid3d import GP, SIGNS, constitutive, element_operators, make_mesh, solve_pile_solid3d


class BrickTests(unittest.TestCase):
    def test_distorted_affine_patch_and_six_rigid_modes(self):
        xyz = SIGNS * [.2, .3, 2.]
        xyz[6] += [.03, .02, .1]
        stiffness, recovery, _ = element_operators(xyz, constitutive(39.5e9, .2))
        gradient = np.array([[.01, .02, .03], [.02, -.01, .04], [.01, .03, .005]])
        u = (xyz @ gradient.T).ravel()
        strain = [gradient[0, 0], gradient[1, 1], gradient[2, 2],
                  gradient[0, 1] + gradient[1, 0], gradient[0, 2] + gradient[2, 0],
                  gradient[1, 2] + gradient[2, 1]]
        for point in GP:
            np.testing.assert_allclose(recovery(point)[1] @ u, strain, atol=1e-12)
        eig = np.linalg.eigvalsh(stiffness)
        self.assertEqual(np.count_nonzero(eig > eig[-1] * 1e-9), 18)
        for axis in np.eye(3):
            for rigid in (np.tile(axis, (8, 1)), np.cross(axis, xyz)):
                self.assertLess(np.linalg.norm(stiffness @ rigid.ravel()) / np.linalg.norm(stiffness), 1e-12)

    def test_pure_bending_stress_and_energy(self):
        xyz = SIGNS * [.2, .3, 2.]
        e, nu, curvature = 39.5e9, .2, .001
        x, y, z = xyz.T
        u = np.c_[nu * curvature * x * y,
                  .5 * curvature * (z*z + nu * (y*y-x*x)), -curvature*y*z].ravel()
        d = constitutive(e, nu)
        stiffness, recovery, _ = element_operators(xyz, d)
        for point in GP:
            n, b, _ = recovery(point)
            expected = [0, 0, -e*curvature*(n @ xyz[:, 1]), 0, 0, 0]
            np.testing.assert_allclose(d @ b @ u, expected, atol=1e-5)
        expected_energy = .5 * e * curvature**2 * (.4 * .6**3 / 12) * 4
        self.assertAlmostEqual(.5 * u @ stiffness @ u, expected_energy, places=6)
        full, _, _ = element_operators(xyz, d, False)
        self.assertGreater(.5 * u @ full @ u, 5 * expected_energy)


class PileSolidTests(unittest.TestCase):
    base = {"nr": 1, "ntheta": 24, "nz": 8, "length": 2, "support_width": .1}

    def test_two_supports_equilibrium_and_unilateral_complementarity(self):
        for surface in ("flat", "saddle"):
            with self.subTest(surface=surface):
                result = solve_pile_solid3d({**self.base, "support_shape": surface})
                s = result["summary"]
                np.testing.assert_allclose(s["force_balance"], 0, atol=1e-5)
                np.testing.assert_allclose(s["moment_balance"], 0, atol=1e-5)
                for support, position in zip(result["supports"], (.4, 1.6)):
                    self.assertAlmostEqual(support["center_z"], position)
                    self.assertAlmostEqual(support["reaction"][1], 20000 * math.sqrt(3), places=4)
                    self.assertGreaterEqual(support["normal_clearance_min"], -1e-10)
                    self.assertGreaterEqual(support["normal_reaction_min"], -1e-5)
                self.assertLess(s["gauge_force"], 1e-5)

    def test_effective_prestress_is_not_reapplied(self):
        result = solve_pile_solid3d({**self.base, "line_loads": []})
        self.assertLess(result["summary"]["u_max"], 1e-12)
        np.testing.assert_allclose(result["summary"]["total_reaction"], 0, atol=1e-5)
        for point in result["element_results"]:
            self.assertAlmostEqual(point["sigma_z"], -5e6, delta=1e-4)
        for section in result["section_resultants"]:
            self.assertAlmostEqual(section["N_z"], result["summary"]["initial_axial_force"], delta=1e-4)

    def test_load_scaling_and_liftoff_is_not_a_tension_support(self):
        a = solve_pile_solid3d(self.base)
        b = solve_pile_solid3d({**self.base, "line_loads": [{"angle_deg": a, "value": 40000} for a in (60, 120)]})
        np.testing.assert_allclose(b["nodal"]["u_y"], 2*np.array(a["nodal"]["u_y"]), atol=1e-10)
        self.assertAlmostEqual(b["summary"]["strain_energy"]/a["summary"]["strain_energy"], 4, places=6)
        with self.assertRaisesRegex(ValueError, "không thể cân bằng"):
            solve_pile_solid3d({**self.base, "line_loads": [{"angle_deg": a, "value": -20000} for a in (60, 120)]})

    def test_3d_lame_free_ends_and_self_weight(self):
        p = {**self.base, "nr": 4, "ntheta": 48, "nz": 4, "length": 1,
             "line_loads": [], "support_fractions": [], "outer_pressure": 1e6, "prestress": 0}
        result = solve_pile_solid3d(p)
        aa = -1e6 * .3**2 / (.3**2 - .2**2)
        bb = aa * .2**2
        exact = ((1-.2)*aa*.3 + (1+.2)*bb/.3) / 39.5e9
        mesh = result["mesh"]
        outer = [k*mesh["nplane"] + mesh["nr"]*mesh["ntheta"]+j
                 for k in range(mesh["nz"]+1) for j in range(mesh["ntheta"])]
        computed = np.mean(np.array(result["nodal"]["u_r"])[outer])
        self.assertAlmostEqual(computed/exact, 1, delta=.015)
        axial_error = max(abs(s["sigma_z"]) for s in result["element_results"])
        self.assertLess(axial_error, .005 * 1e6)
        self.assertLess(max(abs(s["N_z"]) for s in result["section_resultants"]), 1e-5)
        # Curved H8 geometry is polygonal. Verify that the parasitic axial
        # stress converges to zero, rather than demanding exact continuum
        # stresses from a finite radial/angular discretization.
        fine = solve_pile_solid3d({**p, "nr": 6, "ntheta": 72})
        fine_error = max(abs(s["sigma_z"]) for s in fine["element_results"])
        self.assertLess(fine_error, .65 * axial_error)
        fm = fine["mesh"]
        fine_outer = [k*fm["nplane"] + fm["nr"]*fm["ntheta"]+j
                      for k in range(fm["nz"]+1) for j in range(fm["ntheta"])]
        fine_u = np.mean(np.array(fine["nodal"]["u_r"])[fine_outer])
        self.assertLess(abs(fine_u-exact), abs(computed-exact))
        weight = solve_pile_solid3d({**self.base, "line_loads": [], "self_weight": True})
        self.assertAlmostEqual(weight["summary"]["total_reaction"][1], weight["summary"]["volume"]*2500*9.81, places=4)

    def test_mesh_keeps_exact_geometry_and_support_positions(self):
        mesh = make_mesh({"r_outer": .4, "r_inner": .28, "length": 12, "nr": 2, "ntheta": 24, "nz": 11})
        for z in (2.25, 2.4, 2.55, 9.45, 9.6, 9.75):
            self.assertLess(np.min(np.abs(mesh["z_planes"]-z)), 1e-10)
        for params in ({"r_inner": .5}, {"support_fractions": [.8, .2]}, {"support_width": 20},
                       {"length": float("nan")}, {"nr": 8, "ntheta": 144, "nz": 200}, {"support_shape": "fixed"}):
            with self.subTest(params=params), self.assertRaises(ValueError):
                make_mesh(params)

    def test_long_pile_matches_beam_resultants_and_deflection(self):
        result = solve_pile_solid3d({"nr": 1, "ntheta": 24, "nz": 20, "support_width": 0})
        q, length, e, nu = 40000*math.sin(math.pi/3), 12., 39.5e9, .2
        area, inertia = math.pi*(.3**2-.2**2), math.pi*(.3**4-.2**4)/4
        a, span = .2*length, .6*length
        m2 = (.2/.3)**2
        # Cowper shear coefficient for an annular section; Euler bending
        # plus Timoshenko shear for the uniformly loaded overhanging beam.
        shear_factor = 6*(1+nu)*(1+m2)**2/((7+6*nu)*(1+m2)**2+(20+12*nu)*m2)
        exact = q*(5*span**4/384-a*a*span*span/16)/(e*inertia)
        exact += q*span*span/(8*shear_factor*(e/(2*(1+nu)))*area)
        computed = -min(p["u_y"] for p in result["axis_displacements"])
        self.assertAlmostEqual(computed/exact, 1, delta=.05)
        for section in result["section_resultants"]:
            z = section["z"]
            if min(abs(z-a), abs(z-(length-a))) < .6:
                continue
            left = [p for p in result["supports"] if p["center_z"] < z]
            shear = q*z-sum(p["reaction"][1] for p in left)
            moment = q*z*z/2-sum((z-p["center_z"])*p["reaction"][1] for p in left)
            self.assertAlmostEqual(section["V_y"], shear, delta=1e-3)
            self.assertAlmostEqual(section["M_x"], moment, delta=.0006*q*length*length)


class QuietPileHandler(PileRequestHandler):
    def log_message(self, *args):
        pass


class PileSiteApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietPileHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def post(self, endpoint, p):
        request = urllib.request.Request(self.url + endpoint, data=json.dumps(p).encode(), headers={"Content-Type": "application/json"})
        try:
            response = urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as e:
            response = e
        with response:
            return response.status, json.load(response)

    def test_dedicated_site_routes_and_legacy_cross_sections(self):
        for path in ("/", "/piles.html", "/pile3d.html", "/pile3d.js", "/piles.css", "/pipe.html", "/pipe_rc.html"):
            with self.subTest(path=path), urllib.request.urlopen(self.url+path) as response:
                text = response.read().decode("utf-8")
                self.assertGreater(len(text), 100)
                if path == "/":
                    self.assertIn("Chọn mô hình tính", text)
        status, data = self.post("/api/pile3d/mesh", PileSolidTests.base)
        self.assertEqual(status, 200)
        self.assertEqual(min(min(e) for e in data["mesh"]["elements"]), 1)
        status, data = self.post("/api/pile3d/solve", PileSolidTests.base)
        self.assertEqual(status, 200)
        self.assertEqual(data["result"]["model"]["type"], "finite_hollow_pile_solid_3d")
        self.assertFalse(data["result"]["screens"]["full_tcvn_verification"])
        for params in ([], {"length": -1}, {"support_fractions": [1, 2]}):
            status, data = self.post("/api/pile3d/solve", params)
            self.assertEqual(status, 400)
            self.assertFalse(data["ok"])


if __name__ == "__main__":
    unittest.main()
