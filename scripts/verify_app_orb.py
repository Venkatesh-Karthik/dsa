import os
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--use-gl=angle",
                "--use-angle=swiftshader"
            ]
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        
        print("Navigating to http://localhost:3000/ ...")
        page.goto("http://localhost:3000/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        orb_el = page.locator(".cognora-orb-presence-root")
        orb_count = orb_el.count()
        print(f"Orb element count: {orb_count}")

        orb_logs = [l for l in logs if "[COGNORA][ORB]" in l or "renderer=" in l or "3D renderer active" in l]
        print("Orb diagnostic logs:")
        for ol in orb_logs:
            print("  ", ol)

        os.makedirs("test-artifacts", exist_ok=True)
        page.screenshot(path="test-artifacts/live_app_orb_verified.png")
        print("Saved test-artifacts/live_app_orb_verified.png")

        container_el = page.locator(".cognora-orb-canvas-container")
        if container_el.count() > 0:
            cbox = container_el.first.bounding_box()
            if cbox:
                cx = cbox['x'] + cbox['width'] * 0.5
                cy = cbox['y'] + cbox['height'] * 0.5
                print(f"Container center: cx={cx}, cy={cy}")

                # Hover over center of orb
                page.mouse.move(cx, cy)
                page.wait_for_timeout(600)
                page.screenshot(path="test-artifacts/live_app_orb_hover.png")
                print("Saved test-artifacts/live_app_orb_hover.png")

                # Drag the orb
                page.mouse.down()
                page.mouse.move(cx + 250, cy - 150, steps=15)
                page.wait_for_timeout(300)
                page.screenshot(path="test-artifacts/live_app_orb_drag.png")
                print("Saved test-artifacts/live_app_orb_drag.png")

                # Release drag
                page.mouse.up()
                page.wait_for_timeout(600)
                page.screenshot(path="test-artifacts/live_app_orb_settled.png")
                print("Saved test-artifacts/live_app_orb_settled.png")

        browser.close()

if __name__ == "__main__":
    verify()
