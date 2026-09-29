import os
import sys
import time
import subprocess
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path("docs/screenshots")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def wait_for_url(url, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

def main():
    print("Starting backend server...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    print("Starting frontend preview server...")
    frontend_proc = subprocess.Popen(
        "npx vite preview --port 5173",
        shell=True,
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        print("Waiting for backend on http://127.0.0.1:8000/health...")
        if not wait_for_url("http://127.0.0.1:8000/health", timeout=25):
            print("Backend failed to start in time!")
            return

        print("Waiting for frontend on http://localhost:5173/...")
        if not wait_for_url("http://localhost:5173/", timeout=25):
            print("Frontend preview failed to start in time!")
            return

        print("Both servers online. Launching Playwright...")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # 1. Desktop Context (1366x768)
            desktop = browser.new_context(viewport={"width": 1366, "height": 768})
            page = desktop.new_page()
            page.set_default_timeout(15000)

            screenshots = [
                ("map_farmer_desktop.png", "http://localhost:5173/?region=ka-tumakuru&unit=PNC-KA-0001&view=farmer&lang=en", 3000),
                ("map_officer_desktop.png", "http://localhost:5173/?region=ka-tumakuru&unit=PNC-KA-0001&view=officer&lang=en", 3000),
                ("insights_desktop.png", "http://localhost:5173/insights?region=ka-tumakuru", 3500),
                ("advisories_desktop.png", "http://localhost:5173/advisories?region=ka-tumakuru&lang=en", 2500),
                ("compare_desktop.png", "http://localhost:5173/compare?region=ka-tumakuru", 2500),
                ("method_desktop.png", "http://localhost:5173/method?region=ka-tumakuru", 2500),
                ("bulletin_desktop.png", "http://localhost:5173/bulletin?region_id=ka-tumakuru&date=2026-05-15&lang=en&location_id=PNC-KA-0001", 5000),
                ("map_farmer_kannada.png", "http://localhost:5173/?region=ka-tumakuru&unit=PNC-KA-0001&view=farmer&lang=kn", 2500),
                ("map_farmer_marathi.png", "http://localhost:5173/?region=mh-ratnagiri&view=farmer&lang=mr", 2500),
            ]

            for name, url, wait_ms in screenshots:
                try:
                    print(f"Capturing {name}...")
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(wait_ms)
                    page.screenshot(path=str(OUTPUT_DIR / name))
                except Exception as ex:
                    print(f"Error capturing {name}: {ex}")

            desktop.close()

            # 2. Mobile Context (360x780)
            print("Capturing Map Farmer Mobile (360px)...")
            try:
                mobile = browser.new_context(viewport={"width": 360, "height": 780}, is_mobile=True)
                mobile_page = mobile.new_page()
                mobile_page.set_default_timeout(15000)
                mobile_page.goto("http://localhost:5173/?region=ka-tumakuru&unit=PNC-KA-0001&view=farmer&lang=en", wait_until="domcontentloaded")
                mobile_page.wait_for_timeout(3000)
                mobile_page.screenshot(path=str(OUTPUT_DIR / "map_farmer_mobile.png"))
                mobile.close()
            except Exception as ex:
                print(f"Error capturing mobile screenshot: {ex}")

            browser.close()
            print("All screenshots capture run finished!")

    finally:
        print("Terminating background servers...")
        try:
            backend_proc.terminate()
            backend_proc.kill()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
            frontend_proc.kill()
        except Exception:
            pass

if __name__ == "__main__":
    main()
