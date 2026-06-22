// User-added parametric surfaces. Stored per-browser in localStorage so each
// admin / visitor builds their own private little collection without us
// needing a backing table.
//
// Format on disk:
//   { id, name, xExpr, yExpr, zExpr, equation, createdAt }
//
// `xExpr` / `yExpr` / `zExpr` are JavaScript expressions in `u` and `v`
// where u, v ∈ [0, 2π]. They are compiled with `new Function()` inside a
// whitelisted Math scope — safer than `eval()` (no closure access) but
// still untrusted code, so we only do this client-side for the user's own
// inputs. Never store user surfaces from one user and run them in another.

const KEY = 'stp-gallery-custom-surfaces'

const MATH_SCOPE = `
  const sin=Math.sin, cos=Math.cos, tan=Math.tan;
  const asin=Math.asin, acos=Math.acos, atan=Math.atan, atan2=Math.atan2;
  const sinh=Math.sinh, cosh=Math.cosh, tanh=Math.tanh;
  const sqrt=Math.sqrt, cbrt=Math.cbrt, abs=Math.abs, sign=Math.sign;
  const exp=Math.exp, log=Math.log, log2=Math.log2, log10=Math.log10;
  const pow=Math.pow, min=Math.min, max=Math.max;
  const floor=Math.floor, ceil=Math.ceil, round=Math.round;
  const PI=Math.PI, E=Math.E, TAU=Math.PI*2;
`

export function compileExpr(expr) {
  if (typeof expr !== 'string' || !expr.trim()) {
    throw new Error('Empty expression')
  }
  // Reject anything that looks like it's trying to escape the scope. This is
  // belt-and-suspenders: the Math scope doesn't expose window/document/etc.,
  // but blocking the obvious tokens early gives a friendlier error.
  if (/(\bwindow\b|\bdocument\b|\bfetch\b|\bimport\b|\brequire\b|=>)/.test(expr)) {
    throw new Error('Expression contains a disallowed token')
  }
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('u', 'v', `${MATH_SCOPE}\nreturn (${expr});`)
    // Smoke-test it so a syntax error surfaces here, not on first render.
    const r = fn(0.5, 0.5)
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new Error('Expression must return a finite number')
    }
    return fn
  } catch (e) {
    throw new Error(`Compile error: ${e.message}`)
  }
}

/**
 * "Code mode": compile a multi-line JS body that assigns x, y, z (in any
 * order, with intermediate locals, comments, conditionals, etc.). Returns
 * a function (u, v) -> [x, y, z] in [number, number, number].
 *
 * Example body:
 *     // u, v ∈ [0, 2π]
 *     const R = 1.5, r = 0.4
 *     const tw = sin(3 * u)
 *     x = (R + r * cos(v) + 0.2 * tw) * cos(u)
 *     y = (R + r * cos(v) + 0.2 * tw) * sin(u)
 *     z = r * sin(v) + 0.2 * tw
 */
function guardSource(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('Empty source')
  }
  if (/(\bwindow\b|\bdocument\b|\bfetch\b|\bimport\b|\brequire\b|\bglobalThis\b|\bself\b|\beval\b)/.test(source)) {
    throw new Error('Source contains a disallowed token')
  }
}

export function compileSource(source) {
  guardSource(source)
  try {
    // (u, v, p) -> [x, y, z]. `p` is the visitor's current params (may be {}),
    // so bodies can read `p.R`, `p.twists`, etc. Older bodies that ignore the
    // third arg keep working unchanged.
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'u', 'v', 'p',
      `${MATH_SCOPE}\nlet x = 0, y = 0, z = 0;\n${source};\nreturn [x, y, z];`
    )
    const r = fn(0.5, 0.5, {})
    if (!Array.isArray(r) || r.length !== 3 || !r.every((n) => typeof n === 'number')) {
      throw new Error('Source must assign x, y, z as finite numbers')
    }
    return fn
  } catch (e) {
    throw new Error(`Compile error: ${e.message}`)
  }
}

