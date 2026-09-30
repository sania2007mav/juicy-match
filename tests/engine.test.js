import test from "node:test";
import assert from "node:assert/strict";
import {
  applyHammer,
  applyShuffleBooster,
  cell,
  cloneState,
  colorBomb,
  countIce,
  countNectar,
  crate,
  findGroups,
  fruit,
  goalsMet,
  grantMoves,
  hasAnyMatch,
  hole,
  listValidMoves,
  makeState,
  nectar,
  resolveSwap,
  startLevel,
  striped,
  wrapped,
} from "../js/engine.js";
import { LEVELS } from "../js/levels.js";

function F(color, id, extra) {
  return cell(fruit(color, id), extra);
}

test("horizontal match of 3 scores, spends a move, and refills", () => {
  const grid = [
    [F(0, 1), F(0, 2), F(1, 3), F(2, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(3, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(1, 12)],
    [F(3, 13), F(1, 14), F(2, 15), F(0, 16)],
  ];
  const state = makeState(grid, { moves: 5, colors: 4, goals: [{ type: "score", target: 100000 }] });
  const before = cloneState(state);
  const res = resolveSwap(state, 1, 2, 0, 2);
  assert.equal(res.ok, true);
  assert.equal(res.state.moves, 4);
  assert.ok(res.state.score >= 120);
  assert.equal(before.score, 0);
  assert.equal(state.moves, 5);
  const burst = res.steps.find((s) => s.type === "burst");
  assert.ok(burst.removed.some((p) => p.id === 1));
  assert.ok(burst.removed.some((p) => p.id === 2));
  assert.ok(burst.removed.some((p) => p.id === 7));
  assert.equal(res.state.grid.length, 4);
  assert.ok(res.state.grid.every((row) => row.every((tile) => tile.piece)));
});

test("vertical match is detected", () => {
  const grid = [
    [F(0, 1), F(1, 2), F(2, 3)],
    [F(0, 4), F(2, 5), F(1, 6)],
    [F(1, 7), F(0, 8), F(2, 9)],
    [F(3, 10), F(1, 11), F(3, 12)],
  ];
  const res = resolveSwap(gridState(grid), 2, 0, 2, 1);
  assert.equal(res.ok, true);
  const burst = res.steps.find((s) => s.type === "burst");
  assert.ok(burst.removed.some((p) => p.id === 1));
  assert.ok(burst.removed.some((p) => p.id === 4));
  assert.ok(burst.removed.some((p) => p.id === 8));
});

test("invalid swap animates back and does not spend a move", () => {
  const grid = [
    [F(0, 1), F(1, 2), F(2, 3)],
    [F(3, 4), F(0, 5), F(1, 6)],
    [F(2, 7), F(3, 8), F(0, 9)],
  ];
  const state = gridState(grid);
  const res = resolveSwap(state, 0, 0, 0, 1);
  assert.equal(res.ok, false);
  assert.equal(res.state.moves, state.moves);
  assert.equal(res.state.score, 0);
  assert.equal(res.state.grid[0][0].piece.id, 1);
  assert.equal(res.state.grid[0][1].piece.id, 2);
  assert.ok(res.steps.some((s) => s.type === "swap"));
  assert.ok(res.steps.some((s) => s.type === "swapback"));
});

test("four in a row becomes a striped fruit matching swipe direction", () => {
  const grid = [
    [F(0, 1), F(0, 2), F(1, 3), F(0, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(2, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(1, 12)],
  ];
  const vertical = resolveSwap(gridState(grid), 1, 2, 0, 2);
  const madeV = vertical.steps.find((s) => s.spawnedSpecials?.length);
  assert.equal(madeV.spawnedSpecials[0].t, "S");
  assert.equal(madeV.spawnedSpecials[0].dir, "v");
  assert.equal(madeV.spawnedSpecials[0].r, 0);
  assert.equal(madeV.spawnedSpecials[0].c, 2);

  const gridH = [
    [F(1, 1), F(0, 2), F(2, 3), F(3, 4)],
    [F(2, 5), F(0, 6), F(3, 7), F(1, 8)],
    [F(0, 9), F(1, 10), F(2, 11), F(3, 12)],
    [F(3, 13), F(0, 14), F(1, 15), F(2, 16)],
  ];
  const horizontal = resolveSwap(gridState(gridH), 2, 0, 2, 1);
  const madeH = horizontal.steps.find((s) => s.spawnedSpecials?.length);
  assert.equal(madeH.spawnedSpecials[0].t, "S");
  assert.equal(madeH.spawnedSpecials[0].dir, "h");
});

test("five in a row becomes a color bomb", () => {
  const grid = [
    [F(0, 1), F(0, 2), F(1, 3), F(0, 4), F(0, 5)],
    [F(2, 6), F(3, 7), F(0, 8), F(2, 9), F(3, 10)],
    [F(1, 11), F(2, 12), F(3, 13), F(1, 14), F(2, 15)],
  ];
  const res = resolveSwap(gridState(grid), 1, 2, 0, 2);
  const made = res.steps.find((s) => s.spawnedSpecials?.length);
  assert.equal(made.spawnedSpecials[0].t, "C");
});

test("L and T shapes become wrapped bombs", () => {
  const lGrid = [
    [F(0, 1), F(0, 2), F(1, 3), F(0, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(3, 9), F(2, 10), F(0, 11), F(2, 12)],
    [F(1, 13), F(3, 14), F(2, 15), F(3, 16)],
  ];
  const lRes = resolveSwap(gridState(lGrid), 0, 3, 0, 2);
  const lMade = lRes.steps.find((s) => s.spawnedSpecials?.length);
  assert.equal(lMade.spawnedSpecials[0].t, "W");
  assert.equal(lMade.spawnedSpecials[0].r, 0);
  assert.equal(lMade.spawnedSpecials[0].c, 2);

  const tGrid = [
    [F(0, 1), F(0, 2), F(1, 3), F(0, 4), F(0, 5)],
    [F(2, 6), F(3, 7), F(0, 8), F(1, 9), F(2, 10)],
    [F(3, 11), F(2, 12), F(0, 13), F(3, 14), F(1, 15)],
    [F(1, 16), F(3, 17), F(2, 18), F(1, 19), F(3, 20)],
  ];
  const tRes = resolveSwap(gridState(tGrid), 0, 2, 0, 3);
  const tMade = tRes.steps.find((s) => s.spawnedSpecials?.length);
  assert.equal(tMade.spawnedSpecials[0].t, "W");
  assert.equal(tMade.spawnedSpecials[0].r, 0);
  assert.equal(tMade.spawnedSpecials[0].c, 2);
});

test("striped plus striped clears both rows and columns", () => {
  const grid = plain(6, 6);
  grid[2][2] = cell(striped(0, "h", 101));
  grid[2][3] = cell(striped(1, "v", 102));
  const res = resolveSwap(gridState(grid), 2, 2, 2, 3);
  assert.equal(res.ok, true);
  const burst = res.steps.find((s) => s.type === "burst");
  const gone = new Set(burst.removed.map((p) => key(p.r, p.c)));
  for (let c = 0; c < 6; c++) assert.ok(gone.has(key(2, c)) || gone.has(key(2, c)));
  for (let r = 0; r < 6; r++) {
    assert.ok(gone.has(key(r, 2)) || gone.has(key(r, 3)));
  }
  assert.ok(gone.has(key(0, 2)));
  assert.ok(gone.has(key(5, 3)));
  assert.ok(gone.has(key(2, 0)));
  assert.ok(gone.has(key(2, 5)));
});

test("striped plus wrapped clears three rows and three columns", () => {
  const grid = plain(7, 7);
  grid[3][3] = cell(wrapped(1, 202));
  grid[3][4] = cell(striped(0, "h", 201));
  const res = resolveSwap(gridState(grid), 3, 3, 3, 4);
  const burst = res.steps.find((s) => s.type === "burst");
  const gone = new Set(burst.removed.map((p) => key(p.r, p.c)));
  for (const r of [2, 3, 4]) {
    for (let c = 0; c < 7; c++) assert.ok(gone.has(key(r, c)), `row ${r} col ${c}`);
  }
  for (const c of [3, 4, 5]) {
    for (let r = 0; r < 7; r++) assert.ok(gone.has(key(r, c)), `col ${c} row ${r}`);
  }
});

test("wrapped plus wrapped clears a 5x5 twice", () => {
  const grid = plain(7, 7);
  grid[3][3] = cell(wrapped(0, 301));
  grid[3][4] = cell(wrapped(1, 302));
  const res = resolveSwap(gridState(grid), 3, 3, 3, 4);
  const bursts = res.steps.filter((s) => s.type === "burst");
  assert.ok(bursts.length >= 2);
  const first = new Set(bursts[0].removed.map((p) => key(p.r, p.c)));
  for (let r = 1; r <= 5; r++) {
    for (let c = 2; c <= 6; c++) assert.ok(first.has(key(r, c)));
  }
  assert.ok(bursts[1].removed.length > 0);
});

test("a wrapped bomb blasts 3x3 and blasts again after the fall", () => {
  const grid = plain(5, 5);
  grid[2][2] = cell(wrapped(0, 401));
  const res = resolveSwap(gridState(grid), 2, 2, 2, 3);
  const bursts = res.steps.filter((s) => s.type === "burst");
  assert.ok(bursts.length >= 2);
  assert.ok(bursts[0].blasts.some((b) => b.kind === "area"));
  assert.ok(bursts[1].removed.length > 0);
});

test("color bomb plus fruit clears that color", () => {
  const grid = plain(5, 5);
  const reds = [];
  for (let r = 0; r < 5; r++) {
    grid[r][0] = F(0, 500 + r);
    reds.push(500 + r);
  }
  grid[2][1] = cell(colorBomb(590));
  const res = resolveSwap(gridState(grid), 2, 0, 2, 1);
  const burst = res.steps.find((s) => s.type === "burst");
  const gone = new Set(burst.removed.map((p) => p.id));
  for (const id of reds) assert.ok(gone.has(id), `red ${id}`);
  assert.ok(gone.has(590));
});

test("color bomb plus striped clears beyond the chosen color", () => {
  const grid = plain(5, 5);
  let reds = 0;
  for (let r = 0; r < 5; r++) {
    grid[r][1] = F(1, 600 + r);
    reds++;
  }
  grid[2][2] = cell(striped(1, "h", 610));
  grid[2][3] = cell(colorBomb(611));
  const res = resolveSwap(gridState(grid), 2, 3, 2, 2);
  const removed = res.steps.filter((s) => s.type === "burst").reduce((n, s) => n + s.removed.length, 0);
  assert.ok(removed > reds + 1);
});

test("color bomb plus wrapped detonates that color as bombs", () => {
  const grid = plain(6, 6);
  grid[1][1] = F(2, 701);
  grid[1][4] = F(2, 702);
  grid[4][1] = F(2, 703);
  grid[3][3] = cell(wrapped(2, 710));
  grid[3][4] = cell(colorBomb(711));
  const res = resolveSwap(gridState(grid), 3, 4, 3, 3);
  assert.equal(res.ok, true);
  const bursts = res.steps.filter((s) => s.type === "burst");
  assert.ok(bursts.length >= 2);
  assert.ok(res.steps.some((s) => s.type === "convert"));
  assert.ok(bursts[0].removed.length >= 3);
});

test("two color bombs clear the board and drop nectar instead of erasing it", () => {
  const grid = plain(4, 4);
  grid[0][0] = cell(nectar(801));
  grid[1][1] = cell(colorBomb(802));
  grid[1][2] = cell(colorBomb(803));
  const res = resolveSwap(gridState(grid, { goals: [{ type: "ingredient", target: 1 }] }), 1, 1, 1, 2);
  assert.equal(res.ok, true);
  const first = res.steps.find((s) => s.type === "burst");
  assert.ok(first.removed.length >= 10);
  assert.equal(first.removed.some((p) => p.id === 801), false);
  assert.equal(res.state.goals.find((g) => g.type === "ingredient").current, 1);
});

test("cascades fall with gravity and raise the combo multiplier", () => {
  const grid = [
    [F(0, 1), F(1, 2), F(2, 3), F(3, 4)],
    [F(0, 5), F(2, 6), F(3, 7), F(1, 8)],
    [F(1, 9), F(1, 10), F(2, 11), F(0, 12)],
    [F(0, 13), F(3, 14), F(1, 15), F(2, 16)],
  ];
  const res = resolveSwap(gridState(grid), 2, 2, 3, 2);
  assert.equal(res.ok, true);
  const bursts = res.steps.filter((s) => s.type === "burst");
  assert.ok(bursts.length >= 2);
  assert.equal(bursts[1].multiplier, 2);
  assert.equal(bursts[1].popup, "juicy");
  assert.ok(res.state.score > bursts[0].score);
});

test("gravity falls through holes and stops on crates", () => {
  const holes = [
    [F(0, 1)],
    [hole()],
    [F(1, 2)],
    [F(2, 3)],
  ];
  const through = applyHammer(gridState(holes, { colors: 4 }), 3, 0);
  const throughFall = through.steps.find((s) => s.type === "fall");
  assert.ok(Array.isArray(throughFall.drops));
  assert.equal(typeof throughFall.moves, "number");
  assert.equal(throughFall.grid[2][0].piece.id, 1);
  assert.equal(throughFall.grid[3][0].piece.id, 2);

  const blocked = [
    [F(0, 1)],
    [crate(1)],
    [F(1, 2)],
  ];
  const stopped = applyHammer(gridState(blocked, { colors: 4 }), 2, 0);
  const stoppedFall = stopped.steps.find((s) => s.type === "fall");
  assert.equal(stoppedFall.grid[0][0].piece.id, 1);
  assert.equal(stoppedFall.grid[2][0].piece, null);
});

test("ice, crates, and locks", () => {
  const iced = [
    [F(0, 1, { ice: 2 }), F(0, 2, { ice: 2 }), F(1, 3, { ice: 2 }), F(3, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12)],
  ];
  const iceState = gridState(iced, { goals: [{ type: "ice", target: 3 }] });
  const iceRes = resolveSwap(iceState, 1, 2, 0, 2);
  const iceGoal = iceRes.state.goals.find((g) => g.type === "ice");
  assert.ok(iceGoal.current >= 3);
  assert.equal(iceRes.steps.find((s) => s.type === "burst").grid[0][0].ice, 1);

  const crates = [
    [F(0, 1), F(0, 2), F(1, 3), crate(1), F(2, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8), crate(1)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12), F(3, 13)],
  ];
  const crateRes = resolveSwap(gridState(crates), 1, 2, 0, 2);
  const crateMid = crateRes.steps.find((s) => s.type === "burst").grid;
  assert.equal(crateMid[0][3].crate, 0);
  assert.equal(crateMid[1][4].crate, 1);

  const locked = [[F(3, 1, { lock: 1 }), F(0, 2), F(1, 3)]];
  const denied = resolveSwap(gridState(locked), 0, 0, 0, 1);
  assert.equal(denied.ok, false);

  const unlock = [
    [F(0, 1), F(0, 2), F(1, 3), F(2, 4, { lock: 1 })],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12)],
  ];
  const opened = resolveSwap(gridState(unlock), 1, 2, 0, 2);
  const openedMid = opened.steps.find((s) => s.type === "burst").grid;
  assert.equal(openedMid[0][3].lock, 0);
  assert.ok(openedMid[0][3].piece);
});

test("collect goals and nectar dropping to the bottom", () => {
  const grid = [
    [F(0, 1), F(0, 2), F(1, 3), F(2, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12)],
  ];
  const res = resolveSwap(gridState(grid, { goals: [{ type: "collect", color: 0, target: 2 }] }), 1, 2, 0, 2);
  const goal = res.state.goals.find((g) => g.type === "collect");
  assert.ok(goal.current >= 3);

  const drop = [
    [F(1, 1), F(2, 2)],
    [F(2, 3), F(3, 4)],
    [cell(nectar(50)), F(0, 5)],
    [F(3, 6), F(1, 7)],
  ];
  const dropped = applyHammer(gridState(drop, { goals: [{ type: "ingredient", target: 1 }], colors: 4 }), 3, 0);
  assert.equal(dropped.state.goals[0].current, 1);
  assert.ok(!dropped.state.grid.some((row) => row.some((tile) => tile.piece?.t === "I")));
});

test("end of level turns leftover moves into a bonus, otherwise a loss", () => {
  const winGrid = [
    [F(0, 1), F(0, 2), F(1, 3), F(2, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12)],
  ];
  const won = resolveSwap(
    gridState(winGrid, { moves: 3, goals: [{ type: "score", target: 1 }], stars: [1, 5000, 9000] }),
    1,
    2,
    0,
    2,
  );
  assert.equal(won.state.status, "won");
  assert.equal(won.state.moves, 0);
  assert.ok(won.steps.some((s) => s.type === "bonus"));
  assert.ok(won.state.score > 200);

  const loseGrid = [
    [F(0, 1), F(0, 2), F(1, 3), F(2, 4)],
    [F(2, 5), F(3, 6), F(0, 7), F(1, 8)],
    [F(1, 9), F(2, 10), F(3, 11), F(0, 12)],
  ];
  const lost = resolveSwap(
    gridState(loseGrid, { moves: 1, goals: [{ type: "ice", target: 50 }] }),
    1,
    2,
    0,
    2,
  );
  assert.equal(lost.state.status, "lost");
  assert.equal(goalsMet(lost.state), false);
  const extra = grantMoves(lost.state, 5);
  assert.equal(extra.state.status, "playing");
  assert.ok(extra.state.moves >= 5);
});

test("shuffle booster leaves a board with a legal move", () => {
  const grid = plain(5, 5);
  const res = applyShuffleBooster(gridState(grid));
  assert.equal(res.ok, true);
  assert.ok(res.steps.some((s) => s.type === "shuffle" || s.type === "status"));
  if (res.state.status === "playing") assert.ok(listValidMoves(res.state).length > 0);
});

test("campaign has 42 solvable-at-start levels", () => {
  assert.ok(LEVELS.length >= 40);
  assert.equal(LEVELS.length, 42);
  for (const def of LEVELS) {
    assert.ok(def.rows === 8 || def.rows === 9);
    assert.equal(def.cols, def.rows);
    assert.ok(def.moves >= 15);
    assert.equal(def.stars.length, 3);
    assert.ok(def.stars[0] < def.stars[1] && def.stars[1] < def.stars[2]);
    if (def.mask) {
      assert.equal(def.mask.length, def.rows);
      for (const line of def.mask) assert.equal(line.length, def.cols);
    }
    const state = startLevel(def);
    assert.equal(hasAnyMatch(state.grid), false, `level ${def.id} starts with a match`);
    assert.ok(listValidMoves(state).length > 0, `level ${def.id} has no move`);
    assert.equal(countIce(state) >= iceTarget(def), true, `level ${def.id} ice`);
    assert.equal(countNectar(state) >= nectarTarget(def), true, `level ${def.id} nectar`);
    for (const goal of def.goals) {
      if (goal.type === "collect") assert.ok(goal.color < def.colors);
    }
  }
});

test("a greedy line of legal moves clears level 1", () => {
  let state = startLevel(LEVELS[0]);
  let guard = 0;
  while (state.status === "playing" && guard++ < 30) {
    const [move] = listValidMoves(state);
    assert.ok(move, "ran out of moves before the goal");
    const res = resolveSwap(state, move.r1, move.c1, move.r2, move.c2);
    assert.equal(res.ok, true);
    state = res.state;
  }
  assert.equal(state.status, "won");
});

function gridState(grid, extra = {}) {
  return makeState(grid, { moves: 8, colors: 6, goals: [{ type: "score", target: 999999 }], ...extra });
}

function plain(rows, cols) {
  const grid = [];
  let id = 1;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(F((r * 2 + c * 3) % 6, id++));
    grid.push(row);
  }
  return grid;
}

function key(r, c) {
  return r + "," + c;
}

function iceTarget(def) {
  return def.goals.filter((g) => g.type === "ice").reduce((n, g) => n + g.target, 0);
}

function nectarTarget(def) {
  return def.goals.filter((g) => g.type === "ingredient").reduce((n, g) => n + g.target, 0);
}
