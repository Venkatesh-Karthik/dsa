import os
from playwright.sync_api import sync_playwright

html = """<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0; padding: 40px; background-color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .canvas-mock {
    position: relative; width: 640px; height: 440px; background: #ffffff;
    border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    border: 1px solid #e2e8f0; padding: 30px; box-sizing: border-box;
  }
  .diagram-box {
    display: inline-block; padding: 14px 24px; background: #eff6ff;
    border: 2px solid #3b82f6; border-radius: 8px; color: #1d4ed8;
    font-weight: 600; margin-right: 20px;
  }
  .diagram-line {
    width: 140px; height: 3px; background: #94a3b8; display: inline-block; vertical-align: middle;
  }
  #orb-canvas {
    position: absolute; top: 70px; left: 140px; width: 140px; height: 140px; pointer-events: none;
    background: transparent !important;
  }
</style>
</head>
<body>
  <div class="canvas-mock">
    <h2>Binary Search Tree Visualization</h2>
    <p style="color: #64748b;">Cognora Visual Lesson &bull; Step 3 of 8</p>
    <div style="margin-top: 30px;">
      <div class="diagram-box">Node 50 (Root)</div>
      <div class="diagram-line"></div>
      <div class="diagram-box">Node 25 (Left)</div>
    </div>
    <div style="margin-top: 40px; color: #334155; line-height: 1.6; font-size: 15px;">
      Notice how the binary search property ensures all nodes in the left subtree remain strictly smaller than the root value.
    </div>
    <canvas id="orb-canvas" width="280" height="280"></canvas>
  </div>
</body>
</html>"""

os.makedirs("test-artifacts", exist_ok=True)
with open("test-artifacts/test_page.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Created test-artifacts/test_page.html")
