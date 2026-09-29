/** Canvas board: original fruit sprites, juice particles, and tweened cascades. */

const PALETTE = [
  { hi: "#ffd0d0", mid: "#ff4b4b", lo: "#c41228", leaf: "#3cba55" },
  { hi: "#ffe3bf", mid: "#ff8c1a", lo: "#d85c00", leaf: "#3cba55" },
  { hi: "#fff7c2", mid: "#ffe14a", lo: "#e0b000", leaf: "#3cba55" },
  { hi: "#eefac4", mid: "#8ed63c", lo: "#4c9614", leaf: "#2f8f45" },
  { hi: "#d9e2ff", mid: "#5c78ff", lo: "#2a3cc2", leaf: "#3cba55" },
  { hi: "#f3d6ff", mid: "#b84eeb", lo: "#741eaa", leaf: "#3cba55" },
];

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class BoardView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sprites = new Map();
    this.particles = [];
    this.floaters = [];
    this.cells = [];
    this.rows = 8;
    this.cols = 8;
    this.speed = 1;
    this.selected = null;
    this.hint = null;
    this.shake = 0;
    this.time = 0;
    this.last = 0;
    this.running = false;
    this.layout = { x0: 0, y0: 0, cell: 32 };
    this.cssW = 1;
    this.cssH = 1;
    this.dpr = 1;
    this.cache = new Map();
    this.onPopup = null;
    this.onStep = null;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(34, this.last ? now - this.last : 16);
    this.last = now;
    this.time = now;
    this.stepFx(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    const pad = 6;
    const cell = Math.min((this.cssW - pad * 2) / this.cols, (this.cssH - pad * 2) / this.rows);
    const boardW = cell * this.cols;
    const boardH = cell * this.rows;
    this.layout = {
      cell,
      x0: (this.cssW - boardW) / 2,
      y0: (this.cssH - boardH) / 2,
    };
    this.cache.clear();
  }

  cellToClient(r, c) {
    const rect = this.canvas.getBoundingClientRect();
    const { x0, y0, cell } = this.layout;
    const x = x0 + (c + 0.5) * cell;
    const y = y0 + (r + 0.5) * cell;
    return {
      x: rect.left + (x / this.cssW) * rect.width,
      y: rect.top + (y / this.cssH) * rect.height,
    };
  }

  clientToCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.cssW;
    const y = ((clientY - rect.top) / rect.height) * this.cssH;
    const c = Math.floor((x - this.layout.x0) / this.layout.cell);
    const r = Math.floor((y - this.layout.y0) / this.layout.cell);
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
    return { r, c };
  }

  load(grid) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.sprites.clear();
    this.particles = [];
    this.floaters = [];
    this.adopt(grid, true);
    this.resize();
  }

  adopt(grid, snapSprites) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.cells = grid.map((row) => row.map((tile) => ({
      hole: tile.hole,
      crate: tile.crate,
      ice: tile.ice,
      lock: tile.lock,
    })));
    if (!snapSprites) return;
    const alive = new Set();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const piece = grid[r][c].piece;
        if (!piece) continue;
        alive.add(piece.id);
        let sprite = this.sprites.get(piece.id);
        if (!sprite) {
          sprite = this.makeSprite(piece, r, c);
          this.sprites.set(piece.id, sprite);
        } else {
          sprite.t = piece.t;
          sprite.color = piece.color;
          sprite.dir = piece.dir;
          sprite.r = r;
          sprite.c = c;
          sprite.x = c;
          sprite.y = r;
          sprite.scale = 1;
          sprite.alpha = 1;
        }
      }
    }
    for (const id of [...this.sprites.keys()]) {
      if (!alive.has(id)) this.sprites.delete(id);
    }
  }

  makeSprite(piece, r, c) {
    return {
      id: piece.id,
      t: piece.t,
      color: piece.color,
      dir: piece.dir,
      r,
      c,
      x: c,
      y: r,
      scale: 1,
      alpha: 1,
    };
  }

  obstaclesFrom(grid) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.cells = grid.map((row) => row.map((tile) => ({
      hole: tile.hole,
      crate: tile.crate,
      ice: tile.ice,
      lock: tile.lock,
    })));
  }

  async play(steps) {
    for (const step of steps) {
      this.onStep?.(step);
      if (step.type === "swap" || step.type === "swapback") await this.animSwap(step);
      else if (step.type === "burst") await this.animBurst(step);
      else if (step.type === "fall") await this.animFall(step);
      else if (step.type === "convert" || step.type === "bonus") await this.animConvert(step);
      else if (step.type === "shuffle") await this.animShuffle(step);
      if (step.popup) this.onPopup?.(step.popup);
      if (step.shake) this.shake = Math.max(this.shake, step.shake === 2 ? 10 : 5);
    }
  }

  tween(ms, tick) {
    if (this.speed >= 12) {
      tick(1);
      return Promise.resolve();
    }
    const dur = Math.max(16, ms / this.speed);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        tick(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async animSwap(step) {
    const a = this.sprites.get(step.id1);
    const b = this.sprites.get(step.id2);
    if (!a || !b) return;
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    await this.tween(step.type === "swapback" ? 150 : 140, (t) => {
      const e = easeInOut(t);
      a.x = ax + (b.c - ax) * e;
      a.y = ay + (b.r - ay) * e;
      b.x = bx + (a.c - bx) * e;
      b.y = by + (a.r - by) * e;
    });
    const ar = a.r;
    const ac = a.c;
    a.r = b.r;
    a.c = b.c;
    a.x = a.c;
    a.y = a.r;
    b.r = ar;
    b.c = ac;
    b.x = b.c;
    b.y = b.r;
  }

  juiceAt(col, row, color, amount) {
    const { x0, y0, cell } = this.layout;
    const x = x0 + (col + 0.5) * cell;
    const y = y0 + (row + 0.5) * cell;
    const palette = PALETTE[color ?? 0] || PALETTE[0];
    const n = this.speed >= 12 ? 0 : amount;
    for (let i = 0; i < n && this.particles.length < 170; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cell * (0.04 + Math.random() * 0.12);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cell * 0.04,
        life: 1,
        color: i % 3 === 0 ? "#fff6d8" : palette.mid,
        size: cell * (0.06 + Math.random() * 0.07),
      });
    }
  }

  async animBurst(step) {
    if (step.grid) this.obstaclesFrom(step.grid);
    const fading = [];
    for (const piece of step.removed || []) {
      const sprite = this.sprites.get(piece.id);
      if (sprite) fading.push(sprite);
      this.juiceAt(piece.c, piece.r, piece.color ?? 0, piece.t === "F" ? 7 : 12);
    }
    if (step.scoreGain > 40) {
      this.floaters.push({
        text: `+${step.scoreGain}`,
        x: this.cssW / 2,
        y: this.cssH * 0.42,
        life: 1,
      });
    }
    await this.tween(200, (t) => {
      const e = easeOut(t);
      for (const sprite of fading) {
        sprite.scale = 1 - e;
        sprite.alpha = 1 - e;
      }
    });
    for (const sprite of fading) this.sprites.delete(sprite.id);
    const born = [];
    for (const piece of step.spawnedSpecials || []) {
      const sprite = this.makeSprite(piece, piece.r, piece.c);
      sprite.scale = 0.2;
      this.sprites.set(piece.id, sprite);
      born.push(sprite);
      this.juiceAt(piece.c, piece.r, piece.color ?? 0, 10);
    }
    if (born.length) {
      await this.tween(160, (t) => {
        const e = easeOut(t);
        for (const sprite of born) sprite.scale = 0.2 + 0.9 * e;
      });
      for (const sprite of born) sprite.scale = 1;
    }
  }

  async animFall(step) {
    const motions = [];
    for (const move of step.drops || []) {
      const sprite = this.sprites.get(move.id);
      if (!sprite) continue;
      motions.push({ sprite, x: sprite.x, y: sprite.y, toX: move.toC, toY: move.toR, collect: move.collect });
    }
    for (const spawn of step.spawned || []) {
      const sprite = this.makeSprite(spawn.piece, spawn.toR, spawn.toC);
      sprite.x = spawn.fromC;
      sprite.y = spawn.fromR;
      sprite.scale = 0.92;
      this.sprites.set(spawn.id, sprite);
      motions.push({ sprite, x: spawn.fromC, y: spawn.fromR, toX: spawn.toC, toY: spawn.toR });
    }
    const distance = motions.reduce((max, motion) => Math.max(max, Math.abs(motion.toY - motion.y)), 0);
    await this.tween(150 + distance * 38, (t) => {
      const e = easeOut(t);
      for (const motion of motions) {
        motion.sprite.x = motion.x + (motion.toX - motion.x) * e;
        motion.sprite.y = motion.y + (motion.toY - motion.y) * e;
        if (motion.collect && t > 0.72) motion.sprite.alpha = 1 - (t - 0.72) / 0.28;
      }
    });
    if (step.grid) this.adopt(step.grid, true);
  }

  async animConvert(step) {
    const popped = [];
    for (const item of step.cells || []) {
      const piece = item.piece;
      let sprite = [...this.sprites.values()].find((entry) => entry.r === item.r && entry.c === item.c);
      if (!sprite && step.r != null) sprite = [...this.sprites.values()].find((entry) => entry.r === step.r && entry.c === step.c);
      if (!sprite) {
        sprite = this.makeSprite(piece, item.r, item.c);
        this.sprites.set(piece.id, sprite);
      } else {
        this.sprites.delete(sprite.id);
        sprite.id = piece.id;
        sprite.t = piece.t;
        sprite.color = piece.color;
        sprite.dir = piece.dir;
        this.sprites.set(sprite.id, sprite);
      }
      sprite.scale = 0.7;
      popped.push(sprite);
      this.juiceAt(item.c, item.r, piece.color ?? 0, 8);
    }
    if (step.piece && step.r != null) {
      let sprite = [...this.sprites.values()].find((entry) => entry.r === step.r && entry.c === step.c);
      if (sprite) this.sprites.delete(sprite.id);
      sprite = this.makeSprite(step.piece, step.r, step.c);
      sprite.scale = 0.55;
      this.sprites.set(sprite.id, sprite);
      popped.push(sprite);
    }
    await this.tween(150, (t) => {
      const e = easeOut(t);
      for (const sprite of popped) sprite.scale = 0.55 + 0.5 * e;
    });
    for (const sprite of popped) sprite.scale = 1;
  }

  async animShuffle(step) {
    const sprites = [...this.sprites.values()];
    await this.tween(140, (t) => {
      for (const sprite of sprites) sprite.alpha = 1 - t;
    });
    if (step.grid) this.adopt(step.grid, true);
    const next = [...this.sprites.values()];
    for (const sprite of next) sprite.alpha = 0;
    await this.tween(180, (t) => {
      for (const sprite of next) sprite.alpha = t;
    });
    for (const sprite of next) sprite.alpha = 1;
  }

  stepFx(dt) {
    const k = dt / 16.67;
    this.shake *= Math.pow(0.86, k);
    if (this.shake < 0.15) this.shake = 0;
    for (const particle of this.particles) {
      particle.x += particle.vx * k;
      particle.y += particle.vy * k;
      particle.vy += 0.18 * k;
      particle.life -= 0.028 * k;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const floater of this.floaters) {
      floater.y -= 0.7 * k;
      floater.life -= 0.02 * k;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.cssW) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    const jx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const jy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save();
    ctx.translate(jx, jy);
    this.drawSlots(ctx);
    this.drawSprites(ctx);
    this.drawLocks(ctx);
    this.drawParticles(ctx);
    this.drawMarkers(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
  }

  drawSlots(ctx) {
    const { x0, y0, cell } = this.layout;
    const gap = cell * 0.1;
    const size = cell - gap;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.cells[r]?.[c];
        if (!tile || tile.hole) continue;
        const x = x0 + c * cell + gap / 2;
        const y = y0 + r * cell + gap / 2;
        ctx.save();
        roundRect(ctx, x, y, size, size, size * 0.28);
        const grad = ctx.createLinearGradient(x, y, x, y + size);
        grad.addColorStop(0, "#fff3dd");
        grad.addColorStop(1, "#f0c98a");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(140, 72, 24, 0.28)";
        ctx.lineWidth = Math.max(1, cell * 0.035);
        ctx.stroke();
        if (tile.ice > 0) {
          ctx.fillStyle = tile.ice > 1 ? "rgba(120, 196, 255, 0.55)" : "rgba(186, 230, 255, 0.42)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.moveTo(x + size * 0.25, y + size * 0.3);
          ctx.lineTo(x + size * 0.48, y + size * 0.55);
          ctx.moveTo(x + size * 0.62, y + size * 0.28);
          ctx.lineTo(x + size * 0.4, y + size * 0.7);
          ctx.stroke();
        }
        if (tile.crate > 0) this.drawCrate(ctx, x, y, size, tile.crate);
        ctx.restore();
      }
    }
  }

  drawCrate(ctx, x, y, size, hp) {
    ctx.save();
    roundRect(ctx, x + size * 0.06, y + size * 0.06, size * 0.88, size * 0.88, size * 0.16);
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, hp > 1 ? "#c9843c" : "#e0a45a");
    grad.addColorStop(1, hp > 1 ? "#8a4e18" : "#b86b28");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(92, 42, 10, 0.45)";
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.18, y + size * 0.38);
    ctx.lineTo(x + size * 0.82, y + size * 0.38);
    ctx.moveTo(x + size * 0.18, y + size * 0.62);
    ctx.lineTo(x + size * 0.82, y + size * 0.62);
    ctx.stroke();
    ctx.fillStyle = "#fff4d2";
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y + size * 0.5, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSprites(ctx) {
    const { x0, y0, cell } = this.layout;
    const radius = cell * 0.36;
    for (const sprite of this.sprites.values()) {
      if (sprite.alpha <= 0.01) continue;
      const px = x0 + (sprite.x + 0.5) * cell;
      const py = y0 + (sprite.y + 0.5) * cell;
      const bob = sprite.scale === 1 ? 1 + Math.sin(this.time / 420 + sprite.id) * 0.03 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, sprite.alpha);
      ctx.translate(px, py);
      ctx.scale(sprite.scale * bob, sprite.scale * bob);
      if (sprite.t === "C") this.drawSpectrum(ctx, radius);
      else if (sprite.t === "I") this.drawNectar(ctx, radius);
      else {
        const image = this.spriteImage(sprite, radius);
        ctx.drawImage(image, -radius * 1.35, -radius * 1.35, radius * 2.7, radius * 2.7);
      }
      ctx.restore();
    }
  }

  spriteImage(sprite, radius) {
    const size = Math.max(16, Math.round(radius * 2.7));
    const key = `${sprite.t}:${sprite.color}:${sprite.dir}:${size}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const color = sprite.color ?? 0;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const r = size * 0.34;
    this.drawFruit(ctx, color, r);
    if (sprite.t === "S") this.drawStripes(ctx, r, sprite.dir);
    if (sprite.t === "W") this.drawRibbon(ctx, r);
    ctx.restore();
    this.cache.set(key, canvas);
    return canvas;
  }

  drawFruit(ctx, color, r) {
    const palette = PALETTE[color] || PALETTE[0];
    if (color === 1) this.blobOrange(ctx, palette, r);
    else if (color === 2) this.blobLemon(ctx, palette, r);
    else if (color === 3) this.blobPear(ctx, palette, r);
    else if (color === 4) this.blobBerry(ctx, palette, r);
    else if (color === 5) this.blobGrape(ctx, palette, r);
    else this.blobApple(ctx, palette, r);
  }

  fillOrb(ctx, x, y, r, palette) {
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    grad.addColorStop(0, palette.hi);
    grad.addColorStop(0.55, palette.mid);
    grad.addColorStop(1, palette.lo);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.34, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  blobApple(ctx, palette, r) {
    this.fillOrb(ctx, 0, r * 0.06, r * 0.92, palette);
    ctx.strokeStyle = "#6b3a1a";
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.05, -r * 1.05, r * 0.16, -r * 1.12);
    ctx.stroke();
    ctx.fillStyle = palette.leaf;
    ctx.beginPath();
    ctx.ellipse(r * 0.28, -r * 0.92, r * 0.28, r * 0.13, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  blobOrange(ctx, palette, r) {
    this.fillOrb(ctx, 0, 0, r, palette);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0.4, 1.4);
    ctx.stroke();
    ctx.fillStyle = palette.leaf;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.92, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  blobLemon(ctx, palette, r) {
    ctx.save();
    ctx.rotate(-0.5);
    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, palette.lo);
    grad.addColorStop(0.4, palette.mid);
    grad.addColorStop(1, palette.hi);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.18, r * 0.22, r * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  blobPear(ctx, palette, r) {
    this.fillOrb(ctx, 0, r * 0.22, r * 0.78, palette);
    this.fillOrb(ctx, 0, -r * 0.48, r * 0.48, palette);
    ctx.strokeStyle = "#5a3416";
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.08, -r * 1.15);
    ctx.stroke();
    ctx.fillStyle = palette.leaf;
    ctx.beginPath();
    ctx.ellipse(r * 0.26, -r * 0.95, r * 0.22, r * 0.1, -0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  blobBerry(ctx, palette, r) {
    this.fillOrb(ctx, 0, r * 0.08, r * 0.9, palette);
    ctx.fillStyle = "#24306e";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      ctx.lineTo(Math.cos(a) * r * 0.28, -r * 0.72 + Math.sin(a) * r * 0.16);
      ctx.lineTo(Math.cos(a + 0.35) * r * 0.1, -r * 0.72 + Math.sin(a + 0.35) * r * 0.08);
    }
    ctx.fill();
  }

  blobGrape(ctx, palette, r) {
    const spots = [
      [0, r * 0.35],
      [-r * 0.38, r * 0.05],
      [r * 0.38, r * 0.05],
      [-r * 0.22, -r * 0.38],
      [r * 0.22, -r * 0.38],
    ];
    for (const [x, y] of spots) this.fillOrb(ctx, x, y, r * 0.42, palette);
    ctx.fillStyle = palette.leaf;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.95, r * 0.28, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStripes(ctx, r, dir) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = "round";
    for (const offset of [-0.38, 0, 0.38]) {
      ctx.beginPath();
      if (dir === "v") {
        ctx.moveTo(r * offset, -r * 0.85);
        ctx.lineTo(r * offset, r * 0.9);
      } else {
        ctx.moveTo(-r * 0.9, r * offset);
        ctx.lineTo(r * 0.9, r * offset);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRibbon(ctx, r) {
    ctx.save();
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    ctx.fillStyle = "#fff4c4";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSpectrum(ctx, r) {
    const colors = ["#ff4d4d", "#ff9a1f", "#ffe14a", "#67d34a", "#4d74ff", "#b44ee0"];
    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      ctx.fillStyle = colors[i];
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, (i / colors.length) * Math.PI * 2 + this.time / 500, ((i + 1) / colors.length) * Math.PI * 2 + this.time / 500);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4d6a";
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.3, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  drawNectar(ctx, r) {
    const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, r * 0.1, r);
    grad.addColorStop(0, "#fff6c8");
    grad.addColorStop(0.5, "#ffc83d");
    grad.addColorStop(1, "#e28900");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.bezierCurveTo(r * 0.85, -r * 0.2, r * 0.7, r * 0.85, 0, r * 0.95);
    ctx.bezierCurveTo(-r * 0.7, r * 0.85, -r * 0.85, -r * 0.2, 0, -r * 1.05);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.15, r * 0.16, r * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLocks(ctx) {
    const { x0, y0, cell } = this.layout;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.cells[r]?.[c]?.lock) continue;
        const x = x0 + (c + 0.5) * cell;
        const y = y0 + (r + 0.5) * cell;
        ctx.save();
        ctx.strokeStyle = "#d7a441";
        ctx.lineWidth = cell * 0.06;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#6fbf45";
        ctx.beginPath();
        ctx.ellipse(x + cell * 0.22, y - cell * 0.28, cell * 0.1, cell * 0.05, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawParticles(ctx) {
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawMarkers(ctx) {
    const { x0, y0, cell } = this.layout;
    const pulse = 0.45 + Math.sin(this.time / 180) * 0.25;
    const mark = (r, c, color) => {
      const x = x0 + c * cell + cell * 0.08;
      const y = y0 + r * cell + cell * 0.08;
      ctx.strokeStyle = color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = cell * 0.07;
      roundRect(ctx, x, y, cell * 0.84, cell * 0.84, cell * 0.24);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (this.hint) {
      mark(this.hint.r1, this.hint.c1, "#fff4b0");
      mark(this.hint.r2, this.hint.c2, "#fff4b0");
    }
    if (this.selected) mark(this.selected.r, this.selected.c, "#ffffff");
  }

  drawFloaters(ctx) {
    ctx.save();
    ctx.font = `800 ${Math.round(this.layout.cell * 0.42)}px Trebuchet MS, sans-serif`;
    ctx.textAlign = "center";
    for (const floater of this.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(92, 28, 48, 0.45)";
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = "#fffaf0";
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }
}
