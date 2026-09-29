/**
 * Sochny Ryad — pure match-3 rules engine.
 * No DOM. Safe to import from Node tests and the browser.
 */

export const FRUIT_IDS = ["apple", "orange", "lemon", "pear", "blueberry", "grape"];

export function fruit(color, id = 0) {
  return { id, t: "F", color, dir: null };
}
export function striped(color, dir, id = 0) {
  return { id, t: "S", color, dir };
}
export function wrapped(color, id = 0) {
  return { id, t: "W", color, dir: null };
}
export function colorBomb(id = 0) {
  return { id, t: "C", color: null, dir: null };
}
export function nectar(id = 0) {
  return { id, t: "I", color: null, dir: null };
}
export function cell(piece = null, extra = {}) {
  return { hole: false, crate: 0, ice: 0, lock: 0, piece, ...extra };
}
export function hole() {
  return { hole: true, crate: 0, ice: 0, lock: 0, piece: null };
}
export function crate(hp = 1) {
  return { hole: false, crate: hp, ice: 0, lock: 0, piece: null };
}

export function makeState(grid, extra = {}) {
  return {
    rows: grid.length,
    cols: grid[0].length,
    grid,
    score: extra.score ?? 0,
    moves: extra.moves ?? 20,
    goals: (extra.goals ?? [{ type: "score", target: 999999 }]).map((g) => ({
      current: 0,
      ...g,
    })),
    stars: extra.stars ? extra.stars.slice() : [500, 1500, 3000],
    colors: extra.colors ?? 6,
    seed: extra.seed ?? 1,
    nextId: extra.nextId ?? 1000,
    status: "playing",
    levelId: extra.levelId ?? 0,
    multiplier: 1,
  };
}

export function cloneGrid(grid) {
  return grid.map((row) =>
    row.map((c) => ({
      hole: c.hole,
      crate: c.crate,
      ice: c.ice,
      lock: c.lock,
      piece: c.piece ? { ...c.piece } : null,
    })),
  );
}

export function cloneState(state) {
  return {
    ...state,
    goals: state.goals.map((g) => ({ ...g })),
    stars: state.stars.slice(),
    grid: cloneGrid(state.grid),
  };
}

function nextRand(state) {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function keyOf(r, c) {
  return r + "," + c;
}

function inBounds(state, r, c) {
  return r >= 0 && c >= 0 && r < state.rows && c < state.cols;
}

function neighbors4(state, r, c) {
  const out = [];
  if (r > 0) out.push({ r: r - 1, c });
  if (r + 1 < state.rows) out.push({ r: r + 1, c });
  if (c > 0) out.push({ r, c: c - 1 });
  if (c + 1 < state.cols) out.push({ r, c: c + 1 });
  return out;
}

export function matchColor(cell) {
  if (!cell || cell.hole || cell.crate > 0 || cell.lock > 0) return null;
  const p = cell.piece;
  if (!p || p.t === "C" || p.t === "I") return null;
  if (p.t === "F" || p.t === "S" || p.t === "W") return p.color;
  return null;
}

export function findRuns(grid) {
  const runs = [];
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const color = matchColor(grid[r][c]);
      if (color === null) {
        c++;
        continue;
      }
      let c2 = c + 1;
      while (c2 < cols && matchColor(grid[r][c2]) === color) c2++;
      if (c2 - c >= 3) {
        const cells = [];
        for (let k = c; k < c2; k++) cells.push({ r, c: k });
        runs.push({ dir: "h", color, cells });
      }
      c = c2;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const color = matchColor(grid[r][c]);
      if (color === null) {
        r++;
        continue;
      }
      let r2 = r + 1;
      while (r2 < rows && matchColor(grid[r2][c]) === color) r2++;
      if (r2 - r >= 3) {
        const cells = [];
        for (let k = r; k < r2; k++) cells.push({ r: k, c });
        runs.push({ dir: "v", color, cells });
      }
      r = r2;
    }
  }
  return runs;
}

export function findGroups(grid) {
  const runs = findRuns(grid);
  const parent = runs.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const share = (a, b) => {
    const set = new Set(a.cells.map((c) => keyOf(c.r, c.c)));
    return b.cells.some((c) => set.has(keyOf(c.r, c.c)));
  };
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      if (share(runs[i], runs[j])) parent[find(i)] = find(j);
    }
  }
  const buckets = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(run);
  });
  const groups = [];
  for (const list of buckets.values()) {
    const map = new Map();
    for (const run of list) {
      for (const c of run.cells) map.set(keyOf(c.r, c.c), c);
    }
    groups.push({ runs: list, cells: [...map.values()], color: list[0].color });
  }
  return groups;
}

export function hasAnyMatch(grid) {
  return findRuns(grid).length > 0;
}

function canSwapCell(cell) {
  return !!(cell && !cell.hole && cell.crate <= 0 && cell.lock <= 0 && cell.piece);
}

