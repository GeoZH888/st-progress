-- ============================================================
-- Unify built-in gallery surfaces into stp_surfaces
-- Run AFTER db/surfaces_source.sql. Idempotent.
-- ============================================================
-- The /gallery page used to render 11 surfaces hard-coded in
-- src/lib/surfaces.js plus N rows from this table. After this
-- migration every surface lives here (single source of truth)
-- and /admin/surfaces can manage all of them.
--
-- New columns:
--   kind          — 'parametric' | 'morph' | 'attractor' | 'points' | 'builtin'
--   slug          — stable string id (matches old built-in ids); null for
--                   user-created rows
--   params_schema — jsonb array of {key, label, min, max, step, default}
--                   describing the visitor slider bar
--   point_count   — default sample count for 'attractor' / 'points'
--   builtin_kind  — when kind='builtin', selects the THREE.* geometry builder
--                   ('torusKnot' is the only one for now)
--   metadata      — kind-specific extras (uvSegments, dt, initial state, …)
--
-- The 11 built-ins below are inserted as DRAFTS (published=false). Phase 3
-- of the unify rollout flips them to published and drops the duplicate
-- copies from src/lib/surfaces.js in the same commit.
-- ============================================================

-- ---------- schema ----------
alter table stp_surfaces alter column x_expr drop not null;
alter table stp_surfaces alter column y_expr drop not null;
alter table stp_surfaces alter column z_expr drop not null;

alter table stp_surfaces
  add column if not exists kind          text not null default 'parametric',
  add column if not exists slug          text,
  add column if not exists params_schema jsonb not null default '[]'::jsonb,
  add column if not exists point_count   int,
  add column if not exists builtin_kind  text,
  add column if not exists metadata      jsonb not null default '{}'::jsonb;

alter table stp_surfaces drop constraint if exists stp_surfaces_kind_check;
alter table stp_surfaces add constraint stp_surfaces_kind_check
  check (kind in ('parametric', 'morph', 'attractor', 'points', 'builtin'));

create unique index if not exists stp_surfaces_slug_uniq
  on stp_surfaces (slug) where slug is not null;
create index if not exists stp_surfaces_kind_idx on stp_surfaces (kind);

-- ---------- seed the 11 built-ins (idempotent: skip rows whose slug exists) ----------

-- 1. torus-knot — kind='builtin', uses THREE.TorusKnotGeometry
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, builtin_kind, sort_order, published)
select 'torus-knot', 'science_tech',
  'Torus knot (3, 2)', 'Nodo toroidale (3, 2)', '环面纽结 (3, 2)',
  E'\\begin{aligned}x &= \\cos(pu)\\,(R + r\\cos(qu))\\\\ y &= \\sin(pu)\\,(R + r\\cos(qu))\\\\ z &= r\\sin(qu)\\end{aligned}',
  'builtin',
  '[{"key":"p","label":"p","min":1,"max":8,"step":1,"default":3},
    {"key":"q","label":"q","min":1,"max":8,"step":1,"default":2},
    {"key":"R","label":"R","min":0.6,"max":2,"step":0.05,"default":1.1,"precision":2},
    {"key":"r","label":"r","min":0.1,"max":0.9,"step":0.02,"default":0.34,"precision":2}]'::jsonb,
  'torusKnot', 10, false
where not exists (select 1 from stp_surfaces where slug = 'torus-knot');

-- 2. klein — parametric, source_code body assigns x, y, z (wrapper swaps y/z for three.js)
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, metadata, sort_order, published)
select 'klein', 'science_tech',
  'Klein bottle', 'Bottiglia di Klein', '克莱因瓶',
  E'\\begin{aligned}x &= (R + \\cos\\tfrac{u}{2}\\sin v - \\sin\\tfrac{u}{2}\\sin 2v)\\cos u\\\\ y &= (R + \\cos\\tfrac{u}{2}\\sin v - \\sin\\tfrac{u}{2}\\sin 2v)\\sin u\\\\ z &= \\sin\\tfrac{u}{2}\\sin v + \\cos\\tfrac{u}{2}\\sin 2v\\end{aligned}',
  'parametric',
  '[{"key":"R","label":"R","min":0.5,"max":3,"step":0.1,"default":1.6,"precision":1}]'::jsonb,
