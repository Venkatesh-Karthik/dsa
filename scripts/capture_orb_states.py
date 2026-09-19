import os
from PIL import Image
from playwright.sync_api import sync_playwright

def run():
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
        print("Loading app...")
        page.goto("http://localhost:3000/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        container_el = page.locator(".cognora-orb-canvas-container")
        box = container_el.first.bounding_box()
        if not box:
            print("Orb not found!")
            browser.close()
            return

        pad = 25
        cx = int(box['x']) - pad
        cy = int(box['y']) - pad
        w = int(box['width']) + pad * 2
        h = int(box['height']) + pad * 2

        os.makedirs("test-artifacts/states", exist_ok=True)

        states = [
            ("IDLE", 0, 0.0),
            ("THINKING", 0.5, 0.0),
            ("SPEAKING", 0.8, 0.65),
            ("PAUSED", 0.0, 0.0),
            ("ERROR", 0.0, 0.0),
        ]

        for state_name, intensity, audio in states:
            page.evaluate(f"""() => {{
                const ctrl = window.__COGNORA_ORB_CONTROLLER__;
                if (ctrl) {{
                    ctrl.setState("{state_name}");
                    ctrl.setTeachingIntensity({intensity});
                    if ({audio} > 0) {{
                        ctrl.currentAudioBands = {{ low: 0.45, mid: 0.70, high: 0.55, energy: {audio} }};
                    }} else {{
                        ctrl.currentAudioBands = {{ low: 0, mid: 0, high: 0, energy: 0 }};
                    }}
                }}
            }}""")
            page.wait_for_timeout(600)
            full_path = f"test-artifacts/states/{state_name.lower()}_full.png"
            page.screenshot(path=full_path)
            
            img = Image.open(full_path)
            crop = img.crop((cx, cy, cx + w, cy + h))
            crop_path = f"test-artifacts/states/{state_name.lower()}_detail.png"
            crop.save(crop_path)
            print(f"Captured {state_name}: {crop_path}")

        # Now test tap ripple in IDLE mode
        page.evaluate("""() => {
            const ctrl = window.__COGNORA_ORB_CONTROLLER__;
            if (ctrl) {
                ctrl.setState("IDLE");
                ctrl.setTeachingIntensity(0);
                ctrl.resetPosition();
            }
        }""")
        page.wait_for_timeout(100)
        tap_full = "test-artifacts/states/tap_ripple_full.png"
        page.screenshot(path=tap_full)
        img = Image.open(tap_full)
        crop = img.crop((cx, cy, cx + w, cy + h))
        crop.save("test-artifacts/states/tap_ripple_detail.png")
        print("Captured TAP RIPPLE: test-artifacts/states/tap_ripple_detail.png")

        browser.close()

if __name__ == "__main__":
    run()