// (u, v, time, p) -> [x, y, z]. Bodies can use `time` to drive their own
// animation — that's how the catenoid↔helicoid morph and modal-sphere mode
// cycles work.
export function compileMorphSource(source) {
  guardSource(source)
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'u', 'v', 'time', 'p',
      `${MATH_SCOPE}\nlet x = 0, y = 0, z = 0;\n${source};\nreturn [x, y, z];`
    )
    const r = fn(0.5, 0.5, 0, {})
    if (!Array.isArray(r) || r.length !== 3 || !r.every((n) => typeof n === 'number')) {
      throw new Error('Morph source must assign x, y, z as finite numbers')
    }
    return fn
  } catch (e) {
    throw new Error(`Compile error: ${e.message}`)
  }
}

// ODE step: given current state (x, y, z) and params, return (dx, dy, dz).
// The wrapper integrates with a fixed-step Euler — bodies just describe the
// derivative, never the loop.
export function compileAttractorSource(source) {
  guardSource(source)
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'x', 'y', 'z', 'p',
      `${MATH_SCOPE}\nlet dx = 0, dy = 0, dz = 0;\n${source};\nreturn [dx, dy, dz];`
    )
    const r = fn(0.1, 0, 0, {})
    if (!Array.isArray(r) || r.length !== 3 || !r.every((n) => typeof n === 'number')) {
      throw new Error('Attractor source must assign dx, dy, dz as finite numbers')
    }
    return fn
  } catch (e) {
    throw new Error(`Compile error: ${e.message}`)
  }
}

// Placement function for a point cloud: index i ∈ [0, n) -> [x, y, z].
// The wrapper iterates and packs into a Float32Array — bodies describe one
// point at a time.
export function compilePointsSource(source) {
  guardSource(source)
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'i', 'n', 'p',
      `${MATH_SCOPE}\nlet x = 0, y = 0, z = 0;\n${source};\nreturn [x, y, z];`
    )
    const r = fn(0, 100, {})
    if (!Array.isArray(r) || r.length !== 3 || !r.every((n) => typeof n === 'number')) {
      throw new Error('Points source must assign x, y, z as finite numbers')
    }
    return fn
  } catch (e) {
    throw new Error(`Compile error: ${e.message}`)
  }
}

export function loadCustomSurfaces() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveCustomSurfaces(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function addCustomSurface(entry) {
  const list = loadCustomSurfaces()
  list.push(entry)
  saveCustomSurfaces(list)
  return list
}

export function removeCustomSurface(id) {
  const list = loadCustomSurfaces().filter((e) => e.id !== id)
  saveCustomSurfaces(list)
  return list
}

/**
 * Turn a stored custom record into a surface object that SurfaceViewer can
 * render — same shape as the built-in entries in src/lib/surfaces.js, with
 * kind: 'parametric' and a sampler synthesized from the user's expressions.
 * Throws if any expression fails to compile.
 */
export function customToSurface(custom) {
  const xFn = compileExpr(custom.xExpr)
  const yFn = compileExpr(custom.yExpr)
  const zFn = compileExpr(custom.zExpr)
  return {
    id: `custom-${custom.id}`,
    name_en: custom.name,
    name_it: custom.name,
    name_zh: custom.name,
    equation: custom.equation || '',
    kind: 'parametric',
    uvSegments: 80,
    isCustom: true,
    customId: custom.id,
    // u, v come in [0,1]; map to [0, 2π] for friendlier formulas.
    sampler: (u, v, target) => {
      const U = u * Math.PI * 2
      const V = v * Math.PI * 2
      const x = xFn(U, V)
      const y = yFn(U, V)
      const z = zFn(U, V)
      // Three.js Y-up convention; user expressions are written z-up so we
      // swap to keep "up" intuitive for the input math.
      target.set(
        Number.isFinite(x) ? x : 0,
        Number.isFinite(z) ? z : 0,
        Number.isFinite(y) ? y : 0
      )
    }
  }
}