E'// u, v in [0, 2π]; params: { R }\nconst R = (p && p.R != null) ? p.R : 1.6\nconst s = R + cos(u/2)*sin(v) - sin(u/2)*sin(2*v)\nx = s * cos(u)\ny = sin(u/2)*sin(v) + cos(u/2)*sin(2*v)\nz = s * sin(u)',
  '{"uvSegments": 160}'::jsonb,
  20, false
where not exists (select 1 from stp_surfaces where slug = 'klein');

-- 3. mobius — parametric, params R + twists
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, metadata, sort_order, published)
select 'mobius', 'science_tech',
  'Möbius strip', 'Nastro di Möbius', '莫比乌斯带',
  E'\\begin{aligned}x &= \\bigl(1 + \\tfrac{v}{2}\\cos\\tfrac{u}{2}\\bigr)\\cos u\\\\ y &= \\bigl(1 + \\tfrac{v}{2}\\cos\\tfrac{u}{2}\\bigr)\\sin u\\\\ z &= \\tfrac{v}{2}\\sin\\tfrac{u}{2}\\end{aligned}',
  'parametric',
  '[{"key":"R","label":"R","min":0.6,"max":3,"step":0.1,"default":1.6,"precision":1},
    {"key":"twists","label":"twists","min":1,"max":5,"step":1,"default":1}]'::jsonb,
E'// u in [0, 2π], v in [0, 2π]; params: { R, twists }\nconst R = (p && p.R != null) ? p.R : 1.6\nconst tw = (p && p.twists != null) ? p.twists : 1\nconst V = v / PI - 1\nconst r = R + (V/2) * cos((u * tw) / 2)\nx = r * cos(u)\ny = (V/2) * sin((u * tw) / 2)\nz = r * sin(u)',
  '{"uvSegments": 120}'::jsonb,
  30, false
where not exists (select 1 from stp_surfaces where slug = 'mobius');

-- 4. catenoid-helicoid — morph, time-based cycle between the two minimal surfaces
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, source_code, metadata, sort_order, published)
select 'catenoid-helicoid', 'science_tech',
  'Catenoid ↔ Helicoid morph', 'Morph Catenoide ↔ Elicoide', '悬链面 ↔ 螺旋面 形变',
  E'\\begin{aligned}x &= \\cos t\\,\\sinh v\\,\\sin u + \\sin t\\,\\cosh v\\,\\cos u\\\\ y &= -\\cos t\\,\\sinh v\\,\\cos u + \\sin t\\,\\cosh v\\,\\sin u\\\\ z &= u\\cos t + v\\sin t\\end{aligned}',
  'morph',
E'// u, v in [0, 2π]; time in seconds. The Bonnet family animation: phase = 0 → helicoid, phase = π/2 → catenoid.\nconst phase = ((cos(time * 0.35) * -0.5) + 0.5) * (PI / 2)\nconst U = u\nconst V = 2*v/PI - 2\nconst ct = cos(phase)\nconst st = sin(phase)\nx = ct * sinh(V) * sin(U) + st * cosh(V) * cos(U)\ny = U * ct + V * st\nz = -ct * sinh(V) * cos(U) + st * cosh(V) * sin(U)',
  '{"uvSegments": 160}'::jsonb,
  5, false
where not exists (select 1 from stp_surfaces where slug = 'catenoid-helicoid');

-- 5. enneper — parametric, no params (fixed range remap)
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, source_code, metadata, sort_order, published)
select 'enneper', 'science_tech',
  'Enneper surface', 'Superficie di Enneper', '恩内佩尔曲面',
  E'\\begin{aligned}x &= u - \\tfrac{u^{3}}{3} + uv^{2}\\\\ y &= v - \\tfrac{v^{3}}{3} + vu^{2}\\\\ z &= u^{2} - v^{2}\\end{aligned}',
  'parametric',
E'// Range remap: incoming u, v are [0, 2π]; Enneper looks best on [-2, 2].\nconst U = 2*u/PI - 2\nconst V = 2*v/PI - 2\nconst s = 0.35\nx = s * (U - U*U*U/3 + U*V*V)\ny = s * (U*U - V*V)\nz = s * (V - V*V*V/3 + V*U*U)',
  '{"uvSegments": 100}'::jsonb,
  40, false
