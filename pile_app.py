"""Dedicated local site for finite 3D piles and existing cross-section models."""
import argparse
from http.server import ThreadingHTTPServer
import os
import sys

from app import FEMRequestHandler


class PileRequestHandler(FEMRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.path = "/piles.html"
        return super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("PILES_PORT", "8083")))
    parser.add_argument("--no-browser", action="store_true", help="Compatibility flag; this server does not launch external windows.")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PileRequestHandler)
    print(f"Pile FEM ready: http://127.0.0.1:{server.server_port}/", flush=True)
    print("3D: /pile3d.html  |  Cross section: /pipe.html  |  Reinforced: /pipe_rc.html", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
