import os
from playwright.sync_api import sync_playwright

def run_render():
    abs_path = os.path.abspath("test-artifacts/test_page.html")
    file_url = f"file:///{abs_path.replace(os.sep, '/')}"

    with open("test-artifacts/shader_code.glsl", "r", encoding="utf-8") as f:
        fs_code = f.read()

    vs_code = """
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
    """

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
        page = browser.new_page(viewport={"width": 1050, "height": 550})
        page.goto(file_url)

        page.evaluate("""(args) => {
            function renderCanvas(canvasId, uniforms) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;
                const gl = canvas.getContext('webgl', {
                    alpha: true,
                    antialias: true,
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: true,
                });

                function createShader(type, src) {
                    const s = gl.createShader(type);
                    gl.shaderSource(s, src);
                    gl.compileShader(s);
                    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                        console.error(gl.getShaderInfoLog(s));
                    }
                    return s;
                }

                const vs = createShader(gl.VERTEX_SHADER, args.vs);
                const fs = createShader(gl.FRAGMENT_SHADER, args.fs);
                const prog = gl.createProgram();
                gl.attachShader(prog, vs);
                gl.attachShader(prog, fs);
                gl.linkProgram(prog);
                gl.useProgram(prog);

                const posBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
                const posAttrib = gl.getAttribLocation(prog, 'a_position');
                gl.enableVertexAttribArray(posAttrib);
                gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

                const u = (name) => gl.getUniformLocation(prog, name);
                gl.uniform1f(u('u_time'), uniforms.time || 2.4);
                gl.uniform2f(u('u_resolution'), 280, 280);
                gl.uniform2f(u('u_pointer'), uniforms.pointer[0], uniforms.pointer[1]);
                gl.uniform1f(u('u_state'), uniforms.state);
                gl.uniform1f(u('u_audio_energy'), uniforms.energy || 0.0);
                gl.uniform1f(u('u_audio_low'), uniforms.low || 0.0);
                gl.uniform1f(u('u_audio_mid'), uniforms.mid || 0.0);
                gl.uniform1f(u('u_audio_high'), uniforms.high || 0.0);
                gl.uniform1f(u('u_teaching_intensity'), uniforms.teaching || 0.0);
                gl.uniform2f(u('u_squish'), 1.0, 1.0);
                gl.uniform2f(u('u_drag_velocity'), 0, 0);
                gl.uniform1f(u('u_reduced_motion'), 0);

                gl.viewport(0, 0, 280, 280);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            renderCanvas('orb-canvas', {
                state: 2.0, time: 2.4, pointer: [0.15, -0.15],
                energy: 0.65, low: 0.5, mid: 0.7, high: 0.4, teaching: 0.7
            });

            renderCanvas('orb-canvas-bg', {
                state: 0.0, time: 1.8, pointer: [-0.1, 0.1],
                energy: 0.0, low: 0.0, mid: 0.0, high: 0.0, teaching: 0.0
            });
        }""", {"vs": vs_code, "fs": fs_code})

        page.screenshot(path="test-artifacts/composited_page.png")
        print("Saved test-artifacts/composited_page.png")
        browser.close()

if __name__ == "__main__":
    run_render()