where not exists (select 1 from stp_surfaces where slug = 'enneper');

-- 6. saddle — parametric, no params
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, source_code, metadata, sort_order, published)
select 'saddle', 'science_tech',
  'Hyperbolic paraboloid', 'Paraboloide iperbolico', '双曲抛物面',
  E'z = \\tfrac{x^{2}}{a^{2}} - \\tfrac{y^{2}}{b^{2}}',
  'parametric',
E'// Range remap: u, v in [0, 2π] → X, Y in [-2, 2]. Z is the saddle.\nconst X = 2*u/PI - 2\nconst Y = 2*v/PI - 2\nconst Z = (X*X - Y*Y) * 0.18\nx = X\ny = Y\nz = Z',
  '{"uvSegments": 80}'::jsonb,
  50, false
where not exists (select 1 from stp_surfaces where slug = 'saddle');

-- 7. trefoil — kind='builtin', different default p/q from torus-knot
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, builtin_kind, sort_order, published)
select 'trefoil', 'science_tech',
  'Trefoil knot (2, 3)', 'Nodo trifoglio (2, 3)', '三叶纽结 (2, 3)',
  E'\\text{Torus knot } T(p,q)',
  'builtin',
  '[{"key":"p","label":"p","min":1,"max":8,"step":1,"default":2},
    {"key":"q","label":"q","min":1,"max":8,"step":1,"default":3},
    {"key":"R","label":"R","min":0.6,"max":2,"step":0.05,"default":1.05,"precision":2},
    {"key":"r","label":"r","min":0.1,"max":0.9,"step":0.02,"default":0.36,"precision":2}]'::jsonb,
  'torusKnot', 15, false
where not exists (select 1 from stp_surfaces where slug = 'trefoil');

-- 8. lorenz — attractor; body returns derivative (dx, dy, dz) from state (x, y, z)
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, point_count, metadata, sort_order, published)
select 'lorenz', 'science_tech',
  'Lorenz attractor', 'Attrattore di Lorenz', '洛伦茨吸引子',
  E'\\begin{aligned}\\dot{x}&=\\sigma(y-x)\\\\ \\dot{y}&=x(\\rho-z)-y\\\\ \\dot{z}&=xy-\\beta z\\end{aligned}\\;\\;(\\sigma{=}10,\\rho{=}28,\\beta{=}\\tfrac{8}{3})',
  'attractor',
  '[{"key":"sigma","label":"σ","min":1,"max":30,"step":0.5,"default":10,"precision":1},
    {"key":"rho","label":"ρ","min":1,"max":60,"step":0.5,"default":28,"precision":1},
    {"key":"beta","label":"β","min":0.5,"max":4,"step":0.05,"default":2.6667,"precision":2}]'::jsonb,
E'// Lorenz derivative. State: x, y, z. Params: sigma, rho, beta.\nconst sigma = (p && p.sigma != null) ? p.sigma : 10\nconst rho   = (p && p.rho   != null) ? p.rho   : 28\nconst beta  = (p && p.beta  != null) ? p.beta  : 8/3\ndx = sigma * (y - x)\ndy = x * (rho - z) - y\ndz = x * y - beta * z',
  8000,
  '{"dt": 0.01, "x0": 0.1, "y0": 0, "z0": 0}'::jsonb,
  60, false
where not exists (select 1 from stp_surfaces where slug = 'lorenz');

-- 9. rossler — attractor, slower dt and different initial condition
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, point_count, metadata, sort_order, published)
select 'rossler', 'science_tech',
  'Rössler attractor', 'Attrattore di Rössler', '勒斯勒尔吸引子',
  E'\\begin{aligned}\\dot{x}&=-y-z\\\\ \\dot{y}&=x+ay\\\\ \\dot{z}&=b+z(x-c)\\end{aligned}\\;\\;(a{=}b{=}0.2,\\,c{=}5.7)',
  'attractor',
  '[{"key":"a","label":"a","min":0.05,"max":0.4,"step":0.01,"default":0.2,"precision":2},
    {"key":"b","label":"b","min":0.05,"max":0.4,"step":0.01,"default":0.2,"precision":2},
    {"key":"c","label":"c","min":3,"max":12,"step":0.1,"default":5.7,"precision":1}]'::jsonb,
