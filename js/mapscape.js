/** Scrolling garden map. Level buttons stay in the DOM; scenery is original SVG. */

const GAP = 118;

const ZONES = [
  { id: "orchard", from: 1, to: 8 },
  { id: "berry", from: 9, to: 17 },
  { id: "citrus", from: 18, to: 26 },
  { id: "island", from: 27, to: 35 },
  { id: "festival", from: 36, to: 42 },
];

const PROP_CYCLE = {
  orchard: ["tree", "fence", "flower", "house", "bush", "tree", "flower", "stand"],
  berry: ["bush", "mushroom", "tree", "flower", "bush", "mushroom", "flower", "lantern"],
  citrus: ["umbrella", "flower", "tree", "stand", "umbrella", "bush", "flower", "house"],
  island: ["palm", "stand", "flower", "palm", "bush", "umbrella", "flower", "palm"],
  festival: ["lantern", "stand", "flag", "lantern", "house", "flower", "flag", "stand"],
};

export function zoneOf(levelId) {
  return ZONES.find((zone) => levelId >= zone.from && levelId <= zone.to)?.id || "orchard";
}

function svgWrap(body) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

const MARKS = {
  tree: svgWrap(`
    <ellipse cx="32" cy="58" rx="14" ry="4" fill="rgba(40,80,20,0.25)"/>
    <rect x="28" y="36" width="8" height="20" rx="3" fill="#8a5a32"/>
    <circle cx="32" cy="28" r="16" fill="#3eaf4e"/>
    <circle cx="24" cy="30" r="11" fill="#67d35a"/>
    <circle cx="40" cy="26" r="10" fill="#2f9a40"/>
    <circle cx="22" cy="24" r="3" fill="#ff5a5a"/>
    <circle cx="36" cy="20" r="2.6" fill="#ffd15c"/>
    <circle cx="30" cy="32" r="2.4" fill="#ff5a5a"/>
  `),
  bush: svgWrap(`
    <ellipse cx="32" cy="58" rx="16" ry="3" fill="rgba(30,70,20,0.2)"/>
    <circle cx="22" cy="40" r="12" fill="#2f9a46"/>
    <circle cx="40" cy="38" r="13" fill="#46c45a"/>
    <circle cx="32" cy="32" r="12" fill="#218a3c"/>
    <circle cx="24" cy="36" r="2.2" fill="#7a4bff"/>
    <circle cx="36" cy="30" r="2.2" fill="#ff4f7a"/>
    <circle cx="42" cy="40" r="2" fill="#ffd15c"/>
  `),
  flower: svgWrap(`
    <path d="M32 58 V34" stroke="#3c9a45" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="24" cy="40" rx="7" ry="3.5" fill="#5dba58" transform="rotate(-30 24 40)"/>
    <circle cx="32" cy="24" r="5" fill="#ff6b8a"/>
    <circle cx="24" cy="28" r="5" fill="#ffd15c"/>
    <circle cx="40" cy="28" r="5" fill="#ff8a3d"/>
    <circle cx="28" cy="18" r="5" fill="#fff"/>
    <circle cx="38" cy="18" r="5" fill="#ff6b8a"/>
    <circle cx="32" cy="23" r="3.2" fill="#ffb703"/>
  `),
  fence: svgWrap(`
    <rect x="8" y="28" width="6" height="28" rx="2" fill="#f4e2c4"/>
    <rect x="50" y="28" width="6" height="28" rx="2" fill="#e7c99a"/>
    <rect x="28" y="26" width="6" height="30" rx="2" fill="#fff6e4"/>
    <rect x="6" y="34" width="52" height="5" rx="2" fill="#d7a86a"/>
    <rect x="6" y="44" width="52" height="5" rx="2" fill="#c4894a"/>
  `),
  house: svgWrap(`
    <ellipse cx="32" cy="60" rx="18" ry="3" fill="rgba(80,40,10,0.2)"/>
    <path d="M8 32 L32 12 L56 32 Z" fill="#ff5d6c"/>
    <rect x="14" y="32" width="36" height="24" rx="3" fill="#fff3d8"/>
    <rect x="27" y="40" width="10" height="16" rx="2" fill="#c47a3a"/>
    <rect x="18" y="38" width="7" height="7" rx="1" fill="#9fd7ff"/>
    <rect x="39" y="38" width="7" height="7" rx="1" fill="#9fd7ff"/>
  `),
  stand: svgWrap(`
    <rect x="8" y="34" width="48" height="16" rx="3" fill="#f3d2a2"/>
    <path d="M6 36 h52 l-8-16 H14 z" fill="#ff4d6d"/>
    <path d="M16 26 h8 l-2 10 h-8z M28 24 h8 l-2 12 h-8z M40 26 h8 l-2 10 h-8z" fill="#fff6ea"/>
    <rect x="16" y="40" width="8" height="8" rx="2" fill="#ff5a5a"/>
    <rect x="28" y="40" width="8" height="8" rx="2" fill="#ff9a1f"/>
    <rect x="40" y="40" width="8" height="8" rx="2" fill="#7ed957"/>
    <rect x="14" y="50" width="4" height="10" fill="#a56b3a"/>
    <rect x="46" y="50" width="4" height="10" fill="#a56b3a"/>
  `),
  mushroom: svgWrap(`
    <rect x="28" y="36" width="8" height="20" rx="3" fill="#fff6ea"/>
    <ellipse cx="32" cy="32" rx="18" ry="12" fill="#c45bff"/>
    <circle cx="22" cy="30" r="3" fill="#fff"/>
    <circle cx="34" cy="26" r="2.4" fill="#ffe56a"/>
    <circle cx="40" cy="32" r="2.2" fill="#fff"/>
  `),
  umbrella: svgWrap(`
    <path d="M8 34 Q32 8 56 34 Z" fill="#ffb703"/>
    <path d="M8 34 Q20 22 32 34 Q44 22 56 34" fill="#fff4c8"/>
    <rect x="30" y="34" width="4" height="22" rx="2" fill="#f4e2c4"/>
    <path d="M32 56 q8 4 6 -2" stroke="#e07a2f" stroke-width="3" fill="none" stroke-linecap="round"/>
  `),
  palm: svgWrap(`
    <path d="M30 58 C28 44 34 36 40 28" stroke="#c4894a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="44" cy="24" rx="16" ry="6" fill="#1f9a4a" transform="rotate(-20 44 24)"/>
    <ellipse cx="36" cy="20" rx="16" ry="6" fill="#46c45a" transform="rotate(30 36 20)"/>
    <ellipse cx="48" cy="18" rx="14" ry="5" fill="#148a3c" transform="rotate(-50 48 18)"/>
    <circle cx="42" cy="26" r="3" fill="#ffb703"/>
    <circle cx="48" cy="30" r="2.4" fill="#ff8a1f"/>
  `),
  lantern: svgWrap(`
    <rect x="30" y="8" width="4" height="10" fill="#f4e2c4"/>
    <rect x="22" y="18" width="20" height="26" rx="6" fill="#ffb703"/>
    <rect x="26" y="22" width="12" height="16" rx="3" fill="#fff4c2"/>
    <path d="M32 44 v8" stroke="#e07a2f" stroke-width="2"/>
    <circle cx="32" cy="30" r="3" fill="#ff5d6c"/>
  `),
  flag: svgWrap(`
    <rect x="18" y="10" width="4" height="48" rx="2" fill="#f4e2c4"/>
    <path d="M22 12 h26 l-6 8 6 8 H22 z" fill="#ff4d6d"/>
    <circle cx="32" cy="20" r="3" fill="#ffe56a"/>
  `),
};

