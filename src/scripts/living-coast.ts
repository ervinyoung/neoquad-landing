// The dusk photograph as a real place, seen through a camera that never quite holds still.
//
// Nothing in the picture is warped. Three things move, each the way it moves in the world:
//   - The camera: a slow push in and out, drifting a little sideways. Near rock slides past far
//     rock, far rock past the sky (parallax by depth, from the scene's map), so the land moves as
//     solid land. The slivers it uncovers are filled from a plate of the sky and sea alone.
//   - The clouds: carried on one wind, the high ones faster than the low ones over the horizon, over a
//     sky that reaches past the picture's sides and on behind the land (from the scene's sky texture).
//   - The sea: swell trains rolling in toward the shore, drawn as light (crests turned away from you
//     catch the bright horizon; faces turned toward you take the darker sky above). They are laid
//     out on the water in perspective, so they crowd and slow toward the horizon and fade before
//     they would flicker. Only the sea carries them.
//
// Drawn in WebGL over the still picture, progressive blur included, so the softened parts move with
// the rest. start() returns a stop function, or null when WebGL is unavailable; the still picture is
// then the whole picture. With Reduce Motion only the camera's push and the clouds remain, slower.

const VERT = `
  attribute vec2 p;
  varying vec2 v;
  void main() {
    v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

// uPhoto: the photograph. uSoft, uSofter: its two blurred copies. uMap: red = sea, green = sky,
// blue = how near the land is. uPlate: the sky and sea with the land taken out. uSky: the whole sky
// down to the horizon, reaching past each side of the picture (uSkyReach.x, in picture widths) and on
// behind the land; uSkyReach.y is how much of the picture's height it covers.
// uSoftStops, uSofterStops: where each blur is whole and where it ends (bottom full, bottom end,
// top full, top end), as fractions of the window's height. uSoftTop: 1 when the top is softened too.
// uCenter: where the camera points (fractions of the window). uZoom: its push, for the far sky (x)
// and added for the nearest rock (y). uWind: how far the high clouds have travelled (picture widths).
// uSea: how much swell (0 with Reduce Motion). uTexel: the picture's height covered by one CSS pixel.
const FRAG = `
  precision highp float;
  varying vec2 v;
  uniform sampler2D uPhoto;
  uniform sampler2D uSoft;
  uniform sampler2D uSofter;
  uniform sampler2D uMap;
  uniform sampler2D uPlate;
  uniform sampler2D uSky;
  uniform vec2 uSkyReach;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform vec4 uSoftStops;
  uniform vec4 uSofterStops;
  uniform float uSoftTop;
  uniform float uHorizon;
  uniform float uAspect;
  uniform float uTexel;
  uniform vec2 uCenter;
  uniform vec2 uZoom;
  uniform float uWind;
  uniform float uSea;
  uniform float uT;

  // The camera stands this many metres above the water and sees this much of it top to bottom (radians).
  const float HEIGHT = 60.0;
  const float FOV = 0.7;

  // 1 from an edge up to stops.x, falling to 0 at stops.y.
  float ramp(float fromEdge, vec2 stops) {
    return clamp((stops.y - fromEdge) / (stops.y - stops.x), 0.0, 1.0);
  }

  // The picture at a point: the photograph, under as much of each blur as this row of the window asks for.
  vec3 picture(vec2 p, float soft, float softer) {
    vec3 c = texture2D(uPhoto, p).rgb;
    if (soft + softer > 0.0) {
      c = mix(c, texture2D(uSoft, p).rgb, soft);
      c = mix(c, texture2D(uSofter, p).rgb, softer);
    }
    return c;
  }

  // Where the camera finds the point of the picture now drawn at u, for something at nearness d
  // (0 the sky, 1 the rock underfoot). A push about a point inside the window never shows past its edges.
  vec2 seen(vec2 u, vec2 c, float d) {
    return c + (u - c) / (1.0 + uZoom.x + uZoom.y * d);
  }

  // One train of deep-water swell, of period t seconds and height a metres, heading toward the viewer
  // along dir. Returns its slope toward the viewer. Deep water decides the rest: the wavelength is
  // g t^2 / 2pi, so long swell travels fast and short chop slow. Trains finer than a dozen pixels or so fade
  // out, as they do to the eye, so the far sea lies still and nothing flickers.
  float swell(vec2 sea, float metresPerPixel, vec2 dir, float t, float a) {
    float w = 6.2832 / t;
    float k = w * w / 9.81;
    float pixels = 6.2832 / k / abs(dir.y) / metresPerPixel;
    return a * k * dir.y * cos(dot(sea, dir) * k - w * uT) * smoothstep(4.0, 16.0, pixels);
  }

  // The swell's light at picture point q: below 1 where a face turns toward you, above where it turns away.
  float swellLight(vec2 q, float px) {
    float below = (q.y - uHorizon) * FOV;
    if (below <= 0.0) return 1.0;
    float far = HEIGHT / below;
    // The point on the water, in metres: across, and away from the camera.
    vec2 sea = vec2((q.x - 0.5) * uAspect * FOV * far, far);
    float metresPerPixel = px * FOV * far * far / HEIGHT;
    // Two long swells a little apart in period run in and out of step, so the sets arrive in groups.
    float slope = swell(sea, metresPerPixel, vec2(-0.26, -0.97), 11.0, 0.45)
                + swell(sea, metresPerPixel, vec2(-0.09, -1.0), 9.7, 0.35)
                + swell(sea, metresPerPixel, vec2(0.42, -0.91), 7.5, 0.18)
                + swell(sea, metresPerPixel, vec2(-0.64, -0.77), 5.2, 0.07)
                + swell(sea, metresPerPixel, vec2(0.26, -0.97), 3.4, 0.025)
                + swell(sea, metresPerPixel, vec2(-0.82, -0.57), 2.3, 0.008);
    return 1.0 - 3.0 * slope;
  }

  void main() {
    vec2 u = uOffset + v * uScale;
    vec2 c = uOffset + uCenter * uScale;

    float soft = max(ramp(1.0 - v.y, uSoftStops.xy), uSoftTop * ramp(v.y, uSoftStops.zw));
    float softer = max(ramp(1.0 - v.y, uSofterStops.xy), uSoftTop * ramp(v.y, uSofterStops.zw));

    // The land, moved as one body by its nearness.
    float near = texture2D(uMap, u).b;
    vec2 ql = seen(u, c, near);
    vec3 ml = texture2D(uMap, ql).rgb;
    float land = clamp(1.0 - ml.r - ml.g, 0.0, 1.0);

    vec3 color = vec3(0.0);
    if (land < 1.0) {
      // Behind it, the sky and the sea. The sea nears with the angle below the horizon; the sky is far.
      float below = u.y - uHorizon;
      // Under the blur, edges are smeared across both layers, so there the two move as one.
      float smeared = clamp(2.0 * soft + softer, 0.0, 1.0);
      vec2 qb = seen(u, c, mix(clamp(below * 1.9, 0.0, 1.0), near, smeared));
      // Off the picture's sides, or behind its land, the sky texture knows the sky the photograph cannot.
      float unknown = 0.0;
      if (below < 0.0) {
        // The wind: one direction for the whole sky, the high clouds fastest, slower toward the
        // horizon where they are far off, and still in the haze just above it.
        float high = clamp(-below / uHorizon, 0.0, 1.0);
        qb.x -= uWind * mix(0.3, 1.0, smoothstep(0.0, 0.8, high)) * smoothstep(0.012, 0.04, -below);
        // (The photograph's outermost few columns of pixels are dark or haloed: they count as off it.)
        unknown = 1.0 - step(0.002, qb.x) * step(qb.x, 0.998);
      }
      vec3 mb = texture2D(uMap, qb).rgb;
      vec3 behind = picture(qb, soft, softer);
      // Where the land has moved off something it was hiding, the plate (or the sky) shows what was
      // there. Only what was hidden in the still picture counts, so at rest this is the photograph.
      float uncovered = max(unknown, clamp(1.0 - mb.r - mb.g - land, 0.0, 1.0) / max(1.0 - land, 0.001));
      if (uncovered > 0.0) {
        vec3 hidden = below < 0.0
          ? texture2D(uSky, vec2((qb.x + uSkyReach.x) / (1.0 + 2.0 * uSkyReach.x), qb.y / uSkyReach.y)).rgb
          : texture2D(uPlate, qb).rgb;
        behind = mix(behind, hidden, uncovered);
      }
      if (mb.r > 0.0) {
        // Under the blur the swell is finer than the picture, so it fades sooner.
        float px = uTexel * (1.0 + 2.0 * soft + 6.0 * softer);
        behind *= mix(1.0, swellLight(qb, px), mb.r * uSea);
      }
      color = behind;
    }
    if (land > 0.0) color = mix(color, picture(ql, soft, softer), land);

    gl_FragColor = vec4(color, 1.0);
  }`;

export type Stop = () => void;

const TAU = Math.PI * 2;

/** Where the camera is at t seconds, given where the pointer has drawn it (-0.5 to 0.5 each way).
 *  Every period is its own, so the movements never fall back into step within many minutes. */
function camera(t: number, pointer: { x: number; y: number }, calm: boolean) {
  // The camera sets off from exactly the still picture, already moving, and settles into its stride.
  const settle = 1 - Math.exp(-t / 3);
  // The push breathes in and out over 97 seconds, never back to nothing.
  const push = settle * (0.6 + 0.4 * Math.sin((TAU * t) / 97)) * (calm ? 0.5 : 1);
  // The drift: a slow figure, wider than tall. Reduce Motion holds the camera on the middle.
  const sway = calm ? 0 : 1;
  return {
    zoom: [push * 0.02, push * 0.035] as const,
    center: [
      0.5 + sway * (0.3 * Math.sin((TAU * t) / 71) + 0.1 * pointer.x),
      0.5 + sway * (0.14 * Math.sin((TAU * t) / 53 + 1.3) + 0.06 * pointer.y),
    ] as const,
    // The wind carries the high clouds 9% of the picture's width either side over 195 seconds: from
    // the first frame at its fastest, about 4 px a second on a laptop, one way for over a minute and a
    // half before it slowly turns. The sky texture reaches past the picture far enough for all of it.
    wind: (calm ? 0.5 : 1) * 0.09 * Math.sin((TAU * t) / 195),
  };
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** root: an element holding `img.coast-photo`, `img.coast-blur--soft`, `img.coast-blur--softer` and
 *  `canvas.coast-live`, with data-map, data-plate, data-sky, data-sky-reach, data-horizon, data-blur (the blur stops) and
 *  data-focus-x/y. */
export async function start(root: HTMLElement): Promise<Stop | null> {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const photoEl = root.querySelector<HTMLImageElement>('.coast-photo')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.coast-live')!;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const softEl = root.querySelector<HTMLImageElement>('.coast-blur--soft')!;
  const softerEl = root.querySelector<HTMLImageElement>('.coast-blur--softer')!;
  const loaded = (img: HTMLImageElement) =>
    img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }));
  await Promise.all([photoEl, softEl, softerEl].map(loaded));
  const [photo, soft, softer, map, plate, sky] = await Promise.all(
    [photoEl, softEl, softerEl]
      .map((img) => load(img.currentSrc || img.src))
      .concat([root.dataset.map!, root.dataset.plate!, root.dataset.sky!].map(load)),
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
  texture(3, map, 'uMap');
  texture(4, plate, 'uPlate');
  texture(5, sky, 'uSky');

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  type Stops = Record<'bottom' | 'top', { full: number; end: number }>;
  const blur: Record<'soft' | 'softer', Stops> = JSON.parse(root.dataset.blur!);
  const stops = (name: string, s: Stops) => gl.uniform4f(uniform(name), s.bottom.full, s.bottom.end, s.top.full, s.top.end);
  stops('uSoftStops', blur.soft);
  stops('uSofterStops', blur.softer);
  const imageRatio = photo.naturalWidth / photo.naturalHeight;
  gl.uniform1f(uniform('uHorizon'), Number(root.dataset.horizon));
  gl.uniform1f(uniform('uAspect'), imageRatio);
  gl.uniform1f(uniform('uSea'), calm ? 0 : 1);
  const reach = Number(root.dataset.skyReach);
  gl.uniform2f(uniform('uSkyReach'), reach, (sky.naturalHeight / sky.naturalWidth) * (1 + 2 * reach) * imageRatio);

  const uScale = uniform('uScale');
  const uOffset = uniform('uOffset');
  const uTexel = uniform('uTexel');
  const uSoftTop = uniform('uSoftTop');
  const uCenter = uniform('uCenter');
  const uZoom = uniform('uZoom');
  const uWind = uniform('uWind');
  const uT = uniform('uT');
  const focusX = Number(root.dataset.focusX);
  const focusY = Number(root.dataset.focusY);

  // Match `object-fit: cover` exactly, so the canvas sits pixel for pixel on the photograph.
  const fit = () => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    const ratio = width / height;
    const sx = Math.min(1, ratio / imageRatio);
    const sy = Math.min(1, imageRatio / ratio);
    // As sharp as the photograph itself: one canvas pixel per photograph pixel at most, never past
    // the screen's own density (capped at 2), and never more than three million pixels.
    const source = Math.max(1, (photo.naturalWidth * sx) / width);
    const density = Math.min(devicePixelRatio || 1, 2, source, Math.sqrt(3_000_000 / (width * height)));
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uScale, sx, sy);
    gl.uniform2f(uOffset, (1 - sx) * focusX, (1 - sy) * focusY);
    gl.uniform1f(uTexel, sy / height);
    // Whether the top is softened is the layout's call (see Coast.astro), and can change with the width.
    gl.uniform1f(uSoftTop, Number(getComputedStyle(root).getPropertyValue('--coast-soft-top')) || 0);
    if (clock) render(clock);
  };

  // A fine pointer leans the camera a little, the way a head moves at a window. It follows softly.
  const pointer = { x: 0, y: 0 };
  const aim = { x: 0, y: 0 };
  const lean = (e: PointerEvent) => {
    aim.x = e.clientX / innerWidth - 0.5;
    aim.y = e.clientY / innerHeight - 0.5;
  };
  if (!calm && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', lean, { passive: true });

  // One frame, at t seconds into the scene.
  const render = (t: number) => {
    const view = camera(t, pointer, calm);
    gl.uniform2f(uCenter, view.center[0], view.center[1]);
    gl.uniform2f(uZoom, view.zoom[0], view.zoom[1]);
    gl.uniform1f(uWind, view.wind);
    gl.uniform1f(uT, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  let frame = 0;
  let visible = true;
  let clock = 0;
  let last = performance.now();
  fit();
  const resize = new ResizeObserver(fit);
  resize.observe(root);

  const draw = (now: number) => {
    // Time only advances while the scene is being watched, so it never jumps.
    const dt = Math.min(now - last, 64) / 1000;
    last = now;
    clock += dt;
    const follow = 1 - Math.exp(-dt / 0.9);
    pointer.x += (aim.x - pointer.x) * follow;
    pointer.y += (aim.y - pointer.y) * follow;
    render(clock);
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
    removeEventListener('pointermove', lean);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
