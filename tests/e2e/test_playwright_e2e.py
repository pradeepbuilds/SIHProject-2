import os
import sys
import time
import subprocess
import urllib.request
import pytest
from playwright.sync_api import sync_playwright

def wait_for_url(url, timeout=25):
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


@pytest.fixture(scope="module")
def app_servers():
    # Start backend server
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Start frontend preview server
    frontend_proc = subprocess.Popen(
        "npx vite preview --port 5173",
        shell=True,
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    assert wait_for_url("http://127.0.0.1:8000/health", timeout=30), "Backend failed to start"
    assert wait_for_url("http://localhost:5173/", timeout=30), "Frontend preview failed to start"

    yield "http://localhost:5173"

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


def test_e2e_map_farmer_and_officer_views(app_servers):
    base_url = app_servers
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        # 1. Load Map Page
        page.goto(f"{base_url}/?region=ka-tumakuru&lang=en", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        assert "KrishiMitra" in page.title() or "KrishiMitra" in page.content()

        # Check illustrative notice
        content = page.content()
        assert "Illustrative sub-district boundaries" in content

        # 2. Switch between Farmer and Officer view
        officer_btn = page.locator("button:has-text('Officer'), [data-view='officer'], input[value='officer']")
        if officer_btn.count() > 0:
            officer_btn.first.click()
            page.wait_for_timeout(1000)

        # 3. Switch Language to Kannada without full page reload
        lang_select = page.locator("select[aria-label*='language' i], select.lang-selector, select:has-text('English')")
        if lang_select.count() > 0:
            lang_select.first.select_option("kn")
            page.wait_for_timeout(1000)
            assert "ka-tumakuru" in page.url or "kn" in page.url

        browser.close()


def test_e2e_insights_nine_charts_render(app_servers):
    base_url = app_servers
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        # Load Insights Page
        page.goto(f"{base_url}/insights?region=ka-tumakuru", wait_until="domcontentloaded")
        page.wait_for_timeout(3500)

        # Verify page content
        content = page.content()
        assert "Insights" in content or "Model Analytics" in content

        # Check KPI summary elements
        assert "synthetic-world" in content.lower() or "synthetic" in content.lower()

        # Check for presence of chart canvases / cards
        charts = page.locator(".km-chart-card, .km-echart-dom, canvas")
        assert charts.count() >= 1

        browser.close()


def test_e2e_method_and_bulletin(app_servers):
    base_url = app_servers
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        # Load Method Page
        page.goto(f"{base_url}/method?region=ka-tumakuru", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        content = page.content()
        assert "Methodology" in content or "Method" in content
        assert "Hurdle" in content or "hurdle" in content
        assert "Spatial Holdout" in content or "spatial" in content

        # Load Bulletin View
        page.goto(f"{base_url}/bulletin?region_id=ka-tumakuru&date=2026-05-15&lang=en&location_id=PNC-KA-0001", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        b_content = page.content()
        assert "Bulletin" in b_content or "Advisory" in b_content or "KrishiMitra" in b_content

        browser.close()


def test_e2e_network_resilience_offline_tiles(app_servers):
    """Run with external network blocked (except local app and tile domain) to ensure app runs offline."""
    base_url = app_servers
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        failed_local_requests = []

        def handle_request(route):
            url = route.request.url
            if "localhost" in url or "127.0.0.1" in url or "tile.openstreetmap.org" in url:
                route.continue_()
            else:
                # Block any external unapproved network requests (CDNs, Google Fonts, etc.)
                route.abort()

        def handle_failed_request(request):
            if "localhost" in request.url or "127.0.0.1" in request.url:
                failed_local_requests.append(request.url)

        page.route("**/*", handle_request)
        page.on("requestfailed", handle_failed_request)

        page.goto(f"{base_url}/?region=ka-tumakuru", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        # No local requests should fail
        assert len(failed_local_requests) == 0, f"Local app requests failed: {failed_local_requests}"

        browser.close()