function isLineSpecial(piece) {
  return !!piece && (piece.t === "S" || piece.t === "W");
}

export function comboKind(a, b) {
  if (!a || !b) return null;
  const rank = (p) => (p.t === "C" ? "C" : p.t === "W" ? "W" : p.t === "S" ? "S" : null);
  const ka = rank(a);
  const kb = rank(b);
  if (ka === "C" || kb === "C") {
    const other = ka === "C" ? b : a;
    if (other.t === "I") return null;
    if (other.t === "C") return "CC";
    if (other.t === "S") return "CS";
    if (other.t === "W") return "CW";
    if (other.t === "F") return "CF";
    return null;
  }
  if (ka && kb) {
    const pair = [ka, kb].sort().join("");
    if (pair === "SS") return "SS";
    if (pair === "SW") return "SW";
    if (pair === "WW") return "WW";
  }
  return null;
}

function swipeDir(r1, c1, r2, c2) {
  if (r1 === r2) return "h";
  if (c1 === c2) return "v";
  return null;
}

function adjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function wouldCreateMatch(state, r1, c1, r2, c2) {
  const a = state.grid[r1][c1].piece;
  const b = state.grid[r2][c2].piece;
  state.grid[r1][c1].piece = b;
  state.grid[r2][c2].piece = a;
  const hit = hasAnyMatch(state.grid);
  state.grid[r1][c1].piece = a;
  state.grid[r2][c2].piece = b;
  return hit;
}

export function isValidMove(state, r1, c1, r2, c2) {
  if (!inBounds(state, r1, c1) || !inBounds(state, r2, c2) || !adjacent(r1, c1, r2, c2)) return false;
  const ca = state.grid[r1][c1];
  const cb = state.grid[r2][c2];
  if (!canSwapCell(ca) || !canSwapCell(cb)) return false;
  const kind = comboKind(ca.piece, cb.piece);
  if (kind) return true;
  if (isLineSpecial(ca.piece) || isLineSpecial(cb.piece)) return true;
  return wouldCreateMatch(state, r1, c1, r2, c2);
}

export function listValidMoves(state) {
  const moves = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (c + 1 < state.cols && isValidMove(state, r, c, r, c + 1)) {
        moves.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      }
      if (r + 1 < state.rows && isValidMove(state, r, c, r + 1, c)) {
        moves.push({ r1: r, c1: c, r2: r + 1, c2: c });
      }
    }
  }
  return moves;
}

function lineCells(state, r, c, dir) {
  const cells = [];
  if (dir === "h") {
    for (let cc = 0; cc < state.cols; cc++) cells.push({ r, c: cc });
  } else {
    for (let rr = 0; rr < state.rows; rr++) cells.push({ r: rr, c });
  }
  return cells;
}

function areaCells(state, r, c, radius) {
  const cells = [];
  for (let rr = r - radius; rr <= r + radius; rr++) {
    for (let cc = c - radius; cc <= c + radius; cc++) {
      if (inBounds(state, rr, cc)) cells.push({ r: rr, c: cc });
    }
  }
  return cells;
}

function contains(cells, r, c) {
  return cells.some((cell) => cell.r === r && cell.c === c);
}

function planGroup(group, origin, alt, swipe) {
  const runs = group.runs;
  const maxLen = Math.max(...runs.map((run) => run.cells.length));
  const dirs = new Set(runs.map((run) => run.dir));
  const color = group.color;
  const prefer = (cells) => {
    if (origin && contains(cells, origin.r, origin.c)) return origin;
    if (alt && contains(cells, alt.r, alt.c)) return alt;
    return cells[Math.floor((cells.length - 1) / 2)];
  };
  if (maxLen >= 5) {
    const longest = runs.slice().sort((a, b) => b.cells.length - a.cells.length)[0];
    const pos = prefer(longest.cells);
    return { r: pos.r, c: pos.c, t: "C", color: null, dir: null };
  }
  if (dirs.size >= 2) {
    const seen = new Map();
    for (const run of runs) {
      for (const cell of run.cells) {
        const k = keyOf(cell.r, cell.c);
        seen.set(k, (seen.get(k) || 0) + 1);
      }
    }
    let pos = null;
    for (const [k, n] of seen) {
      if (n >= 2) {
        const [r, c] = k.split(",").map(Number);
        pos = { r, c };
        break;
      }
    }
    if (!pos) pos = group.cells[0];
    if (origin && seen.get(keyOf(origin.r, origin.c)) >= 2) pos = origin;
    return { r: pos.r, c: pos.c, t: "W", color, dir: null };
  }
  if (maxLen >= 4) {
    const run = runs.slice().sort((a, b) => b.cells.length - a.cells.length)[0];
    const pos = prefer(run.cells);
    const dir = swipe === "h" || swipe === "v" ? swipe : run.dir === "h" ? "v" : "h";
    return { r: pos.r, c: pos.c, t: "S", color, dir };
  }
  return null;
}

