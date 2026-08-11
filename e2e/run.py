"""Self-contained e2e runner: builds nothing, starts `npm run dev`, waits for
the port, runs the smoke suite, and always tears the server down.

Usage: python3 e2e/run.py   (or: npm run e2e)
"""

import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).parent.parent
PORT = 3000


def port_open() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def main() -> int:
    if port_open():
        print(f"reusing server already running on :{PORT}")
        server = None
    else:
        server = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=REPO,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )
        for _ in range(120):
            if port_open():
                break
            time.sleep(1)
        else:
            print("server never came up on :3000")
            os.killpg(os.getpgid(server.pid), signal.SIGTERM)
            return 1
        time.sleep(2)

    try:
        return subprocess.call([sys.executable, str(REPO / "e2e" / "smoke.py")])
    finally:
        if server is not None:
            os.killpg(os.getpgid(server.pid), signal.SIGTERM)
            server.wait(timeout=15)


if __name__ == "__main__":
    sys.exit(main())
