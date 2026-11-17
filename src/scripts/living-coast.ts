// The dusk photograph, alive: swell rolls in across the sea, the clouds drift on the wind, the light
// settles and lifts. Drawn in WebGL over the still picture, progressive blur included, so the
// softened parts of the picture move too. start() returns a stop function, or null when the visitor
// prefers reduced motion or WebGL is unavailable; the still picture is then the whole picture.

const VERT = `
  attribute vec2 p;
  varying vec2 v;
  void main() {
    v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

// uPhoto: the photograph. uSoft, uSofter: its two blurred copies. uMask: red = sea, green = sky.
// uSoftStops, uSofterStops: where each blur is whole and where it ends (bottom full, bottom end,
// top full, top end), as fractions of the window's height. uSoftTop: 1 when the top is softened too.
//
// The sea in this photograph is a long exposure: silk, with nothing in it to move. So the swell
// is drawn, not warped: bands of light and shade roll in from the horizon, crowding together far
// away and opening out near the shore, with small glints riding on them.
//
// The clouds are the photograph's own, carried on a wind. A still picture cannot be slid sideways
// for ever, so the sky is drawn twice: each copy travels with the wind for one cycle and fades out
// as the other, half a cycle behind, fades in. The eye sees one sky, always moving the same way.
const FRAG = `
  precision highp float;
  varying vec2 v;
  uniform sampler2D uPhoto;
  uniform sampler2D uSoft;
  uniform sampler2D uSofter;
  uniform sampler2D uMask;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform vec4 uSoftStops;
  uniform vec4 uSofterStops;
  uniform float uSoftTop;
  uniform float uT;

  const float HORIZON = 0.548;
  // One cycle of the wind, in seconds, and how far a cloud travels in it (in picture widths).
  const float GUST = 15.0;
  const float REACH = 0.03;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      sum += amp * noise(p);
      p = p * 2.03 + 17.0;
      amp *= 0.5;
    }
    return sum;
  }

  // 1 from an edge up to stops.x, falling to 0 at stops.y.
  float ramp(float fromEdge, vec2 stops) {
    return clamp((stops.y - fromEdge) / (stops.y - stops.x), 0.0, 1.0);
  }

  // The picture at a point: the photograph, under as much of each blur as this row of the window asks for.
  vec3 picture(vec2 p, float soft, float softer) {
    vec3 c = texture2D(uPhoto, p).rgb;
    c = mix(c, texture2D(uSoft, p).rgb, soft);
    return mix(c, texture2D(uSofter, p).rgb, softer);
  }

  void main() {
    vec2 uv = uOffset + v * uScale;
    vec3 m = texture2D(uMask, uv).rgb;
    float sea = m.r;
    float sky = m.g;

    float soft = max(ramp(1.0 - v.y, uSoftStops.xy), uSoftTop * ramp(v.y, uSoftStops.zw));
    float softer = max(ramp(1.0 - v.y, uSofterStops.xy), uSoftTop * ramp(v.y, uSofterStops.zw));

    // 0 at the horizon, 1 at the nearest water. depth runs the other way, and far.
    float near = clamp((uv.y - HORIZON) / 0.26, 0.0, 1.0);
    float depth = 1.0 / (near * 0.9 + 0.1);

    // The water's own coordinates: wide across, and rolling toward the viewer with time.
    vec2 water = vec2((uv.x - 0.5) * depth * 2.6, depth * 2.3 + uT * 0.38);
    float swell = fbm(water + vec2(uT * 0.04, 0.0));
    float crest = smoothstep(0.36, 0.72, swell);
    float glint = pow(noise(water * vec2(2.4, 5.0) + vec2(uT * 0.18, uT * 0.62)), 4.0);

    // The photograph is carried a little by the swell, so its own foam rides the waves.
    vec2 d = vec2(0.0, (swell - 0.5) * 0.011 * mix(0.3, 1.0, near)) * sea;

    // Clouds billow a little where they stand...
    vec2 billow = vec2(fbm(uv * 3.0 + uT * 0.022), fbm(uv * 3.0 + 7.3 - uT * 0.018)) - 0.5;
    d += billow * 0.007 * sky;

    // ...and drift on the wind: faster high up, slower toward the horizon, where they are far away.
    float height = clamp((HORIZON - uv.y) / HORIZON, 0.0, 1.0);
    vec2 wind = vec2(REACH * mix(0.4, 1.0, height), -0.003) * sky;
    // Each part of the sky keeps its own time, so the two copies never trade places everywhere at once.
    float gust = uT / GUST + noise(uv * 3.5) * 0.7;
    float a = fract(gust);
    float b = fract(gust + 0.5);
    vec3 c = mix(
      picture(uv + d - wind * (b - 0.5), soft, softer),
      picture(uv + d - wind * (a - 0.5), soft, softer),
      1.0 - abs(2.0 * a - 1.0)
    );

    // Crests catch the sky; troughs fall into shade. Strongest near the shore, gone at the horizon,
    // and quieter where the picture is blurred.
    float strength = sea * smoothstep(0.02, 0.5, near) * (1.0 - 0.5 * softer);
    vec3 sky_light = vec3(1.0, 0.93, 0.9);
    c += sky_light * strength * (crest * 0.15 + glint * 0.1 * (1.0 - softer) - 0.07);

    // The whole dusk settles and lifts.
    c *= 1.0 + 0.02 * sin(uT * 0.21);

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

/** root: an element holding `img.coast-photo`, `img.coast-blur--soft`, `img.coast-blur--softer` and
 *  `canvas.coast-live`, with data-mask, data-blur (the blur stops) and data-focus-x/y. */
export async function start(root: HTMLElement): Promise<Stop | null> {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const photoEl = root.querySelector<HTMLImageElement>('.coast-photo')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.coast-live')!;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const softEl = root.querySelector<HTMLImageElement>('.coast-blur--soft')!;
  const softerEl = root.querySelector<HTMLImageElement>('.coast-blur--softer')!;
  const loaded = (img: HTMLImageElement) =>
    img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }));
  await Promise.all([photoEl, softEl, softerEl].map(loaded));
  const [photo, soft, softer, mask] = await Promise.all(
    [photoEl, softEl, softerEl].map((img) => load(img.currentSrc || img.src)).concat(load(root.dataset.mask!)),
  );

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
  texture(1, soft, 'uSoft');
  texture(2, softer, 'uSofter');
  texture(3, mask, 'uMask');

  type Stops = Record<'bottom' | 'top', { full: number; end: number }>;
  const blur: Record<'soft' | 'softer', Stops> = JSON.parse(root.dataset.blur!);
  const stops = (name: string, s: Stops) =>
    gl.uniform4f(gl.getUniformLocation(program, name), s.bottom.full, s.bottom.end, s.top.full, s.top.end);
  stops('uSoftStops', blur.soft);
  stops('uSofterStops', blur.softer);

  const uScale = gl.getUniformLocation(program, 'uScale');
  const uOffset = gl.getUniformLocation(program, 'uOffset');
  const uT = gl.getUniformLocation(program, 'uT');
  const uSoftTop = gl.getUniformLocation(program, 'uSoftTop');
  const focusX = Number(root.dataset.focusX);
  const focusY = Number(root.dataset.focusY);
  const imageRatio = photo.naturalWidth / photo.naturalHeight;

  // Match `object-fit: cover` exactly, so the canvas sits pixel for pixel on the photograph.
  const fit = () => {
    // Layout size, not the on-screen box: the scene drifts with a transform and must not resize.
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    // The swell is soft, so the canvas can be modest: at most 1.5x, and never more than 1.6M pixels.
    const density = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1_600_000 / (width * height)));
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const ratio = width / height;
    const sx = Math.min(1, ratio / imageRatio);
    const sy = Math.min(1, imageRatio / ratio);
    gl.uniform2f(uScale, sx, sy);
    gl.uniform2f(uOffset, (1 - sx) * focusX, (1 - sy) * focusY);
    // Whether the top is softened is the layout's call (see Coast.astro), and can change with the width.
    gl.uniform1f(uSoftTop, Number(getComputedStyle(root).getPropertyValue('--coast-soft-top')) || 0);
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
