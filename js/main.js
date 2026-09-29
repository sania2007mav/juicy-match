import { LEVELS } from "./levels.js";
import {
  applyHammer,
  applyShuffleBooster,
  applyStripeBooster,
  grantMoves,
  listValidMoves,
  resolveSwap,
  starCount,
  startLevel,
} from "./engine.js";
import { goalText, getLang, levelName, setLang, t } from "./i18n.js";
import { AudioBus } from "./audio.js";
import { BoardView } from "./render.js";

const SAVE_KEY = "sochny-ryad-v1";
const BOOST_ORDER = ["hammer", "shuffle", "stripe"];

const audio = new AudioBus();
const canvas = document.querySelector("#board");
const view = new BoardView(canvas);
const fx = document.querySelector("#fx");

const game = {
  save: loadSave(),
  state: null,
  level: null,
  mode: "map",
  busy: false,
  booster: null,
  selected: null,
  pointer: null,
  extraUsed: false,
  idleTimer: 0,
};

view.onPopup = (code) => {
  splash(t(`pop.${code}`));
  if (code === "wow" || code === "tasty") audio.combo();
  else if (code === "shuffle") audio.drop();
  else audio.match();
  buzz(code === "wow" ? [16, 30, 16] : 12);
};
view.onStep = (step) => {
  if (step.score != null) paintHud(step);
  if (step.type === "burst") {
    const special = (step.blasts || []).length > 0 || (step.spawnedSpecials || []).length > 0;
    if (special) audio.special();
    else audio.match();
    if ((step.removed || []).length >= 8) buzz(14);
  } else if (step.type === "fall" && step.collected?.length) audio.drop();
  else if (step.type === "bonus" || step.type === "convert") audio.special();
};

function loadSave() {
  const fresh = {
    lang: "ru",
    mute: false,
    unlocked: 1,
    best: {},
    boosters: { hammer: 0, shuffle: 0, stripe: 0 },
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    return { ...fresh, ...JSON.parse(raw), boosters: { ...fresh.boosters, ...(JSON.parse(raw).boosters || {}) } };
  } catch {
    return fresh;
  }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.save));
  } catch {
    /* private mode */
  }
}

function totalStars() {
  return Object.values(game.save.best).reduce((sum, entry) => sum + (entry.stars || 0), 0);
}

function applyLanguage() {
  setLang(game.save.lang || "ru");
  document.documentElement.lang = getLang() === "en" ? "en" : getLang() === "kk" ? "kk" : "ru";
  document.title = t("title");
  paintChrome();
  if (game.mode === "map") renderMap();
  if (game.state && game.mode === "play") paintHud(game.state);
}

function paintChrome() {
  document.querySelector("#title").textContent = t("title");
  document.querySelector("#tagline").textContent = t("tagline");
  document.querySelector("#map-note").textContent = t("mapNote");
  document.querySelector("#btn-help").setAttribute("aria-label", t("help"));
  document.querySelector("#btn-mute").setAttribute("aria-label", t("sound"));
  document.querySelector("#btn-mute").textContent = game.save.mute ? "🔇" : "🔊";
  document.querySelector("#btn-back").setAttribute("aria-label", t("back"));
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("on", button.dataset.lang === getLang());
  });
  const wallet = document.querySelector("#wallet");
  wallet.textContent = `${t("stars")}: ${totalStars()}  ·  ${t("hammer")} ${game.save.boosters.hammer}  ·  ${t("shuffle")} ${game.save.boosters.shuffle}  ·  ${t("stripe")} ${game.save.boosters.stripe}`;
}

function renderMap() {
  const scroll = document.querySelector("#map-scroll");
  const path = document.querySelector("#map-path");
  const count = LEVELS.length;
  const gap = 104;
  const height = 150 + (count - 1) * gap + 140;
  path.style.height = `${height}px`;
  const points = LEVELS.map((level, index) => ({
    id: level.id,
    x: 50 + Math.sin(index * 0.82) * 24,
    y: 70 + (count - 1 - index) * gap,
  }));
  const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  path.innerHTML = `
    <svg class="vine" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" />
    </svg>
  `;
  for (const point of points) {
    const done = game.save.best[point.id];
    const open = point.id <= game.save.unlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `node${open ? "" : " locked"}${point.id === game.save.unlocked ? " current" : ""}`;
    button.style.left = `${point.x}%`;
    button.style.top = `${point.y}px`;
    button.dataset.level = String(point.id);
    button.disabled = !open;
    const stars = done ? "★".repeat(done.stars) + "☆".repeat(3 - done.stars) : open ? "" : "🔒";
    button.innerHTML = `<span class="node-num">${point.id}</span><span class="node-stars">${stars}</span>`;
    button.addEventListener("click", () => openLevel(point.id));
    path.appendChild(button);
  }
  requestAnimationFrame(() => {
    const current = path.querySelector(".current") || path.querySelector('[data-level="1"]');
    current?.scrollIntoView({ block: "center" });
  });
}