function popupFor(mult) {
  if (mult >= 4) return "wow";
  if (mult === 3) return "tasty";
  if (mult === 2) return "juicy";
  return null;
}

function syncScore(state) {
  for (const g of state.goals) {
    if (g.type === "score") g.current = state.score;
  }
}

export function goalsMet(state) {
  syncScore(state);
  return state.goals.every((g) => g.current >= g.target);
}

export function starCount(state) {
  let n = 0;
  for (const threshold of state.stars) if (state.score >= threshold) n++;
  return n;
}

function noteIce(state, n) {
  for (const g of state.goals) if (g.type === "ice") g.current += n;
}

function noteCollect(state, piece) {
  if (!piece || piece.color == null || piece.t === "I" || piece.t === "C") return;
  for (const g of state.goals) {
    if (g.type === "collect" && g.color === piece.color) g.current += 1;
  }
}

function snap(state) {
  syncScore(state);
  return {
    score: state.score,
    moves: state.moves,
    status: state.status,
    multiplier: state.multiplier,
    goals: state.goals.map((g) => ({ ...g })),
    grid: cloneGrid(state.grid),
  };
}

function isBlocker(cell) {
  if (cell.hole) return false;
  if (cell.crate > 0) return true;
  if (cell.lock > 0 && cell.piece) return true;
  return false;
}

function exitRow(state, c) {
  for (let r = state.rows - 1; r >= 0; r--) {
    if (!state.grid[r][c].hole) return r;
  }
  return -1;
}

function settle(state, multiplier) {
  const moves = [];
  const spawned = [];
  const collected = [];
  for (let c = 0; c < state.cols; c++) {
    const blocker = [];
    for (let r = 0; r < state.rows; r++) blocker.push(isBlocker(state.grid[r][c]));
    const exit = exitRow(state, c);
    let r = 0;
    while (r < state.rows) {
      if (blocker[r]) {
        r++;
        continue;
      }
      const segStart = r;
      const seg = [];
      while (r < state.rows && !blocker[r]) {
        seg.push(r);
        r++;
      }
      const slotsTop = seg.filter((rr) => !state.grid[rr][c].hole);
      const slots = slotsTop.slice().reverse();
      const pieces = [];
      for (const rr of slots) {
        const piece = state.grid[rr][c].piece;
        if (piece) pieces.push({ piece, fromR: rr });
      }
      for (const rr of slots) state.grid[rr][c].piece = null;
      let pi = 0;
      for (let si = 0; si < slots.length && pi < pieces.length; si++) {
        const rr = slots[si];
        while (pi < pieces.length) {
          const item = pieces[pi++];
          if (item.piece.t === "I" && rr === exit && state.grid[rr][c].crate <= 0 && state.grid[rr][c].lock <= 0) {
            collected.push({ id: item.piece.id, r: rr, c, fromR: item.fromR });
            state.score += 500 * multiplier;
            for (const g of state.goals) if (g.type === "ingredient") g.current += 1;
            if (item.fromR !== rr) {
              moves.push({ id: item.piece.id, fromR: item.fromR, fromC: c, toR: rr, toC: c, collect: true });
            }
            si--;
            break;
          }
          state.grid[rr][c].piece = item.piece;
          if (item.fromR !== rr) {
            moves.push({ id: item.piece.id, fromR: item.fromR, fromC: c, toR: rr, toC: c });
          }
          break;
        }
      }
      const connected = segStart === 0;
      if (connected) {
        const empty = slots.filter((rr) => !state.grid[rr][c].piece);
        const n = empty.length;
        for (let i = 0; i < n; i++) {
          const rr = empty[i];
          const color = Math.floor(nextRand(state) * state.colors);
          const piece = { id: ++state.nextId, t: "F", color, dir: null };
          state.grid[rr][c].piece = piece;
          spawned.push({
            id: piece.id,
            piece: { ...piece },
            fromR: i - n,
            fromC: c,
            toR: rr,
            toC: c,
          });
        }
      }
    }
  }
  syncScore(state);
  return { drops: moves, spawned, collected, scoreGain: collected.length * 500 * multiplier };
}

