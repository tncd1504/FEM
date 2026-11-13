"""Exercise the actual HTTP contract, including validation errors."""
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app import FEMRequestHandler


class QuietHandler(FEMRequestHandler):
    def log_message(self, *args):
        pass


class PipeApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def post(self, path, body):
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            response = urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def test_mesh_solve_and_error_contract(self):
        status, data = self.post("/api/pipe/mesh", {"nr": 2, "ntheta": 16})
        self.assertEqual(status, 200)
        self.assertEqual(len(data["mesh"]["elements"]), 32)
        self.assertEqual(min(min(e) for e in data["mesh"]["elements"]), 1)
        status, data = self.post("/api/pipe/solve", {"nr": 2, "ntheta": 16})
        self.assertEqual(status, 200)
        self.assertEqual(len(data["result"]["sections"]), 16)
        self.assertGreaterEqual(data["result"]["summary"]["solve_time_ms"], 0)
        self.assertNotIn("strength_ok", data["result"]["summary"])
        for params in ({"r_inner": 2}, []):
            status, data = self.post("/api/pipe/solve", params)
            self.assertEqual(status, 400)
            self.assertFalse(data["ok"])
            self.assertTrue(data["error"])

    def test_local_page_and_assets(self):
        for path, mime in (("/pipe.html", "text/html"), ("/pipe.js", "javascript"),
                           ("/pipe.css", "text/css")):
            with self.subTest(path=path), urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(mime, response.headers["Content-Type"])
                self.assertGreater(len(response.read()), 100)

    def test_tcvn_catalog_and_checked_analysis(self):
        with urllib.request.urlopen(self.base + "/api/pipe/tcvn-materials") as response:
            catalog = json.load(response)
        self.assertEqual(catalog["grades"]["B30"]["Rb_MPa"], 17)
        status, data = self.post("/api/pipe/solve", {"nr": 2, "ntheta": 16,
            "tcvn": {"grade": "B30", "uls_load_factor": 1.4}})
        self.assertEqual(status, 200)
        checks = data["result"]["tcvn_checks"]
        self.assertEqual(checks["cases"]["ULS"]["load_factor"], 1.4)
        self.assertFalse(checks["full_tcvn_verification"])
        self.assertTrue(any(row["id"] == "sls_radial" for row in checks["rows"]))
        status, data = self.post("/api/pipe/solve", {"tcvn": {"grade": "not supported"}})
        self.assertEqual(status, 400)
        self.assertFalse(data["ok"])

    def test_reinforced_problem_is_a_separate_endpoint_and_page(self):
        with urllib.request.urlopen(self.base + "/api/pipe-rc/steel-materials") as response:
            self.assertEqual(json.load(response)["grades"]["CB400-V"]["Rs_MPa"], 350)
        status, data = self.post("/api/pipe-rc/solve", {"nr": 2, "ntheta": 16,
            "r_inner": .2, "r_outer": .3, "reinforcement": {}, "compare_plain": True,
            "tcvn": {"grade": "B60"}})
        self.assertEqual(status, 200)
        self.assertTrue(data["result"]["reinforcement"]["has_steel"])
        self.assertIn("comparison_plain", data["result"])
        for path in ("/pipe_rc.html", "/pipe_rc.js"):
            with urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)


if __name__ == "__main__":
    unittest.main()
