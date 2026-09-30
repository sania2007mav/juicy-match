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
import { propMarkup, renderWorld, zoneOf } from "./mapscape.js";

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
  document.querySelector("#btn-mute").classList.toggle("is-muted", !!game.save.mute);
  document.querySelector("#btn-back").setAttribute("aria-label", t("back"));
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("on", button.dataset.lang === getLang());
  });
  const wallet = document.querySelector("#wallet");
  const boosters = game.save.boosters;
  wallet.innerHTML = [
    ["★", totalStars()],
    [t("hammer"), boosters.hammer],
    [t("shuffle"), boosters.shuffle],
    [t("stripe"), boosters.stripe],
  ].map(([label, count]) => `<span class="chip">${label} <b>${count}</b></span>`).join("");
}

function renderMap() {
  const path = document.querySelector("#map-path");
  renderWorld(path, {
    levels: LEVELS,
    unlocked: game.save.unlocked,
    best: game.save.best,
    zoneName: (id) => t(`zone.${id}`),
    onOpen: (id) => openLevel(id),
  });
  requestAnimationFrame(() => focusCurrentLevel());
}

function focusCurrentLevel() {
  const scroll = document.querySelector("#map-scroll");
  const node = document.querySelector("#map-path .node.current") || document.querySelector('#map-path [data-level="1"]');
  if (!scroll || !node) return;
  const nodeTop = node.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  const target = nodeTop - scroll.clientHeight * 0.62;
  const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  scroll.scrollTop = Math.max(0, Math.min(max, target));
}

const SCENERY = {
  orchard: {
    hill: ["#8ed85f", "#3eaf4e"],
    props: [["bush", "7%", "58px"], ["fence", "30%", "104px"], ["flower", "48%", "112px"], ["flower", "66%", "104px"], ["bush", "93%", "58px"]],
  },
  berry: {
    hill: ["#67c56e", "#2f8a48"],
    props: [["bush", "6%", "58px"], ["mushroom", "28%", "108px"], ["flower", "50%", "112px"], ["flower", "68%", "104px"], ["bush", "94%", "58px"]],
  },
  citrus: {
    hill: ["#ffe08a", "#f0c36a"],
    props: [["umbrella", "8%", "62px"], ["flower", "32%", "108px"], ["flower", "52%", "112px"], ["tree", "90%", "64px"]],
  },
  island: {
    hill: ["#5dce78", "#1497b8"],
    props: [["palm", "6%", "64px"], ["flower", "34%", "108px"], ["bush", "58%", "100px"], ["palm", "92%", "64px"]],
  },
  festival: {
    hill: ["#ffe08a", "#ffb703"],
    props: [["lantern", "10%", "70px"], ["flag", "32%", "108px"], ["flower", "54%", "112px"], ["flag", "88%", "70px"]],
  },
};

function hillMarkup(top, bottom) {
  return `<svg class="hill" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 46 C80 16 150 64 220 38 C290 14 350 52 400 26 V120 H0 Z" fill="${top}"/>
    <path d="M0 74 C100 54 190 90 280 66 C340 50 370 72 400 58 V120 H0 Z" fill="${bottom}"/>
  </svg>`;
}

function cloudMarkup(left, top) {
  return `<svg class="sky-cloud" style="left:${left};top:${top}" viewBox="0 0 120 48" aria-hidden="true">
    <circle cx="30" cy="30" r="16" fill="#fff"/>
    <circle cx="54" cy="20" r="18" fill="#fff"/>
    <circle cx="80" cy="28" r="14" fill="#fff"/>
    <rect x="24" y="28" width="68" height="14" rx="7" fill="#fff"/>
  </svg>`;
}

function paintScenery(zone) {
  const spec = SCENERY[zone] || SCENERY.orchard;
  document.querySelector("#play-ground").innerHTML = hillMarkup(...spec.hill) + spec.props.map(([kind, left, bottom]) =>
    `<span class="ground-prop" style="left:${left};bottom:${bottom}">${propMarkup(kind)}</span>`
  ).join("");
  document.querySelector("#play-sky").innerHTML = cloudMarkup("8%", "8px") + cloudMarkup("62%", "28px");
}