function executeWave(state, opt) {
  const clear = new Map();
  const add = (r, c) => {
    if (!inBounds(state, r, c)) return;
    const k = keyOf(r, c);
    if (!clear.has(k)) clear.set(k, { r, c });
  };
  if (opt.preset) for (const p of opt.preset) add(p.r, p.c);
  const groups = opt.groups || [];
  const spawns = [];
  for (const group of groups) {
    for (const cell of group.cells) add(cell.r, cell.c);
    const plan = planGroup(group, opt.origin, opt.alt, opt.swipe);
    if (plan) spawns.push(plan);
  }
  const spawnKeys = new Set(spawns.map((s) => keyOf(s.r, s.c)));
  const activated = new Set(opt.preActivated || []);
  const phase2 = [];
  const blasts = opt.blasts ? opt.blasts.slice() : [];
  const queue = [...clear.values()];
  let qi = 0;
  while (qi < queue.length && qi < 900) {
    const pos = queue[qi++];
    const k = keyOf(pos.r, pos.c);
    if (activated.has(k)) continue;
    const piece = state.grid[pos.r][pos.c].piece;
    if (!piece) continue;
    if (piece.t === "S") {
      activated.add(k);
      blasts.push({ kind: piece.dir === "h" ? "row" : "col", r: pos.r, c: pos.c });
      for (const cell of lineCells(state, pos.r, pos.c, piece.dir || "h")) {
        const ck = keyOf(cell.r, cell.c);
        if (!clear.has(ck)) {
          clear.set(ck, cell);
          queue.push(cell);
        }
      }
    } else if (piece.t === "W") {
      activated.add(k);
      blasts.push({ kind: "area", r: pos.r, c: pos.c, radius: 1 });
      phase2.push({ r: pos.r, c: pos.c, radius: 1 });
      for (const cell of areaCells(state, pos.r, pos.c, 1)) {
        const ck = keyOf(cell.r, cell.c);
        if (!clear.has(ck)) {
          clear.set(ck, cell);
          queue.push(cell);
        }
      }
    }
  }

  const crateHits = new Set();
  const lockHits = new Set();
  for (const group of groups) {
    for (const cell of group.cells) {
      for (const n of neighbors4(state, cell.r, cell.c)) {
        const nk = keyOf(n.r, n.c);
        const nc = state.grid[n.r][n.c];
        if (nc.crate > 0) crateHits.add(nk);
        if (nc.lock > 0 && nc.piece && !clear.has(nk)) lockHits.add(nk);
      }
    }
  }
  for (const [k, pos] of clear) {
    if (state.grid[pos.r][pos.c].crate > 0) crateHits.add(k);
  }

  const removed = [];
  let pieceCount = 0;
  for (const [k, pos] of clear) {
    if (spawnKeys.has(k)) continue;
    const tile = state.grid[pos.r][pos.c];
    if (tile.hole) continue;
    if (tile.crate > 0) continue;
    if (tile.piece && tile.piece.t === "I") continue;
    if (tile.piece) {
      removed.push({
        id: tile.piece.id,
        r: pos.r,
        c: pos.c,
        t: tile.piece.t,
        color: tile.piece.color,
        dir: tile.piece.dir,
      });
      noteCollect(state, tile.piece);
      pieceCount++;
      tile.piece = null;
      if (tile.lock > 0) tile.lock = 0;
      if (tile.ice > 0) {
        tile.ice -= 1;
        noteIce(state, 1);
      }
    } else if (tile.ice > 0) {
      tile.ice -= 1;
      noteIce(state, 1);
    }
  }

  const spawnedSpecials = [];
  for (const plan of spawns) {
    const tile = state.grid[plan.r][plan.c];
    if (tile.hole || tile.crate > 0) continue;
    if (tile.piece && tile.piece.t !== "I") {
      removed.push({
        id: tile.piece.id,
        r: plan.r,
        c: plan.c,
        t: tile.piece.t,
        color: tile.piece.color,
        dir: tile.piece.dir,
      });
      noteCollect(state, tile.piece);
      pieceCount++;
    }
    if (tile.ice > 0) {
      tile.ice -= 1;
      noteIce(state, 1);
    }
    const piece = {
      id: ++state.nextId,
      t: plan.t,
      color: plan.t === "C" ? null : plan.color,
      dir: plan.dir || null,
    };
    tile.piece = piece;
    tile.lock = 0;
    spawnedSpecials.push({
      id: piece.id,
      r: plan.r,
      c: plan.c,
      t: piece.t,
      color: piece.color,
      dir: piece.dir,
    });
  }

  let cratesBroken = 0;
  for (const k of crateHits) {
    const [r, c] = k.split(",").map(Number);
    const tile = state.grid[r][c];
    if (tile.crate > 0) {
      tile.crate -= 1;
      cratesBroken++;
      state.score += 40 * (opt.multiplier || 1);
    }
  }
  for (const k of lockHits) {
    const [r, c] = k.split(",").map(Number);
    const tile = state.grid[r][c];
    if (tile.lock > 0) tile.lock -= 1;
  }

  const mult = opt.multiplier || 1;
  const gain = 40 * pieceCount * mult + 100 * spawns.length * mult;
  state.score += gain;
  state.multiplier = mult;
  syncScore(state);
  const mid = snap(state);
  const fall = settle(state, mult);
  const end = snap(state);
  const changed =
    pieceCount > 0 ||
    spawns.length > 0 ||
    cratesBroken > 0 ||
    lockHits.size > 0 ||
    fall.collected.length > 0 ||
    fall.drops.length > 0 ||
    fall.spawned.length > 0;
  return {
    changed,
    phase2,
    steps: [
      {
        ...mid,
        type: "burst",
        removed,
        spawnedSpecials,
        blasts,
        scoreGain: gain,
        popup: popupFor(mult),
        shake: pieceCount >= 10 || mult >= 4 ? 2 : pieceCount >= 6 || mult >= 3 ? 1 : 0,
        multiplier: mult,
      },
      {
        ...end,
        type: "fall",
        ...fall,
        multiplier: mult,
        popup: null,
        shake: 0,
      },
    ],
  };
}