E'// Rössler derivative. State: x, y, z. Params: a, b, c.\nconst a = (p && p.a != null) ? p.a : 0.2\nconst b = (p && p.b != null) ? p.b : 0.2\nconst c = (p && p.c != null) ? p.c : 5.7\ndx = -y - z\ndy = x + a * y\ndz = b + z * (x - c)',
  7000,
  '{"dt": 0.035, "x0": 1, "y0": 1, "z0": 1}'::jsonb,
  70, false
where not exists (select 1 from stp_surfaces where slug = 'rossler');

-- 10. vogel — points, body returns one point per index
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, point_count, metadata, sort_order, published)
select 'vogel', 'science_tech',
  E'Vogel''s sunflower (golden angle)', 'Girasole di Vogel (angolo aureo)', '沃格尔螺旋（黄金角）',
  E'\\theta_n = n\\,\\phi,\\quad r_n = c\\sqrt{n},\\quad \\phi = (3-\\sqrt{5})\\pi \\approx 137.507°',
  'points',
  '[{"key":"angleDeg","label":"°","min":90,"max":180,"step":0.1,"default":137.5077640500378,"precision":3},
    {"key":"pointCount","label":"N","min":200,"max":4000,"step":100,"default":2200}]'::jsonb,
E'// Vogel phyllotaxis: i-th seed at angle i·φ, distance c·√i. Domed (y = 0.06·r²) so it reads as 3D.\nconst angleDeg = (p && p.angleDeg != null) ? p.angleDeg : 180 * (3 - sqrt(5))\nconst angleRad = angleDeg * PI / 180\nconst c = 0.06\nconst r = c * sqrt(i + 1)\nconst theta = (i + 1) * angleRad\nx = r * cos(theta)\ny = 0.06 * r * r\nz = r * sin(theta)',
  2200,
  '{"pointSize": 0.06, "animated": true}'::jsonb,
  80, false
where not exists (select 1 from stp_surfaces where slug = 'vogel');

-- 11. modal-sphere — morph, integer-mode cycling + amplitude
insert into stp_surfaces
  (slug, category, name_en, name_it, name_zh, equation, kind, params_schema, source_code, metadata, sort_order, published)
select 'modal-sphere', 'science_tech',
  'Modal sphere', 'Sfera modale', '模态球面',
  E'r(\\theta,\\phi)=1+0.45\\sin(l\\theta)\\cos(m\\phi)\\;,\\;\\; l,m \\in \\{2,3,4,5,6\\}',
  'morph',
  '[{"key":"l","label":"l","min":0,"max":8,"step":1,"default":0},
    {"key":"m","label":"m","min":0,"max":8,"step":1,"default":0},
    {"key":"amplitude","label":"amp","min":0.1,"max":0.7,"step":0.05,"default":0.45,"precision":2}]'::jsonb,
E'// Modal sphere: radius pulses by sin(l·θ)·cos(m·φ). When l=m=0 the modes cycle in time.\nconst amplitude = (p && p.amplitude != null) ? p.amplitude : 0.45\nlet lmode, mmode\nif ((p && p.l ? p.l : 0) === 0 && (p && p.m ? p.m : 0) === 0) {\n  lmode = 2 + floor(((sin(time * 0.32) * 0.5) + 0.5) * 4.999)\n  mmode = 2 + floor(((cos(time * 0.41) * 0.5) + 0.5) * 4.999)\n} else {\n  lmode = (p && p.l != null) ? p.l : 3\n  mmode = (p && p.m != null) ? p.m : 3\n}\nconst theta = u / 2\nconst phi = v\nconst r = 1 + amplitude * sin(lmode * theta) * cos(mmode * phi)\nx = r * sin(theta) * cos(phi)\ny = r * sin(theta) * sin(phi)\nz = r * cos(theta)',
  '{"uvSegments": 130}'::jsonb,
  90, false
where not exists (select 1 from stp_surfaces where slug = 'modal-sphere');