function roadPath(points) {
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mid = (a.y + b.y) / 2;
    d += ` C ${a.x.toFixed(2)} ${mid.toFixed(1)}, ${b.x.toFixed(2)} ${mid.toFixed(1)}, ${b.x.toFixed(2)} ${b.y.toFixed(1)}`;
  }
  return d;
}

function layout(levels) {
  const count = levels.length;
  const height = 200 + (count - 1) * GAP + 210;
  const points = levels.map((level, index) => ({
    id: level.id,
    index,
    x: 50 + Math.sin(index * 0.86) * 16 + Math.sin(index * 0.31 + 0.6) * 6,
    y: 120 + (count - 1 - index) * GAP,
  }));
  return { height, points };
}

export function renderWorld(container, { levels, unlocked, best, zoneName, onOpen }) {
  const { height, points } = layout(levels);
  container.style.height = `${height}px`;
  container.replaceChildren();

  const bands = ZONES.map((zone) => {
    const group = points.filter((point) => point.id >= zone.from && point.id <= zone.to);
    const top = Math.min(...group.map((point) => point.y)) - GAP * 0.62;
    const bottom = Math.max(...group.map((point) => point.y)) + GAP * 0.62;
    return { ...zone, top, height: bottom - top };
  });

  for (const band of bands) {
    const layer = document.createElement("div");
    layer.className = `zone-band zone-${band.id}`;
    layer.style.top = `${band.top}px`;
    layer.style.height = `${band.height}px`;
    const plate = document.createElement("div");
    plate.className = "zone-plate";
    plate.textContent = zoneName(band.id);
    layer.appendChild(plate);
    container.appendChild(layer);
  }

  const clouds = document.createElement("div");
  clouds.className = "cloud-layer";
  clouds.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) {
    const cloud = document.createElement("span");
    cloud.className = `cloud cloud-${i % 3}`;
    cloud.style.top = `${160 + i * (height / 9)}px`;
    cloud.style.left = `${i % 2 === 0 ? 8 : 62}%`;
    cloud.style.animationDelay = `${-i * 1.7}s`;
    clouds.appendChild(cloud);
  }
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.style.top = `${200 + (i * height) / 14}px`;
    spark.style.left = `${12 + ((i * 37) % 76)}%`;
    spark.style.animationDelay = `${-i * 0.4}s`;
    clouds.appendChild(spark);
  }
  container.appendChild(clouds);

  const d = roadPath(points);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "road");
  svg.setAttribute("viewBox", `0 0 100 ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <path class="road-edge" d="${d}"/>
    <path class="road-fill" d="${d}"/>
    <path class="road-dash" d="${d}"/>
  `;
  container.appendChild(svg);

  points.forEach((point, index) => {
    const zone = zoneOf(point.id);
    const kind = PROP_CYCLE[zone][index % PROP_CYCLE[zone].length];
    const side = point.x >= 50 ? -1 : 1;
    const prop = document.createElement("div");
    prop.className = `prop prop-${kind}`;
    const left = Math.max(14, Math.min(86, point.x + side * 30));
    prop.style.left = `${left}%`;
    prop.style.top = `${point.y + (index % 2 === 0 ? 18 : -26)}px`;
    prop.innerHTML = MARKS[kind] || MARKS.flower;
    container.appendChild(prop);
  });

  for (const point of points) {
    const done = best[point.id];
    const open = point.id <= unlocked;
    const current = point.id === unlocked;
    const spot = document.createElement("div");
    spot.className = "node-spot";
    spot.style.left = `${point.x}%`;
    spot.style.top = `${point.y}px`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `node${open ? "" : " locked"}${current ? " current" : ""}${done?.stars === 3 ? " perfect" : ""}`;
    button.dataset.level = String(point.id);
    button.disabled = !open;
    button.innerHTML = `<span class="node-num">${point.id}</span>`;
    button.addEventListener("click", () => onOpen(point.id));
    const stars = document.createElement("span");
    stars.className = "node-stars";
    if (!open) stars.textContent = "🔒";
    else if (done) stars.textContent = "★".repeat(done.stars) + "☆".repeat(3 - done.stars);
    else stars.textContent = "☆☆☆";
    spot.append(button, stars);
    if (current) {
      const pin = document.createElement("span");
      pin.className = "pin";
      pin.setAttribute("aria-hidden", "true");
      spot.appendChild(pin);
    }
    container.appendChild(spot);
  }
}