function resolveBoard(state, steps, opt = {}) {
  let pendingPreset = opt.preset?.length ? dedupe(opt.preset) : null;
  let phase2 = opt.phase2 ? opt.phase2.slice() : [];
  let preActivated = new Set(opt.preActivated || []);
  let origin = opt.origin || null;
  let alt = opt.alt || null;
  let swipe = opt.swipe || null;
  let skipGroups = !!opt.combo;
  let wave = 0;
  while (wave < 36) {
    let preset = null;
    let groups = [];
    let pre = preActivated;
    if (pendingPreset && pendingPreset.length) {
      preset = pendingPreset;
      pendingPreset = null;
      if (!skipGroups) groups = findGroups(state.grid);
      skipGroups = false;
    } else if (phase2.length) {
      preset = [];
      const seen = new Set();
      for (const p of phase2) {
        for (const cell of areaCells(state, p.r, p.c, p.radius || 1)) {
          const k = keyOf(cell.r, cell.c);
          if (!seen.has(k)) {
            seen.add(k);
            preset.push(cell);
          }
        }
      }
      phase2 = [];
      pre = new Set();
      origin = null;
      alt = null;
      swipe = null;
    } else {
      groups = findGroups(state.grid);
      pre = new Set();
    }
    preActivated = new Set();
    if ((!preset || preset.length === 0) && groups.length === 0) break;
    wave++;
    const result = executeWave(state, {
      groups,
      preset,
      origin,
      alt,
      swipe,
      preActivated: pre,
      multiplier: wave,
      blasts: opt.blasts && wave === 1 ? opt.blasts : null,
    });
    origin = null;
    alt = null;
    swipe = null;
    steps.push(...result.steps);
    phase2.push(...result.phase2);
    if (!result.changed && phase2.length === 0) break;
  }
}

function dedupe(cells) {
  const seen = new Set();
  const out = [];
  for (const cell of cells) {
    const k = keyOf(cell.r, cell.c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ r: cell.r, c: cell.c });
  }
  return out;
}

function cellsOfColor(state, color) {
  const list = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const p = state.grid[r][c].piece;
      if (p && p.color === color && (p.t === "F" || p.t === "S" || p.t === "W")) list.push({ r, c });
    }
  }
  return list;
}

function applyCombo(state, steps, r1, c1, r2, c2, kind) {
  const a = state.grid[r1][c1].piece;
  const b = state.grid[r2][c2].piece;
  const preset = [];
  const pre = [];
  const phase2 = [];
  const blasts = [];

  const takeColor = (piece) => (piece && piece.t !== "C" ? piece.color : null);

  if (kind === "SS") {
    for (const [r, c] of [
      [r1, c1],
      [r2, c2],
    ]) {
      for (let cc = 0; cc < state.cols; cc++) preset.push({ r, c: cc });
      for (let rr = 0; rr < state.rows; rr++) preset.push({ r: rr, c });
      pre.push(keyOf(r, c));
      blasts.push({ kind: "cross", r, c });
    }
  } else if (kind === "SW") {
    const wr = a.t === "W" ? { r: r1, c: c1 } : { r: r2, c: c2 };
    for (let rr = wr.r - 1; rr <= wr.r + 1; rr++) {
      if (rr >= 0 && rr < state.rows) {
        for (let cc = 0; cc < state.cols; cc++) preset.push({ r: rr, c: cc });
        blasts.push({ kind: "row", r: rr, c: wr.c });
      }
    }
    for (let cc = wr.c - 1; cc <= wr.c + 1; cc++) {
      if (cc >= 0 && cc < state.cols) {
        for (let rr = 0; rr < state.rows; rr++) preset.push({ r: rr, c: cc });
        blasts.push({ kind: "col", r: wr.r, c: cc });
      }
    }
    pre.push(keyOf(r1, c1), keyOf(r2, c2));
  } else if (kind === "WW") {
    const cr = r2;
    const cc = c2;
    for (const cell of areaCells(state, cr, cc, 2)) preset.push(cell);
    pre.push(keyOf(r1, c1), keyOf(r2, c2));
    phase2.push({ r: cr, c: cc, radius: 2 });
    blasts.push({ kind: "area", r: cr, c: cc, radius: 2 });
  } else if (kind === "CC") {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const tile = state.grid[r][c];
        if (tile.hole) continue;
        if (tile.piece && tile.piece.t === "I") continue;
        preset.push({ r, c });
        if (tile.piece && (tile.piece.t === "S" || tile.piece.t === "W")) pre.push(keyOf(r, c));
      }
    }
    blasts.push({ kind: "board", r: r2, c: c2 });
  } else if (kind === "CF" || kind === "CS" || kind === "CW") {
    const bombAt = a.t === "C" ? { r: r1, c: c1 } : { r: r2, c: c2 };
    const other = a.t === "C" ? b : a;
    const color = takeColor(other);
    const targets = cellsOfColor(state, color);
    if (kind === "CS" || kind === "CW") {
      targets.forEach((pos, i) => {
        const tile = state.grid[pos.r][pos.c];
        const dir = i % 2 === 0 ? "h" : "v";
        tile.piece = {
          id: ++state.nextId,
          t: kind === "CS" ? "S" : "W",
          color,
          dir: kind === "CS" ? dir : null,
        };
      });
      steps.push({
        type: "convert",
        cells: targets.map((pos, i) => ({
          r: pos.r,
          c: pos.c,
          piece: { ...state.grid[pos.r][pos.c].piece },
          dir: kind === "CS" ? (i % 2 === 0 ? "h" : "v") : null,
        })),
        ...snap(state),
      });
    }
    for (const pos of targets) preset.push(pos);
    preset.push(bombAt);
    blasts.push({ kind: "color", r: bombAt.r, c: bombAt.c, color });
  }

  resolveBoard(state, steps, {
    preset,
    preActivated: pre,
    phase2,
    combo: true,
    blasts,
  });
}

