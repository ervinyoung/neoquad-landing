// The dusk photograph, alive: the sea rolls in, the clouds breathe, the light settles and lifts.
// Drawn in WebGL over the still photograph. start() returns a stop function, or null when the
// visitor prefers reduced motion or WebGL is unavailable; the still photograph is then the whole picture.

const VERT = `
  attribute vec2 p;
  varying vec2 v;
  void main() {
    v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

// uPhoto: the photograph. uMask: red = sea, green = sky (drawn once from the photograph).
const FRAG = `
  precision highp float;
  varying vec2 v;
  uniform sampler2D uPhoto;
  uniform sampler2D uMask;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform float uT;

  const float HORIZON = 0.548;

  void main() {
    vec2 uv = uOffset + v * uScale;
    vec3 m = texture2D(uMask, uv).rgb;
    float sea = m.r;
    float sky = m.g;

    // 0 at the horizon, 1 at the nearest water. Rows of swell crowd together far away.
    float near = clamp((uv.y - HORIZON) / 0.26, 0.0, 1.0);
    float row = 1.0 / (near * 0.9 + 0.12);
    float reach = mix(0.0005, 0.0026, near);

    float swell = row * 5.0 + uT * 0.55 + sin(uv.x * 7.0 + uT * 0.13) * 1.4;
    float chop = row * 9.0 + uT * 0.83 + uv.x * 23.0;

    vec2 d = vec2(sin(chop) * 0.6, sin(swell) + 0.5 * sin(chop * 1.7)) * reach * sea;

    // Clouds: one slow, wide breath.
    d.x += sin(uT * 0.045 + uv.y * 5.0) * 0.0016 * sky;
    d.y += sin(uT * 0.037 + uv.x * 4.0) * 0.0006 * sky;

    vec3 c = texture2D(uPhoto, uv + d).rgb;

    // Light travelling on the swell, then the whole dusk settling and lifting.
    c += sea * ((sin(swell + 1.2) * 0.5 + 0.5) * 0.028 * mix(0.4, 1.0, near) - 0.014);
    c *= 1.0 + 0.012 * sin(uT * 0.21);

    gl_FragColor = vec4(c, 1.0);
  }`;

export type Stop = () => void;

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** root: an element holding `img.coast-photo` and `canvas.coast-live`, with data-mask and data-focus-x/y. */
export async function start(root: HTMLElement): Promise<Stop | null> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const photoEl = root.querySelector<HTMLImageElement>('.coast-photo')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.coast-live')!;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;

  if (!photoEl.complete) await new Promise((r) => photoEl.addEventListener('load', r, { once: true }));
  const [photo, mask] = await Promise.all([load(photoEl.currentSrc || photoEl.src), load(root.dataset.mask!)]);

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const texture = (unit: number, image: HTMLImageElement, name: string) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, name), unit);
  };
  texture(0, photo, 'uPhoto');
  texture(1, mask, 'uMask');

  const uScale = gl.getUniformLocation(program, 'uScale');
  const uOffset = gl.getUniformLocation(program, 'uOffset');
  const uT = gl.getUniformLocation(program, 'uT');
  const focusX = Number(root.dataset.focusX);
  const focusY = Number(root.dataset.focusY);
  const imageRatio = photo.naturalWidth / photo.naturalHeight;

  // Match `object-fit: cover` exactly, so the canvas sits pixel for pixel on the photograph.
  const fit = () => {
    const { width, height } = root.getBoundingClientRect();
    if (!width || !height) return;
    const density = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2_600_000 / (width * height)));
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const ratio = width / height;
    const sx = Math.min(1, ratio / imageRatio);
    const sy = Math.min(1, imageRatio / ratio);
    gl.uniform2f(uScale, sx, sy);
    gl.uniform2f(uOffset, (1 - sx) * focusX, (1 - sy) * focusY);
  };
  fit();
  const resize = new ResizeObserver(fit);
  resize.observe(root);

  let frame = 0;
  let visible = true;
  let clock = 0;
  let last = performance.now();
  const draw = (now: number) => {
    // Time only advances while the sea is being watched, so it never jumps.
    clock += Math.min(now - last, 64) / 1000;
    last = now;
    gl.uniform1f(uT, clock);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.dataset.on = '';
    frame = requestAnimationFrame(draw);
  };
  const run = () => {
    cancelAnimationFrame(frame);
    if (visible && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  };
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  });
  seen.observe(root);
  document.addEventListener('visibilitychange', run);
  run();

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    seen.disconnect();
    document.removeEventListener('visibilitychange', run);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
