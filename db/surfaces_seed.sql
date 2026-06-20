-- ============================================================
-- Starter pack: five math-art surfaces for the 3D Gallery
-- Run AFTER db/surfaces_schema.sql.
-- These appear on /gallery with a 🌐 badge and can be re-edited
-- in /admin/surfaces (sub-admins with the matching category grant
-- can edit them, super-admin can edit all).
-- u and v are in [0, 2π]; expressions remap internally where they
-- need a different range (Catalan, pseudosphere, Möbius width).
-- ============================================================

-- Idempotent re-runs: clear the seeded rows first so editing the
-- equations below + re-running picks up your edits.
delete from stp_surfaces where name_en in (
  'Roman surface (Steiner)',
  'Möbius bracelet (5 twists)',
  'Rippled sphere',
  'Catalan surface',
  'Beltrami pseudosphere'
);

insert into stp_surfaces (category, name_en, name_it, name_zh, equation, x_expr, y_expr, z_expr, sort_order) values

-- 1. Roman / Steiner surface — RP² immersed in R³ with three self-intersection lines.
('science_tech',
 'Roman surface (Steiner)',
 'Superficie romana (Steiner)',
 '罗马曲面（斯坦纳）',
 'x = \cos(2u)\cos^2 v,\quad y = \sin(2u)\cos^2 v,\quad z = \sin(2u)\sin v\cos v',
 'cos(2*u)*cos(v)*cos(v)',
 'sin(2*u)*cos(v)*cos(v)',
 'sin(2*u)*sin(v)*cos(v)',
 100),

-- 2. Möbius bracelet with 5 half-twists — denser, more sculptural than the classic 1-twist.
('science_tech',
 'Möbius bracelet (5 twists)',
 'Bracciale di Möbius (5 torsioni)',
 '五重莫比乌斯带',
 'x = (1 + \tfrac{w}{2}\cos\tfrac{5u}{2})\cos u,\; y = (1 + \tfrac{w}{2}\cos\tfrac{5u}{2})\sin u,\; z = \tfrac{w}{2}\sin\tfrac{5u}{2}\quad (w = (v-\pi)/2)',
 '(1 + ((v-PI)/4) * cos(5*u/2)) * cos(u)',
 '(1 + ((v-PI)/4) * cos(5*u/2)) * sin(u)',
 '((v-PI)/4) * sin(5*u/2)',
 110),

-- 3. Rippled sphere — radius modulated by sin(8u)cos(8v); reads like a sea-urchin shell.
('science_tech',
 'Rippled sphere',
 'Sfera increspata',
 '波纹球面',
 'r(u,v) = 1 + 0.25\sin(8u)\cos(8v)',
 '(1 + 0.25*sin(8*u)*cos(8*v)) * sin(u) * cos(v)',
 '(1 + 0.25*sin(8*u)*cos(8*v)) * sin(u) * sin(v)',
 '(1 + 0.25*sin(8*u)*cos(8*v)) * cos(u)',
 120),

-- 4. Catalan's surface — minimal surface ruled by cycloid lines; uses cosh / sinh.
('science_tech',
 'Catalan surface',
 'Superficie di Catalan',
 '加泰罗尼亚极小曲面',
 'x = u - \sin u\cosh v,\quad y = 1 - \cos u\cosh v,\quad z = -4\sin\tfrac{u}{2}\sinh\tfrac{v}{2}',
 'u - sin(u) * cosh((v-PI)/2)',
 '1 - cos(u) * cosh((v-PI)/2)',
 '-4 * sin(u/2) * sinh((v-PI)/4)',
 130),

-- 5. Beltrami pseudosphere — constant negative Gaussian curvature, the "trumpet" model of hyperbolic geometry.
('science_tech',
 'Beltrami pseudosphere',
 'Pseudosfera di Beltrami',
 '贝尔特拉米伪球面',
 'x = \tfrac{\cos u}{\cosh v},\quad y = \tfrac{\sin u}{\cosh v},\quad z = v - \tanh v',
 'cos(u) / cosh(v - PI)',
 'sin(u) / cosh(v - PI)',
 '(v - PI) - tanh(v - PI)',
 140);