function reshufflePieces(state) {
  const bag = [];
  const spots = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const tile = state.grid[r][c];
      if (tile.hole || tile.crate > 0 || tile.lock > 0 || !tile.piece) continue;
      if (tile.piece.t === "I") continue;
      spots.push({ r, c });
      bag.push(tile.piece);
    }
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(state) * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  spots.forEach((spot, i) => {
    state.grid[spot.r][spot.c].piece = bag[i];
  });
}

function paintForcedMove(state) {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols - 2; c++) {
      const cells = [state.grid[r][c], state.grid[r][c + 1], state.grid[r][c + 2]];
      if (!cells.every((tile) => canSwapCell(tile) && tile.piece.t === "F")) continue;
      let partner = null;
      const options = [
        [r + 1, c + 2],
        [r - 1, c + 2],
        [r, c + 3],
      ];
      for (const [rr, cc] of options) {
        if (!inBounds(state, rr, cc)) continue;
        const tile = state.grid[rr][cc];
        if (canSwapCell(tile) && tile.piece.t === "F") {
          partner = { r: rr, c: cc };
          break;
        }
      }
      if (!partner) continue;
      const color = 0;
      cells[0].piece.color = color;
      cells[1].piece.color = color;
      cells[2].piece.color = (color + 1) % state.colors;
      state.grid[partner.r][partner.c].piece.color = color;
      state.grid[partner.r][partner.c].piece.t = "F";
      state.grid[partner.r][partner.c].piece.dir = null;
      if (isValidMove(state, r, c + 2, partner.r, partner.c) && !hasAnyMatch(state.grid)) return true;
    }
  }
  return listValidMoves(state).length > 0;
}

function ensurePlayable(state, steps) {
  if (listValidMoves(state).length > 0 && !hasAnyMatch(state.grid)) return;
  for (let i = 0; i < 24; i++) {
    reshufflePieces(state);
    repair(state);
    if (!hasAnyMatch(state.grid) && listValidMoves(state).length > 0) {
      steps.push({ type: "shuffle", ...snap(state), popup: "shuffle" });
      return;
    }
  }
  paintForcedMove(state);
  repair(state);
  steps.push({ type: "shuffle", ...snap(state), popup: "shuffle" });
}

function finishTurn(state, steps, depth = 0) {
  syncScore(state);
  if (goalsMet(state)) {
    runBonus(state, steps);
    state.status = "won";
    state.moves = 0;
    steps.push({ type: "status", ...snap(state) });
    return;
  }
  if (state.moves <= 0) {
    state.status = "lost";
    steps.push({ type: "status", ...snap(state) });
    return;
  }
  if (depth < 2 && (listValidMoves(state).length === 0 || hasAnyMatch(state.grid))) {
    if (hasAnyMatch(state.grid)) {
      resolveBoard(state, steps, {});
      finishTurn(state, steps, depth + 1);
      return;
    }
    ensurePlayable(state, steps);
    if (hasAnyMatch(state.grid)) {
      resolveBoard(state, steps, {});
    }
    finishTurn(state, steps, depth + 1);
    return;
  }
  state.status = "playing";
  steps.push({ type: "status", ...snap(state) });
}

function randomFruitSpot(state) {
  const spots = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const tile = state.grid[r][c];
      if (canSwapCell(tile) && tile.piece.t === "F") spots.push({ r, c });
    }
  }
  if (!spots.length) return null;
  return spots[Math.floor(nextRand(state) * spots.length)];
}

