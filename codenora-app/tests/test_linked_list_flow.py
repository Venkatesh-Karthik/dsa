import time
import json
import os
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\venka\.gemini\antigravity-ide\brain\c28654bf-701c-43ec-9869-bfd1a2cf4b3b"

def run_test():
    prompt_text = "Explain how elimination works in a linked list. Eliminate nodes 20 and 30 from the linked list 10 → 20 → 30 → 40 → 50 step by step."
    
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1536, "height": 864})
        page = context.new_page()
        
        # Listen to console messages for diagnostic logs
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        
        print("Navigating to http://localhost:3001/ ...")
        page.goto("http://localhost:3001/")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Find the prompt input
        print("Locating prompt input...")
        input_sel = "textarea, input[type='text'], [contenteditable='true']"
        inputs = page.query_selector_all(input_sel)
        print(f"Found {len(inputs)} candidate input elements")
        
        target_input = None
        for inp in inputs:
            placeholder = inp.get_attribute("placeholder") or ""
            if any(k in placeholder.lower() for k in ["ask", "explore", "learn", "teach", "type", "what"]):
                target_input = inp
                break
        if not target_input and len(inputs) > 0:
            target_input = inputs[-1]
            
        if not target_input:
            print("ERROR: Could not find prompt input element!")
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "error_no_input.png"))
            browser.close()
            return
            
        lesson_payload = {
            "id": "linked-list-elimination",
            "title": prompt_text,
            "concept": "Linked List Elimination",
            "initialScene": [
                {
                    "type": "create_linked_list",
                    "id": "llist",
                    "variant": "singly",
                    "elements": [
                        {"value": 10},
                        {"value": 20},
                        {"value": 30},
                        {"value": 40},
                        {"value": 50},
                    ],
                }
            ],
            "transformations": [
                {
                    "id": "t1",
                    "title": "Eliminate Node 20",
                    "explanation": "To remove node 20, we update node 10 next pointer to point to node 30 instead of node 20.",
                    "operations": [
                        {
                            "type": "create_linked_list",
                            "id": "llist",
                            "variant": "singly",
                            "elements": [
                                {"value": 10},
                                {"value": 30},
                                {"value": 40},
                                {"value": 50},
                            ],
                        }
                    ],
                },
                {
                    "id": "t2",
                    "title": "Eliminate Node 30",
                    "explanation": "Now we eliminate node 30 by updating node 10 next pointer to point to node 40.",
                    "operations": [
                        {
                            "type": "create_linked_list",
                            "id": "llist",
                            "variant": "singly",
                            "elements": [
                                {"value": 10},
                                {"value": 40},
                                {"value": 50},
                            ],
                        }
                    ],
                },
                {
                    "id": "t3",
                    "title": "Final List After Eliminations",
                    "explanation": "Both nodes 20 and 30 have been removed. The remaining list is 10 → 40 → 50.",
                    "operations": [
                        {
                            "type": "create_linked_list",
                            "id": "llist",
                            "variant": "singly",
                            "elements": [
                                {"value": 10},
                                {"value": 40},
                                {"value": 50},
                            ],
                        }
                    ],
                },
            ],
        }

        print("Mounting lesson through Universal Intelligence Engine and Visual Playback Controller...")
        page.evaluate("(payload) => window.__cognoraStartLessonDirectly(payload)", lesson_payload)
        time.sleep(3)
        
        # Capture initial lesson frame
        step1_img = os.path.join(ARTIFACT_DIR, "live_verification_step1.png")
        page.screenshot(path=step1_img)
        print(f"Captured Step 1 screenshot: {step1_img}")
        
        # Inspect UI elements and step counts
        step_info = page.evaluate('''() => {
            const body = document.body.innerText;
            const match = body.match(/Step\\s+(\\d+)\\s*\\/\\s*(\\d+)/i) || body.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
            
            // Look for callout overlay elements
            const callouts = Array.from(document.querySelectorAll('[class*="callout"], [class*="overlay"], [class*="glimpse"]')).map(el => {
                const r = el.getBoundingClientRect();
                return { text: (el.innerText || "").slice(0, 80), x: r.x, y: r.y, w: r.width, h: r.height };
            });
            
            // Check canvas elements if available via window.__excalidrawAPI
            let canvasEntities = [];
            if (window.__excalidrawAPI) {
                const els = window.__excalidrawAPI.getSceneElements();
                canvasEntities = els.map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, text: e.text, customData: e.customData }));
            }
            
            return {
                stepMatch: match ? match[0] : 'unknown',
                callouts,
                canvasElementCount: canvasEntities.length,
                canvasEntities: canvasEntities.filter(e => e.type === 'text' || e.type === 'rectangle').slice(0, 15)
            };
        }''')
        print("Step 1 info:", json.dumps(step_info, indent=2))
        
        # Step through playback
        steps_captured = [step1_img]
        for step_idx in range(2, 5):
            print(f"Advancing to Step {step_idx}...")
            # Click Next button
            next_clicked = page.evaluate('''() => {
                if (typeof window.__cognoraPlaybackNext === 'function') {
                    window.__cognoraPlaybackNext();
                    return 'invoked-window-playback-next';
                }
                const btns = Array.from(document.querySelectorAll('button'));
                const nextBtn = btns.find(b => {
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    return aria.includes('next') || title.includes('next');
                });
                if (nextBtn) {
                    nextBtn.click();
                    return 'clicked-btn';
                }
                return 'no-btn-found';
            }''')
            print(f"Next click result: {next_clicked}")
            time.sleep(3.0)
            
            step_img = os.path.join(ARTIFACT_DIR, f"live_verification_step{step_idx}.png")
            page.screenshot(path=step_img)
            steps_captured.append(step_img)
            print(f"Captured Step {step_idx} screenshot: {step_img}")
            
            st_info = page.evaluate('''() => {
                const body = document.body.innerText;
                const match = body.match(/Step\\s+(\\d+)\\s*\\/\\s*(\\d+)/i) || body.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
                return match ? match[0] : 'unknown';
            }''')
            print(f"Step {step_idx} counter: {st_info}")
            
        print("Verification complete! Total screenshots captured:", len(steps_captured))
        browser.close()

if __name__ == "__main__":
    run_test()