function openLevel(id) {
  if (id > game.save.unlocked) return;
  audio.button();
  const def = LEVELS[id - 1];
  game.level = def;
  game.state = startLevel(def);
  game.extraUsed = false;
  game.booster = null;
  game.selected = null;
  game.mode = "intro";
  showScreen("game");
  view.load(game.state.grid);
  view.selected = null;
  view.hint = null;
  view.start();
  paintHud(game.state);
  showIntro();
}

function showScreen(name) {
  document.querySelector("#screen-map").hidden = name !== "map";
  document.querySelector("#screen-game").hidden = name !== "game";
  if (name === "map") view.stop();
}

function showIntro() {
  const goals = game.level.goals.map((goal) => `<li>${goalText(goal)}</li>`).join("");
  const tip = game.level.tip ? `<p class="tip">${t(`tip.${game.level.tip}`)}</p>` : "";
  openModal("intro", `
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <h2>${levelName(game.level.id)}</h2>
    <ul class="goal-list">${goals}</ul>
    <p class="moves-pill">${t("moves")}: ${game.level.moves}</p>
    ${tip}
    <button type="button" class="primary" id="btn-start">${t("start")}</button>
  `);
  document.querySelector("#btn-start").addEventListener("click", () => {
    audio.button();
    closeModal();
    beginPlay();
  });
}

function beginPlay() {
  game.mode = "play";
  game.busy = false;
  paintHud(game.state);
  paintBoosters();
  bumpIdle();
}

function paintHud(snapshot) {
  const score = snapshot.score ?? 0;
  const moves = snapshot.moves ?? 0;
  const goals = snapshot.goals || game.state?.goals || [];
  const stars = game.state?.stars || game.level?.stars || [0, 0, 0];
  document.querySelector("#hud-level").textContent = `${game.level.id}. ${levelName(game.level.id)}`;
  document.querySelector("#hud-score").textContent = String(score);
  document.querySelector("#hud-moves").textContent = String(moves);
  document.querySelector("#score-label").textContent = t("score");
  document.querySelector("#moves-label").textContent = t("moves");
  const goalBox = document.querySelector("#hud-goals");
  goalBox.innerHTML = goals.map((goal) => {
    const pct = Math.max(0, Math.min(1, goal.current / goal.target));
    return `<div class="goal-chip"><span>${goalText(goal)}</span><b>${Math.min(goal.current, goal.target)}/${goal.target}</b><i style="width:${pct * 100}%"></i></div>`;
  }).join("");
  document.querySelector("#hud-stars").innerHTML = [0, 1, 2].map((index) => {
    const on = score >= stars[index] ? " on" : "";
    return `<span class="mini-star${on}">★</span>`;
  }).join("");
  paintBoosters();
}

function paintBoosters() {
  for (const name of BOOST_ORDER) {
    const button = document.querySelector(`[data-booster="${name}"]`);
    const count = game.save.boosters[name] || 0;
    button.querySelector(".b-name").textContent = t(name);
    button.querySelector(".b-count").textContent = String(count);
    button.disabled = count <= 0 || game.mode !== "play";
    button.classList.toggle("armed", game.booster === name);
  }
  const banner = document.querySelector("#banner");
  if (game.booster) {
    banner.hidden = false;
    banner.textContent = `${t("pick")} · ${t(game.booster)}`;
  } else banner.hidden = true;
}

function bumpIdle() {
  clearTimeout(game.idleTimer);
  view.hint = null;
  if (game.mode !== "play") return;
  game.idleTimer = setTimeout(() => {
    if (game.busy || game.mode !== "play" || !game.state) return;
    const [move] = listValidMoves(game.state);
    if (move) view.hint = move;
  }, 5000);
}

async function playResult(result) {
  try {
    await view.play(result.steps);
  } catch (error) {
    console.error(error);
    if (result.state?.grid) view.adopt(result.state.grid, true);
  } finally {
    game.state = result.state;
    paintHud(game.state);
    if (result.state.status === "won") showWin();
    else if (result.state.status === "lost") showLose();
    game.busy = false;
    game.selected = null;
    view.selected = null;
    if (game.mode === "play" && game.state?.status === "playing") bumpIdle();
  }
}

async function userSwap(r1, c1, r2, c2) {
  if (game.busy || game.mode !== "play") return;
  game.busy = true;
  view.hint = null;
  const result = resolveSwap(game.state, r1, c1, r2, c2);
  if (!result.ok) {
    audio.bad();
    await view.play(result.steps);
    game.busy = false;
    bumpIdle();
    return;
  }
  audio.swap();
  await playResult(result);
}