function runBonus(state, steps) {
  const left = state.moves;
  for (let i = 0; i < left; i++) {
    state.moves -= 1;
    const spot = randomFruitSpot(state);
    if (!spot) {
      state.score += 250;
      syncScore(state);
      continue;
    }
    const wrappedBonus = i % 3 === 2;
    const piece = {
      id: ++state.nextId,
      t: wrappedBonus ? "W" : "S",
      color: state.grid[spot.r][spot.c].piece.color,
      dir: wrappedBonus ? null : i % 2 === 0 ? "h" : "v",
    };
    state.grid[spot.r][spot.c].piece = piece;
    steps.push({
      type: "bonus",
      r: spot.r,
      c: spot.c,
      piece: { ...piece },
      ...snap(state),
    });
    const preset =
      piece.t === "S" ? lineCells(state, spot.r, spot.c, piece.dir) : areaCells(state, spot.r, spot.c, 1);
    resolveBoard(state, steps, { preset, combo: false });
    if (goalsMet(state) && state.moves > 0) {
      // Goals were already met; keep converting the rest of the moves.
    }
  }
  syncScore(state);
}

export function resolveSwap(state, r1, c1, r2, c2) {
  if (!inBounds(state, r1, c1) || !inBounds(state, r2, c2) || !adjacent(r1, c1, r2, c2)) {
    return { ok: false, state, steps: [] };
  }
  const ca = state.grid[r1][c1];
  const cb = state.grid[r2][c2];
  if (!canSwapCell(ca) || !canSwapCell(cb)) return { ok: false, state, steps: [] };
  const id1 = ca.piece.id;
  const id2 = cb.piece.id;
  const kind = comboKind(ca.piece, cb.piece);
  const special = isLineSpecial(ca.piece) || isLineSpecial(cb.piece);
  if (!kind && !special && !wouldCreateMatch(state, r1, c1, r2, c2)) {
    return {
      ok: false,
      state,
      steps: [
        { type: "swap", r1, c1, r2, c2, id1, id2 },
        { type: "swapback", r1, c1, r2, c2, id1, id2 },
      ],
    };
  }
  const next = cloneState(state);
  const pa = next.grid[r1][c1].piece;
  next.grid[r1][c1].piece = next.grid[r2][c2].piece;
  next.grid[r2][c2].piece = pa;
  next.moves -= 1;
  const steps = [{ type: "swap", r1, c1, r2, c2, id1, id2, ...snap(next) }];
  const dir = swipeDir(r1, c1, r2, c2);
  if (kind) {
    applyCombo(next, steps, r1, c1, r2, c2, kind);
  } else {
    const preset = [];
    for (const [r, c] of [
      [r1, c1],
      [r2, c2],
    ]) {
      const piece = next.grid[r][c].piece;
      if (!piece) continue;
      if (piece.t === "S") preset.push(...lineCells(next, r, c, piece.dir || "h"));
      if (piece.t === "W") preset.push(...areaCells(next, r, c, 1));
    }
    resolveBoard(next, steps, {
      preset,
      origin: { r: r2, c: c2 },
      alt: { r: r1, c: c1 },
      swipe: dir,
    });
  }
  finishTurn(next, steps);
  return { ok: true, state: next, steps };
}

export function applyHammer(state, r, c) {
  if (!inBounds(state, r, c)) return { ok: false, state, steps: [] };
  const tile = state.grid[r][c];
  if (tile.hole) return { ok: false, state, steps: [] };
  if (!tile.piece && tile.crate <= 0 && tile.ice <= 0) return { ok: false, state, steps: [] };
  const next = cloneState(state);
  const steps = [];
  resolveBoard(next, steps, { preset: [{ r, c }] });
  finishTurn(next, steps);
  return { ok: true, state: next, steps };
}

export function applyStripeBooster(state, r, c) {
  if (!inBounds(state, r, c)) return { ok: false, state, steps: [] };
  const tile = state.grid[r][c];
  if (!canSwapCell(tile) || tile.piece.t !== "F") return { ok: false, state, steps: [] };
  const next = cloneState(state);
  next.grid[r][c].piece = {
    id: ++next.nextId,
    t: "S",
    color: tile.piece.color,
    dir: "h",
  };
  const steps = [
    {
      type: "convert",
      cells: [{ r, c, piece: { ...next.grid[r][c].piece } }],
      ...snap(next),
    },
    { type: "status", ...snap(next) },
  ];
  return { ok: true, state: next, steps };
}

export function applyShuffleBooster(state) {
  const next = cloneState(state);
  const steps = [];
  ensurePlayable(next, steps);
  if (!steps.length) {
    reshufflePieces(next);
    repair(next);
    steps.push({ type: "shuffle", ...snap(next), popup: "shuffle" });
  }
  if (hasAnyMatch(next.grid)) resolveBoard(next, steps, {});
  finishTurn(next, steps);
  return { ok: true, state: next, steps };
}