function applyZone(levelId) {
  const zone = zoneOf(levelId);
  document.querySelector("#screen-game").dataset.zone = zone;
  document.querySelector("#app").dataset.zone = zone;
  paintScenery(zone);
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
  applyZone(def.id);
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

const ICO = {
  play: `<svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg>`,
  next: `<svg viewBox="0 0 24 24"><path d="M5 12h12m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  retry: `<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  map: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.2" fill="#fff"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
};

function juicyButton(id, cls, icon, label) {
  return `<button type="button" class="${cls}" id="${id}"><span class="bico">${icon}</span><span>${label}</span></button>`;
}

function goalMark(goal) {
  if (goal.type === "ice") return `<i class="mark mark-ice" aria-hidden="true"></i>`;
  if (goal.type === "ingredient") return `<i class="mark mark-drop" aria-hidden="true"></i>`;
  if (goal.type === "collect") return `<i class="mark mark-fruit c${goal.color ?? 0}" aria-hidden="true"></i>`;
  return `<i class="mark mark-star" aria-hidden="true"></i>`;
}

function ribbon(title) {
  return `<div class="ribbon"><span>${title}</span></div>`;
}

function showIntro() {
  const goals = game.level.goals.map((goal) => `<li>${goalMark(goal)}<span>${goalText(goal)}</span></li>`).join("");
  const tip = game.level.tip ? `<p class="tip">${t(`tip.${game.level.tip}`)}</p>` : "";
  openModal("intro", `
    ${ribbon(levelName(game.level.id))}
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <ul class="goal-list">${goals}</ul>
    <p class="moves-pill">${t("moves")}: ${game.level.moves}</p>
    ${tip}
    ${juicyButton("btn-start", "primary", ICO.play, t("start"))}
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
  document.querySelector("#moves-label").textContent = t("moves");
  const goalBox = document.querySelector("#hud-goals");
  goalBox.innerHTML = goals.map((goal) => {
    const pct = Math.max(0, Math.min(1, goal.target ? goal.current / goal.target : 0));
    return `<div class="goal-chip">${goalMark(goal)}<span class="g-label">${goalText(goal)}</span><b>${Math.min(goal.current, goal.target)}/${goal.target}</b><i class="bar" style="width:${pct * 100}%"></i></div>`;
  }).join("");
  const top = stars[2] || 1;
  const fill = Math.max(0, Math.min(1, score / top));
  document.querySelector("#score-fill").style.width = `${fill * 100}%`;
  document.querySelectorAll(".star-mark").forEach((mark, index) => {
    const threshold = stars[index] || 0;
    mark.style.left = `${Math.max(8, Math.min(96, (threshold / top) * 100))}%`;
    mark.classList.toggle("on", score >= threshold);
  });
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
  const next = game.level.id < LEVELS.length ? juicyButton("btn-next", "primary", ICO.next, t("next")) : "";
  openModal("win", `
    ${ribbon(t("win"))}
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <div class="star-row">${starHtml}</div>
    <p class="score-line">${t("score")}: <b>${game.state.score}</b></p>
    ${reward}
    <div class="row">
      ${next}
      ${juicyButton("btn-retry", "ghost", ICO.retry, t("retry"))}
      ${juicyButton("btn-map", "ghost", ICO.map, t("map"))}
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
    : `${juicyButton("btn-extra", "primary", ICO.plus, t("extra"))}<p class="tip">${t("loseHint")}</p>`;
  openModal("lose", `
    ${ribbon(t("lose"))}
    <p class="kicker">${t("level")} ${game.level.id}</p>
    <p class="score-line">${t("score")}: <b>${game.state.score}</b></p>
    ${extra}
    <div class="row">
      ${juicyButton("btn-retry", "ghost", ICO.retry, t("retry"))}
      ${juicyButton("btn-map", "ghost", ICO.map, t("map"))}
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

function confettiHtml() {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--d:${index}"></i>`).join("")}</div>`;
}

function openModal(kind, html) {
  const modal = document.querySelector("#modal");
  modal.hidden = false;
  modal.dataset.modal = kind;
  document.querySelector("#modal-card").innerHTML = html;
  modal.querySelector(".confetti")?.remove();
  if (kind === "win") modal.insertAdjacentHTML("beforeend", confettiHtml());
}

function closeModal() {
  const modal = document.querySelector("#modal");
  modal.hidden = true;
  modal.dataset.modal = "";
  document.querySelector("#modal-card").innerHTML = "";
  modal.querySelector(".confetti")?.remove();
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
    ${ribbon(t("help"))}
    <p class="tip">${t("helpBody")}</p>
    <button type="button" class="ghost danger" id="btn-reset">${t("reset")}</button>
    ${juicyButton("btn-close-help", "primary", ICO.play, t("play"))}
  `);
  document.querySelector("#btn-close-help").addEventListener("click", () => {
    audio.button();
    closeModal();
  });
  document.querySelector("#btn-reset").addEventListener("click", () => {
    openModal("reset", `
      ${ribbon(t("reset"))}
      <p class="tip">${t("resetAsk")}</p>
      <div class="row">
        ${juicyButton("btn-reset-yes", "primary", ICO.retry, t("yes"))}
        ${juicyButton("btn-reset-no", "ghost", ICO.map, t("no"))}
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
  document.querySelector("#map-scroll").addEventListener("scroll", () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = document.querySelector(".cloud-layer");
    if (!layer) return;
    const y = document.querySelector("#map-scroll").scrollTop;
    layer.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
  }, { passive: true });
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
    prepareLoss() {
      const state = game.state;
      if (!state || game.mode !== "play") return false;
      state.moves = 1;
      for (const goal of state.goals) goal.target = 1000000;
      paintHud(state);
      return true;
    },
  };
}

boot();