async function useBooster(name, r, c) {
  if (game.busy || game.mode !== "play") return;
  if ((game.save.boosters[name] || 0) <= 0) return;
  game.busy = true;
  let result = null;
  if (name === "hammer") result = applyHammer(game.state, r, c);
  else if (name === "stripe") result = applyStripeBooster(game.state, r, c);
  else result = applyShuffleBooster(game.state);
  if (!result?.ok) {
    audio.bad();
    game.busy = false;
    return;
  }
  game.save.boosters[name] -= 1;
  persist();
  game.booster = null;
  audio.special();
  await playResult(result);
}

function onPointerDown(event) {
  if (game.mode !== "play" || game.busy) return;
  audio.unlock();
  canvas.setPointerCapture?.(event.pointerId);
  const cell = view.clientToCell(event.clientX, event.clientY);
  game.pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    cell,
    dragged: false,
  };
}

function onPointerMove(event) {
  const pointer = game.pointer;
  if (!pointer || pointer.id !== event.pointerId || pointer.dragged || !pointer.cell) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (Math.hypot(dx, dy) < 16) return;
  pointer.dragged = true;
  if (game.booster) return;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const r2 = pointer.cell.r + (horizontal ? 0 : dy > 0 ? 1 : -1);
  const c2 = pointer.cell.c + (horizontal ? (dx > 0 ? 1 : -1) : 0);
  void userSwap(pointer.cell.r, pointer.cell.c, r2, c2);
}

function onPointerUp(event) {
  const pointer = game.pointer;
  if (!pointer || pointer.id !== event.pointerId) return;
  game.pointer = null;
  if (pointer.dragged || !pointer.cell) return;
  const cell = pointer.cell;
  const tile = game.state.grid[cell.r]?.[cell.c];
  if (!tile || tile.hole) return;
  if (game.booster === "shuffle") return;
  if (game.booster === "hammer" || game.booster === "stripe") {
    void useBooster(game.booster, cell.r, cell.c);
    return;
  }
  if (!game.selected) {
    game.selected = cell;
    view.selected = cell;
    bumpIdle();
    return;
  }
  const selected = game.selected;
  if (selected.r === cell.r && selected.c === cell.c) {
    game.selected = null;
    view.selected = null;
    return;
  }
  const adjacent = Math.abs(selected.r - cell.r) + Math.abs(selected.c - cell.c) === 1;
  game.selected = null;
  view.selected = null;
  if (adjacent) void userSwap(selected.r, selected.c, cell.r, cell.c);
  else {
    game.selected = cell;
    view.selected = cell;
  }
}

function showWin() {
  game.mode = "won";
  audio.win();
  fx.replaceChildren();
  const stars = starCount(game.state);
  const prev = game.save.best[game.level.id]?.stars || 0;
  const rewards = [];
  for (let index = prev; index < stars; index++) {
    const name = BOOST_ORDER[index % BOOST_ORDER.length];
    game.save.boosters[name] += 1;
    rewards.push(t(name));
  }
  const bestScore = Math.max(game.save.best[game.level.id]?.score || 0, game.state.score);
  game.save.best[game.level.id] = { stars: Math.max(prev, stars), score: bestScore };
  if (game.level.id === game.save.unlocked && game.save.unlocked < LEVELS.length) game.save.unlocked += 1;
  persist();
  const starHtml = [0, 1, 2].map((index) => `<span class="big-star${index < stars ? " on" : ""}">★</span>`).join("");
  const reward = rewards.length ? `<p class="reward">${t("reward")}: ${rewards.join(" · ")}</p>` : `<p class="reward muted">${t("noReward")}</p>`;
  const next = game.level.id < LEVELS.length ? `<button type="button" class="primary" id="btn-next">${t("next")}</button>` : "";
  openModal("win", `
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <h2>${t("win")}</h2>
    <div class="star-row">${starHtml}</div>
    <p class="score-line">${t("score")}: <b>${game.state.score}</b></p>
    ${reward}
    <div class="row">
      ${next}
      <button type="button" class="ghost" id="btn-retry">${t("retry")}</button>
      <button type="button" class="ghost" id="btn-map">${t("map")}</button>
    </div>
  `);
  document.querySelector("#btn-next")?.addEventListener("click", () => {
    audio.button();
    closeModal();
    openLevel(game.level.id + 1);
  });
  document.querySelector("#btn-retry").addEventListener("click", () => {
    audio.button();
    closeModal();
    openLevel(game.level.id);
  });
  document.querySelector("#btn-map").addEventListener("click", goMap);
}