export function grantMoves(state, n = 5) {
  const next = cloneState(state);
  next.moves += n;
  next.status = "playing";
  const steps = [];
  if (listValidMoves(next).length === 0) ensurePlayable(next, steps);
  if (hasAnyMatch(next.grid)) resolveBoard(next, steps, {});
  steps.push({ type: "status", ...snap(next) });
  return { ok: true, state: next, steps };
}

function repair(state) {
  for (let n = 0; n < 48; n++) {
    const groups = findGroups(state.grid);
    if (!groups.length) return true;
    for (const group of groups) {
      const pos = group.cells[0];
      const tile = state.grid[pos.r][pos.c];
      if (!tile.piece || tile.piece.color == null) continue;
      const bad = tile.piece.color;
      let next = (bad + 1) % state.colors;
      if (state.colors > 1) {
        next = (bad + 1 + Math.floor(nextRand(state) * (state.colors - 1))) % state.colors;
        if (next === bad) next = (bad + 1) % state.colors;
      }
      tile.piece.color = next;
    }
  }
  return !hasAnyMatch(state.grid);
}

function maskChar(def, r, c) {
  if (!def.mask) return ".";
  return def.mask[r][c] || ".";
}

function generate(def, seed) {
  const rows = def.rows;
  const cols = def.cols;
  const state = {
    rows,
    cols,
    grid: [],
    score: 0,
    moves: def.moves,
    goals: def.goals.map((g) => ({ ...g, current: 0 })),
    stars: def.stars.slice(),
    colors: def.colors,
    seed,
    nextId: 1,
    status: "playing",
    levelId: def.id,
    multiplier: 1,
  };
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const ch = maskChar(def, r, c);
      if (ch === "#") {
        row.push(hole());
        continue;
      }
      if (ch === "c" || ch === "C") {
        row.push(crate(ch === "C" ? 2 : 1));
        continue;
      }
      const tile = cell(null);
      if (ch === "i") tile.ice = 1;
      if (ch === "I") tile.ice = 2;
      if (ch === "l") tile.lock = 1;
      if (ch === "m") {
        tile.ice = 1;
        tile.lock = 1;
      }
      if (ch === "n") {
        tile.piece = { id: ++state.nextId, t: "I", color: null, dir: null };
      } else {
        const bad = new Set();
        if (c >= 2) {
          const a = matchColor(row[c - 1]);
          const b = matchColor(row[c - 2]);
          if (a !== null && a === b) bad.add(a);
        }
        if (r >= 2) {
          const a = matchColor(state.grid[r - 1][c]);
          const b = matchColor(state.grid[r - 2][c]);
          if (a !== null && a === b) bad.add(a);
        }
        const options = [];
        for (let color = 0; color < state.colors; color++) if (!bad.has(color)) options.push(color);
        const color = (options.length ? options : [0])[Math.floor(nextRand(state) * (options.length || 1))];
        tile.piece = { id: ++state.nextId, t: "F", color, dir: null };
      }
      row.push(tile);
    }
    state.grid.push(row);
  }
  for (const extra of def.extras || []) {
    if (!inBounds(state, extra.r, extra.c)) continue;
    const tile = state.grid[extra.r][extra.c];
    if (tile.hole || tile.crate > 0) continue;
    tile.piece = {
      id: ++state.nextId,
      t: extra.t,
      color: extra.t === "C" ? null : (extra.color ?? 0),
      dir: extra.dir ?? null,
    };
    tile.lock = 0;
  }
  repair(state);
  return state;
}

function structureOk(state, def) {
  let ice = 0;
  let nectar = 0;
  for (const row of state.grid) {
    for (const tile of row) {
      ice += tile.ice;
      if (tile.piece && tile.piece.t === "I") nectar++;
    }
  }
  for (const goal of def.goals) {
    if (goal.type === "ice" && ice < goal.target) return false;
    if (goal.type === "ingredient" && nectar < goal.target) return false;
    if (goal.type === "collect" && (goal.color < 0 || goal.color >= def.colors)) return false;
  }
  return true;
}

export function startLevel(def) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const seed = (def.seed + attempt * 97) >>> 0;
    const state = generate(def, seed);
    if (hasAnyMatch(state.grid)) continue;
    if (!structureOk(state, def)) continue;
    if (listValidMoves(state).length === 0) continue;
    return state;
  }
  const state = generate(def, def.seed >>> 0);
  const steps = [];
  ensurePlayable(state, steps);
  repair(state);
  if (hasAnyMatch(state.grid) || listValidMoves(state).length === 0) {
    paintForcedMove(state);
    repair(state);
  }
  return state;
}

export function countIce(state) {
  let n = 0;
  for (const row of state.grid) for (const tile of row) n += tile.ice;
  return n;
}

export function countNectar(state) {
  let n = 0;
  for (const row of state.grid) for (const tile of row) if (tile.piece?.t === "I") n++;
  return n;
}
