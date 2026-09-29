/** Hand-tuned campaign. Masks: . play, # hole, i/I ice, c/C crate, l lock, m lock+ice, n nectar. */

const M = (text) => text.trim().split("\n").map((line) => line.trim());

function L(id, extra) {
  return {
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 22,
    seed: 5000 + id * 17,
    stars: [900, 1900, 3400],
    goals: [{ type: "score", target: 900 }],
    mask: null,
    extras: [],
    tip: null,
    ...extra,
    id,
  };
}

export const LEVELS = [
  L(1, {
    colors: 4,
    moves: 25,
    stars: [600, 1500, 2800],
    goals: [{ type: "score", target: 600 }],
    extras: [
      { r: 4, c: 2, t: "S", dir: "h", color: 0 },
      { r: 2, c: 5, t: "W", color: 1 },
    ],
    tip: "swap",
  }),
  L(2, {
    colors: 4,
    moves: 22,
    stars: [800, 1700, 3000],
    goals: [{ type: "score", target: 800 }],
    tip: "stripe",
  }),
  L(3, {
    colors: 4,
    moves: 22,
    stars: [900, 1800, 3200],
    goals: [{ type: "score", target: 900 }],
    extras: [{ r: 3, c: 3, t: "W", color: 2 }],
    tip: "wrap",
  }),
  L(4, {
    colors: 5,
    moves: 20,
    stars: [1000, 2000, 3400],
    goals: [{ type: "score", target: 1000 }],
  }),
  L(5, {
    colors: 5,
    moves: 20,
    stars: [1100, 2200, 3600],
    goals: [{ type: "score", target: 1100 }],
    extras: [{ r: 4, c: 4, t: "C" }],
    tip: "color",
  }),
  L(6, {
    colors: 5,
    moves: 18,
    stars: [1200, 2400, 4000],
    goals: [{ type: "score", target: 1200 }],
  }),
  L(7, {
    colors: 6,
    moves: 20,
    stars: [1300, 2600, 4200],
    goals: [{ type: "score", target: 1300 }],
  }),
  L(8, {
    colors: 6,
    moves: 18,
    stars: [1400, 2800, 4500],
    goals: [{ type: "score", target: 1400 }],
  }),
  L(9, {
    rows: 9,
    cols: 9,
    colors: 5,
    moves: 24,
    stars: [1600, 3000, 4800],
    goals: [{ type: "score", target: 1600 }],
  }),
  L(10, {
    rows: 9,
    cols: 9,
    colors: 6,
    moves: 22,
    stars: [1800, 3400, 5200],
    goals: [{ type: "score", target: 1800 }],
  }),
  L(11, {
    moves: 22,
    colors: 5,
    stars: [700, 1600, 2800],
    goals: [{ type: "ice", target: 8 }],
    tip: "ice",
    mask: M(`
........
........
........
........
........
........
........
iiiiiiii
    `),
  }),
  L(12, {
    moves: 24,
    colors: 5,
    stars: [800, 1700, 3000],
    goals: [{ type: "ice", target: 12 }],
    mask: M(`
........
........
........
........
..iiii..
..iiii..
..iiii..
........
    `),
  }),
  L(13, {
    moves: 26,
    colors: 5,
    stars: [900, 2000, 3400],
    goals: [{ type: "ice", target: 16 }],
    tip: "ice2",
    mask: M(`
........
........
........
........
........
..IIII..
..IIII..
........
    `),
  }),
  L(14, {
    moves: 24,
    colors: 6,
    stars: [800, 1800, 3200],
    goals: [{ type: "ice", target: 14 }],
    mask: M(`
i..ii..i
.i.ii.i.
..iiii..
...ii...
........
........
........
........
    `),
  }),
  L(15, {
    moves: 28,
    colors: 5,
    stars: [1000, 2200, 3800],
    goals: [{ type: "ice", target: 24 }],
    mask: M(`
........
........
........
........
iiiiiiii
IIIIIIII
........
........
    `),
  }),
  L(16, {
    rows: 9,
    cols: 9,
    moves: 30,
    colors: 6,
    stars: [1200, 2400, 4000],
    goals: [{ type: "ice", target: 18 }],
    mask: M(`
.........
.........
.........
.........
.........
.........
.........
iiiiiiiii
iiiiiiiii
    `),
  }),
  L(17, {
    colors: 4,
    moves: 22,
    stars: [600, 1400, 2600],
    goals: [{ type: "collect", color: 0, target: 12 }],
    tip: "collect",
  }),
  L(18, {
    colors: 4,
    moves: 22,
    stars: [700, 1500, 2800],
    goals: [{ type: "collect", color: 1, target: 14 }],
  }),
  L(19, {
    colors: 5,
    moves: 24,
    stars: [800, 1700, 3000],
    goals: [{ type: "collect", color: 2, target: 16 }],
  }),
  L(20, {
    colors: 5,
    moves: 26,
    stars: [900, 2000, 3400],
    goals: [
      { type: "collect", color: 0, target: 10 },
      { type: "collect", color: 3, target: 10 },
    ],
  }),
  L(21, {
    colors: 6,
    moves: 24,
    stars: [800, 1800, 3200],
    goals: [{ type: "collect", color: 4, target: 14 }],
  }),
  L(22, {
    colors: 6,
    moves: 26,
    stars: [1000, 2200, 3800],
    goals: [
      { type: "collect", color: 5, target: 12 },
      { type: "score", target: 1000 },
    ],
  }),
  L(23, {
    moves: 20,
    colors: 4,
    stars: [500, 1200, 2200],
    goals: [{ type: "ingredient", target: 2 }],
    tip: "nectar",
    mask: M(`
........
...n....
...n....
........
........
........
........
........
    `),
  }),
  L(24, {
    moves: 24,
    colors: 5,
    stars: [600, 1400, 2600],
    goals: [{ type: "ingredient", target: 3 }],
    mask: M(`
.n...n..
........
...n....
........
........
........
........
........
    `),
  }),
  L(25, {
    moves: 26,
    colors: 5,
    stars: [700, 1600, 2800],
    goals: [{ type: "ingredient", target: 3 }],
    mask: M(`
##....##
##....##
n......n
........
...n....
........
........
........
    `),
  }),
  L(26, {
    moves: 28,
    colors: 5,
    stars: [800, 1800, 3200],
    goals: [{ type: "ingredient", target: 2 }],
    mask: M(`
...n.n..
........
iiiiiiii
........
........
........
........
........
    `),
  }),
  L(27, {
    moves: 30,
    colors: 5,
    stars: [900, 2000, 3600],
    goals: [{ type: "ingredient", target: 2 }],
    tip: "crate",
    mask: M(`
...n.n..
........
........
........
........
...c.c..
........
...c.c..
    `),
  }),
  L(28, {
    rows: 9,
    cols: 9,
    moves: 32,
    colors: 6,
    stars: [1000, 2200, 4000],
    goals: [{ type: "ingredient", target: 4 }],
    mask: M(`
n.......n
.........
....n....
.........
.........
.........
....n....
.........
.........
    `),
  }),
  L(29, {
    moves: 24,
    colors: 5,
    stars: [1000, 2200, 3800],
    goals: [{ type: "score", target: 1000 }],
    tip: "crate",
    mask: M(`
........
..c..c..
........
.c....c.
........
..c..c..
........
........
    `),
  }),
  L(30, {
    moves: 26,
    colors: 5,
    stars: [900, 2000, 3600],
    goals: [{ type: "collect", color: 0, target: 12 }],
    mask: M(`
c..cc..c
........
........
..c..c..
........
........
c..cc..c
........
    `),
  }),
  L(31, {
    moves: 24,
    colors: 5,
    stars: [900, 1900, 3400],
    goals: [{ type: "score", target: 900 }],
    tip: "lock",
    mask: M(`
........
.l.l.l.l
........
l.l.l.l.
........
.l.l.l.l
........
........
    `),
  }),
  L(32, {
    moves: 26,
    colors: 6,
    stars: [1000, 2100, 3600],
    goals: [{ type: "score", target: 1000 }],
    mask: M(`
l.l.l.l.
.l.l.l.l
l.l.l.l.
........
........
........
........
........
    `),
  }),
  L(33, {
    moves: 28,
    colors: 5,
    stars: [1100, 2300, 4000],
    goals: [{ type: "score", target: 1100 }],
    mask: M(`
c..l..c.
........
.l....l.
........
c..l..c.
........
.l....l.
........
    `),
  }),
  L(34, {
    moves: 30,
    colors: 6,
    stars: [1200, 2500, 4200],
    goals: [
      { type: "score", target: 1200 },
      { type: "ice", target: 8 },
    ],
    mask: M(`
C..ll..C
........
iiiiiiii
........
..c..c..
........
.l.ll.l.
........
    `),
  }),
  L(35, {
    moves: 24,
    colors: 5,
    stars: [800, 1800, 3200],
    goals: [{ type: "score", target: 800 }],
    tip: "shape",
    mask: M(`
#......#
##....##
........
........
........
........
##....##
#......#
    `),
  }),
  L(36, {
    moves: 24,
    colors: 5,
    stars: [800, 1700, 3000],
    goals: [{ type: "collect", color: 2, target: 12 }],
    mask: M(`
###..###
###..###
........
........
........
........
###..###
###..###
    `),
  }),
  L(37, {
    moves: 28,
    colors: 5,
    stars: [700, 1600, 2800],
    goals: [{ type: "ingredient", target: 2 }],
    mask: M(`
........
.n....n.
.##..##.
.##..##.
.##..##.
.##..##.
........
........
    `),
  }),
  L(38, {
    moves: 26,
    colors: 6,
    stars: [900, 1900, 3400],
    goals: [{ type: "ice", target: 8 }],
    mask: M(`
###..###
##....##
#......#
...ii...
...ii...
#......#
##iiii##
###..###
    `),
  }),
  L(39, {
    moves: 26,
    colors: 5,
    stars: [900, 2000, 3600],
    goals: [{ type: "score", target: 900 }],
    mask: M(`
##....##
##....##
#......#
#......#
........
........
........
........
    `),
  }),
  L(40, {
    moves: 28,
    colors: 6,
    stars: [1000, 2200, 3800],
    goals: [{ type: "score", target: 1000 }],
    mask: M(`
.##..##.
#......#
........
........
........
.#....#.
..#..#..
...##...
    `),
  }),
  L(41, {
    rows: 9,
    cols: 9,
    moves: 32,
    colors: 6,
    stars: [1400, 2800, 4600],
    goals: [
      { type: "ice", target: 10 },
      { type: "score", target: 1400 },
    ],
    mask: M(`
.........
..c.c.c..
.........
.i.i.i.i.
.........
.l.l.l.l.
.........
iiiiiiii.
.........
    `),
  }),
  L(42, {
    rows: 9,
    cols: 9,
    moves: 36,
    colors: 6,
    stars: [1600, 3200, 5200],
    goals: [
      { type: "ingredient", target: 3 },
      { type: "ice", target: 9 },
      { type: "collect", color: 0, target: 10 },
    ],
    tip: "finale",
    mask: M(`
#.......#
#n..n..n#
#.......#
#.ii.ii.#
#.......#
#..ccc..#
#.......#
iiiiiiiii
#.......#
    `),
  }),
];