function showLose() {
  game.mode = "lost";
  audio.lose();
  fx.replaceChildren();
  const extra = game.extraUsed
    ? ""
    : `<button type="button" class="primary" id="btn-extra">${t("extra")}</button><p class="tip">${t("loseHint")}</p>`;
  openModal("lose", `
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <h2>${t("lose")}</h2>
    <p class="score-line">${t("score")}: <b>${game.state.score}</b></p>
    ${extra}
    <div class="row">
      <button type="button" class="ghost" id="btn-retry">${t("retry")}</button>
      <button type="button" class="ghost" id="btn-map">${t("map")}</button>
    </div>
  `);
  document.querySelector("#btn-extra")?.addEventListener("click", async () => {
    audio.button();
    game.extraUsed = true;
    closeModal();
    game.busy = true;
    const result = grantMoves(game.state, 5);
    game.mode = "play";
    await playResult(result);
  });
  document.querySelector("#btn-retry").addEventListener("click", () => {
    audio.button();
    closeModal();
    openLevel(game.level.id);
  });
  document.querySelector("#btn-map").addEventListener("click", goMap);
}

function goMap() {
  audio.button();
  closeModal();
  game.mode = "map";
  game.state = null;
  showScreen("map");
  applyLanguage();
}

function openModal(kind, html) {
  const modal = document.querySelector("#modal");
  modal.hidden = false;
  modal.dataset.modal = kind;
  document.querySelector("#modal-card").innerHTML = html;
}

function closeModal() {
  const modal = document.querySelector("#modal");
  modal.hidden = true;
  modal.dataset.modal = "";
  document.querySelector("#modal-card").innerHTML = "";
}

function splash(text) {
  if (!text || view.speed >= 12) return;
  const el = document.createElement("div");
  el.className = "splash";
  el.textContent = text;
  fx.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function buzz(pattern) {
  if (game.save.mute || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

function showHelp() {
  audio.button();
  openModal("help", `
    <h2>${t("help")}</h2>
    <p class="tip">${t("helpBody")}</p>
    <button type="button" class="ghost danger" id="btn-reset">${t("reset")}</button>
    <button type="button" class="primary" id="btn-close-help">${t("play")}</button>
  `);
  document.querySelector("#btn-close-help").addEventListener("click", () => {
    audio.button();
    closeModal();
  });
  document.querySelector("#btn-reset").addEventListener("click", () => {
    openModal("reset", `
      <h2>${t("reset")}</h2>
      <p class="tip">${t("resetAsk")}</p>
      <div class="row">
        <button type="button" class="primary" id="btn-reset-yes">${t("yes")}</button>
        <button type="button" class="ghost" id="btn-reset-no">${t("no")}</button>
      </div>
    `);
    document.querySelector("#btn-reset-no").addEventListener("click", () => {
      closeModal();
    });
    document.querySelector("#btn-reset-yes").addEventListener("click", () => {
      game.save = {
        lang: game.save.lang,
        mute: game.save.mute,
        unlocked: 1,
        best: {},
        boosters: { hammer: 0, shuffle: 0, stripe: 0 },
      };
      persist();
      closeModal();
      game.mode = "map";
      showScreen("map");
      applyLanguage();
    });
  });
}

function boot() {
  setLang(game.save.lang || "ru");
  audio.setMuted(!!game.save.mute);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) view.setSpeed(3);
  applyLanguage();
  showScreen("map");
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      audio.unlock();
      audio.button();
      game.save.lang = button.dataset.lang;
      persist();
      applyLanguage();
    });
  });
  document.querySelector("#btn-mute").addEventListener("click", () => {
    audio.unlock();
    game.save.mute = !game.save.mute;
    audio.setMuted(game.save.mute);
    persist();
    paintChrome();
    audio.button();
  });
  document.querySelector("#btn-help").addEventListener("click", () => {
    audio.unlock();
    showHelp();
  });
  document.querySelector("#btn-back").addEventListener("click", () => {
    if (game.mode === "intro") {
      goMap();
      return;
    }
    goMap();
  });
  document.querySelectorAll("[data-booster]").forEach((button) => {
    button.addEventListener("click", () => {
      audio.unlock();
      audio.button();
      if (game.mode !== "play" || game.busy) return;
      const name = button.dataset.booster;
      if ((game.save.boosters[name] || 0) <= 0) return;
      if (name === "shuffle") {
        game.booster = null;
        void useBooster("shuffle");
        return;
      }
      game.booster = game.booster === name ? null : name;
      game.selected = null;
      view.selected = null;
      paintBoosters();
    });
  });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", () => view.resize());
  window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
  if ("serviceWorker" in navigator && !location.search.includes("nosw=1")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  window.__SOCHNY__ = {
    getStatus: () => game.state?.status ?? "map",
    isIdle: () => !game.busy && game.mode === "play",
    getHint: () => (game.state ? listValidMoves(game.state)[0] || null : null),
    cellCenter: (r, c) => view.cellToClient(r, c),
    setFast: (value) => view.setSpeed(value ? 16 : 1),
  };
}

boot();
