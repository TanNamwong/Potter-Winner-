// PotterWinner Trail Run — game logic
'use strict';

// ---------- State ----------
let selectedCharacter = 'POTTER';
let selectedMode = 'SANDBOX';
let sandboxSpeed = 5;
let deferredPrompt = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const faces = { POTTER: new Image(), WINNER: new Image() };
faces.POTTER.src = 'face-potter.jpg';
faces.WINNER.src = 'face-winner.jpg';

const BIOME_LENGTH = 150;     // เมตรต่อภูมิประเทศ
const ADVENTURE_GOAL = 1000;  // เมตร
const ADVENTURE_LIVES = 3;

const biomes = [
    { name: 'ภูเขาสูงสดชื่น 🏔️', sky: ['#6baed6', '#cfe5f3'], mountain: '#3182bd', ground: '#41ab5d', foliage: '#238b45', deco: 'tree', obstacle: ['🪨', '🪵'] },
    { name: 'ทะเลและหาดทราย 🌊', sky: ['#4292c6', '#b9dcef'], mountain: '#2a6fb0', ground: '#f2d27a', foliage: '#2e9e4f', deco: 'palm', obstacle: ['🦀', '🐚'] },
    { name: 'ทุ่งนาทองคำ 🌾', sky: ['#fed976', '#ffeec2'], mountain: '#d9822b', ground: '#e6c14f', foliage: '#9ccc4f', deco: 'rice', obstacle: ['🪨', '🐍'] },
    { name: 'สวนดอกไม้ป่า 🌸', sky: ['#c6dbef', '#fbd5c6'], mountain: '#8c7fc4', ground: '#a1d99b', foliage: '#e7298a', deco: 'tree', obstacle: ['🪵', '🍄'] },
    { name: 'ลำห้วยแม่น้ำ 🏞️', sky: ['#9ecae1', '#d9e9f4'], mountain: '#2b8cbe', ground: '#74c476', foliage: '#0a7b45', deco: 'tree', obstacle: ['🪨', '🐸'] },
    { name: 'ป่าดงพงไพร 🌲', sky: ['#5fb36f', '#b5e0b4'], mountain: '#0b5a2a', ground: '#2f9a52', foliage: '#0b4d1f', deco: 'pine', obstacle: ['🪵', '🍄'] },
    { name: 'ทุ่งหญ้ากว้างใหญ่ 🌿', sky: ['#80b1d3', '#d6efa0'], mountain: '#9acb4b', ground: '#7fc97f', foliage: '#33a02c', deco: 'tree', obstacle: ['🪨', '🐍'] }
];

// ---------- Helpers ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function rand(a, b) { return a + Math.random() * (b - a); }
function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }

// ---------- Audio (เสียงเอฟเฟกต์เล็กๆ) ----------
let audioCtx = null;
function beep(freq, dur, type = 'sine', vol = 0.08, slide = 0) {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type; o.frequency.value = freq;
        if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + dur);
        g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* ignore */ }
}
const sfx = {
    jump: () => beep(380, 0.15, 'square', 0.05, 260),
    coin: () => { beep(880, 0.08, 'triangle', 0.08); setTimeout(() => beep(1320, 0.1, 'triangle', 0.08), 70); },
    hit: () => beep(160, 0.3, 'sawtooth', 0.1, -100),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'triangle', 0.1), i * 140))
};

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) window.location.reload();
        hadController = true;
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('btn-install').classList.remove('hidden');
});
$('btn-install').addEventListener('click', () => {
    if (!deferredPrompt) return;
    $('btn-install').classList.add('hidden');
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
});

function checkForUpdate() {
    if (!('serviceWorker' in navigator)) { window.location.reload(); return; }
    navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) { alert('แอปเป็นเวอร์ชันล่าสุดแล้ว'); return; }
        reg.update().then(() => {
            if (reg.installing || reg.waiting) {
                alert('พบเวอร์ชันใหม่! กำลังอัปเดตและรีโหลดแอป...');
            } else {
                alert('แอปเป็นเวอร์ชันล่าสุดแล้ว ✅');
            }
        }).catch(() => alert('ตรวจสอบอัปเดตไม่ได้ (ออฟไลน์?)'));
    });
}

// ---------- Menu ----------
function selectCharacter(c) {
    selectedCharacter = c;
    $('card-potter').classList.toggle('selected', c === 'POTTER');
    $('card-winner').classList.toggle('selected', c === 'WINNER');
}
function selectMode(m) {
    selectedMode = m;
    $('mode-sandbox').classList.toggle('selected', m === 'SANDBOX');
    $('mode-normal').classList.toggle('selected', m === 'NORMAL');
    $('mode-adventure').classList.toggle('selected', m === 'ADVENTURE');
    document.querySelector(`input[name="mode"][value="${m}"]`).checked = true;
}
function updateSpeed(v) {
    sandboxSpeed = parseFloat(v);
    $('speedVal').textContent = v;
}

// ---------- Game world ----------
let W = 0, H = 0, S = 1;          // ขนาดจอ (css px) และสเกล
let running = false, paused = false, over = false;
let rafId = null, lastT = 0;
let dist = 0, coins = 0, bestScore = 0, speed = 5, lives = 1;
let obstacles = [], coinList = [], particles = [];
let nextSpawnIn = 0, shake = 0, invuln = 0, runPhase = 0, lastBiome = -1;
const player = { y: 0, vy: 0, onGround: true, jumps: 0 };

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.max(0.6, Math.min(1.6, Math.min(H / 400, W / 700)));
}
window.addEventListener('resize', resizeCanvas);

const groundY = () => H * 0.74;
const CHAR_X = () => Math.max(70 * S, W * 0.14);
const RADIUS = () => 26 * S;
const LEG = () => 30 * S;

function startGame() {
    $('selection-screen').classList.add('hidden');
    $('game-screen').classList.remove('hidden');
    $('sandbox-controls').classList.toggle('hidden', selectedMode !== 'SANDBOX');
    $('normal-controls').classList.toggle('hidden', selectedMode !== 'NORMAL');
    $('adventure-controls').classList.toggle('hidden', selectedMode !== 'ADVENTURE');
    $('hint').classList.toggle('hidden', false);
    resizeCanvas();
    resetGame();
    running = true;
    lastT = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
}

function resetGame() {
    dist = 0; coins = 0; obstacles = []; coinList = []; particles = [];
    nextSpawnIn = 25; shake = 0; invuln = 0; runPhase = 0; lastBiome = -1;
    over = false; paused = false;
    player.y = 0; player.vy = 0; player.onGround = true; player.jumps = 0;
    lives = selectedMode === 'ADVENTURE' ? ADVENTURE_LIVES : 1;
    bestScore = parseInt(store('pw-best') || '0', 10) || 0;
    speed = selectedMode === 'SANDBOX' ? sandboxSpeed : (selectedMode === 'ADVENTURE' ? 6 : 5);
    $('overlay').classList.add('hidden');
    $('toast').classList.add('hidden');
    updateHud();
    setTimeout(() => $('hint').classList.add('hidden'), 4000);
}

function backToMenu() {
    running = false;
    cancelAnimationFrame(rafId);
    $('overlay').classList.add('hidden');
    $('game-screen').classList.add('hidden');
    $('selection-screen').classList.remove('hidden');
}

function restartGame() { resetGame(); running = true; lastT = performance.now(); cancelAnimationFrame(rafId); rafId = requestAnimationFrame(loop); }

// ---------- Input ----------
function jump() {
    if (!running || over || paused) return;
    if (player.onGround || player.jumps < 2) {
        player.vy = -(player.jumps === 0 ? 800 : 720) * S;
        player.onGround = false;
        player.jumps++;
        sfx.jump();
        for (let i = 0; i < 5; i++) particles.push({ x: CHAR_X(), y: groundY(), vx: rand(-80, 40) * S, vy: rand(-60, -10) * S, life: 0.4, color: '#e8d9b5' });
    }
}
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) jump(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !over) setPaused(true); });

function setPaused(p) {
    if (!running || over) return;
    paused = p;
    $('btn-pause').textContent = p ? '▶️ เล่นต่อ' : '⏸️ พัก';
    if (!p) lastT = performance.now();
}
function togglePause() { setPaused(!paused); }

// ---------- Update ----------
function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (!paused && !over) update(dt);
    render();
    rafId = requestAnimationFrame(loop);
}

function currentBiomeIndex() { return Math.floor(dist / BIOME_LENGTH) % biomes.length; }

function update(dt) {
    // ความเร็ว
    if (selectedMode === 'SANDBOX') speed = sandboxSpeed;
    else if (selectedMode === 'NORMAL') speed = Math.min(12, 5 + dist / 150);
    else speed = 6;

    const pxPerSec = speed * 60 * S;
    dist += speed * dt;
    runPhase += speed * dt * 2.2;

    // ฟิสิกส์กระโดด
    player.vy += 2400 * S * dt;
    player.y += player.vy * dt;
    if (player.y >= 0) { player.y = 0; player.vy = 0; player.onGround = true; player.jumps = 0; }

    // ภูมิประเทศเปลี่ยน
    const bi = currentBiomeIndex();
    if (bi !== lastBiome) {
        if (lastBiome !== -1) showToast('📍 ' + biomes[bi].name);
        lastBiome = bi;
        $('biomeName').textContent = biomes[bi].name;
    }

    // สร้างสิ่งกีดขวาง / เหรียญ (นับเป็นพิกเซลที่เลื่อนไป)
    nextSpawnIn -= pxPerSec * dt;
    if (nextSpawnIn <= 0) {
        spawn(pxPerSec);
        nextSpawnIn = pxPerSec * rand(0.85, 1.7) + 140 * S;
    }

    const cx = CHAR_X(), r = RADIUS();
    const bodyTop = groundY() + player.y - LEG() - r * 2;   // บนสุดของตัวละคร
    const bodyBottom = groundY() + player.y;
    const hit = { l: cx - r * 0.6, r: cx + r * 0.6, t: bodyTop + r * 0.5, b: bodyBottom - 2 };

    for (const o of obstacles) {
        o.x -= pxPerSec * dt;
        if (selectedMode === 'SANDBOX' || invuln > 0 || over) continue;
        const ol = o.x - o.w * 0.4, or = o.x + o.w * 0.4, ot = groundY() - o.h * 0.85, ob = groundY();
        if (hit.r > ol && hit.l < or && hit.b > ot && hit.t < ob) onHit();
    }
    obstacles = obstacles.filter(o => o.x > -80);

    for (const c of coinList) {
        c.x -= pxPerSec * dt;
        if (!c.got && Math.abs(c.x - cx) < r + 12 * S && Math.abs(c.y - (bodyTop + r + r)) < r + 24 * S) {
            c.got = true; coins++;
            sfx.coin();
            for (let i = 0; i < 6; i++) particles.push({ x: c.x, y: c.y, vx: rand(-90, 90) * S, vy: rand(-120, 20) * S, life: 0.5, color: '#ffd700' });
        }
    }
    coinList = coinList.filter(c => c.x > -40 && !c.got);

    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * S * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);

    if (invuln > 0) invuln -= dt;
    if (shake > 0) shake -= dt;

    // ชนะภารกิจ
    if (selectedMode === 'ADVENTURE' && dist >= ADVENTURE_GOAL) { finish(true); return; }
    updateHud();
}

function spawn(pxPerSec) {
    const b = biomes[currentBiomeIndex()];
    const x = W + 60 * S;
    const withObstacle = selectedMode !== 'SANDBOX';
    if (withObstacle) {
        const double = selectedMode === 'NORMAL' && dist > 120 && Math.random() < 0.25;
        const count = double ? 2 : 1;
        for (let i = 0; i < count; i++) {
            const size = rand(34, 52) * S;
            obstacles.push({ x: x + i * size * 1.1, w: size, h: size, emoji: b.obstacle[Math.floor(Math.random() * b.obstacle.length)] });
        }
    }
    // เหรียญ: เรียงเป็นแนวโค้งเหนือสิ่งกีดขวางให้ได้ลองกระโดดเก็บ
    if (Math.random() < 0.8) {
        const n = 4, arcH = withObstacle ? 95 * S : rand(0, 100) * S;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            coinList.push({ x: x - 30 * S + i * 34 * S, y: groundY() - 40 * S - Math.sin(t * Math.PI) * arcH, got: false });
        }
    }
}

function onHit() {
    sfx.hit();
    shake = 0.25;
    lives--;
    if (selectedMode === 'ADVENTURE' && lives > 0) {
        invuln = 1.6;
        showToast('💥 ชนแล้ว! เหลือ ' + '❤️'.repeat(lives));
        return;
    }
    finish(false);
}

function finish(win) {
    over = true;
    const m = Math.floor(dist);
    if (selectedMode === 'NORMAL' && m > bestScore) { bestScore = m; store('pw-best', String(m)); }
    updateHud();
    if (win) sfx.win();
    $('overlay-title').textContent = win ? '🎉 พิชิตภารกิจสำเร็จ!' : '💥 จบการเดินทาง';
    let text = `ระยะทาง ${m} เมตร · เหรียญ ${coins} 🪙`;
    if (selectedMode === 'NORMAL') text += `\nสถิติสูงสุด ${bestScore} เมตร` + (m >= bestScore && m > 0 ? ' 🏆 สถิติใหม่!' : '');
    $('overlay-text').textContent = text;
    $('overlay').classList.remove('hidden');
}

function updateHud() {
    const m = Math.floor(dist);
    $('coinVal').textContent = coins;
    if (selectedMode === 'NORMAL') {
        $('scoreVal').textContent = m;
        $('bestVal').textContent = Math.max(bestScore, m);
    } else if (selectedMode === 'ADVENTURE') {
        $('questText').textContent = `สำรวจ ${Math.min(m, ADVENTURE_GOAL)}/${ADVENTURE_GOAL}M`;
        $('livesVal').textContent = '❤️'.repeat(Math.max(0, lives)) || '💔';
    }
}

let toastTimeout = null;
function showToast(msg) {
    const toast = $('toast');
    if (msg) toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('hidden'), 1800);
}

// ---------- Render ----------
function drawDecor(kind, x, gy, color, s) {
    ctx.fillStyle = '#5C4033';
    if (kind === 'palm') {
        ctx.fillRect(x - 4 * s, gy - 70 * s, 8 * s, 70 * s);
        ctx.fillStyle = color;
        for (let a = -2; a <= 2; a++) {
            ctx.beginPath();
            ctx.ellipse(x + a * 16 * s, gy - 74 * s + Math.abs(a) * 7 * s, 22 * s, 7 * s, a * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (kind === 'pine') {
        ctx.fillRect(x - 5 * s, gy - 30 * s, 10 * s, 30 * s);
        ctx.fillStyle = color;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x, gy - (95 - i * 22) * s);
            ctx.lineTo(x - (22 + i * 8) * s, gy - (45 - i * 17) * s);
            ctx.lineTo(x + (22 + i * 8) * s, gy - (45 - i * 17) * s);
            ctx.fill();
        }
    } else if (kind === 'rice') {
        ctx.strokeStyle = color; ctx.lineWidth = 3 * s;
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath(); ctx.moveTo(x + i * 6 * s, gy); ctx.quadraticCurveTo(x + i * 8 * s, gy - 25 * s, x + i * 12 * s, gy - 40 * s); ctx.stroke();
        }
    } else {
        ctx.fillRect(x - 6 * s, gy - 60 * s, 12 * s, 60 * s);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, gy - 72 * s, 30 * s, 0, Math.PI * 2); ctx.fill();
    }
}

function render() {
    const gy = groundY();
    const f = dist / BIOME_LENGTH;
    const idx = Math.floor(f) % biomes.length;
    const frac = f - Math.floor(f);
    const A = biomes[idx], B = biomes[(idx + 1) % biomes.length];
    const t = frac > 0.9 ? (frac - 0.9) / 0.1 : 0;      // ค่อยๆ เปลี่ยนสีก่อนเข้าภูมิประเทศใหม่
    const cur = frac > 0.97 ? B : A;
    const col = (k) => mix(A[k], B[k], t);

    ctx.save();
    if (shake > 0) ctx.translate(rand(-6, 6), rand(-6, 6));

    // ท้องฟ้า
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, mix(A.sky[0], B.sky[0], t));
    sky.addColorStop(1, mix(A.sky[1], B.sky[1], t));
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // ภูเขา (พารัลแลกซ์)
    const off = dist * 60 * S;
    ctx.fillStyle = col('mountain');
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W + 20; x += 20) {
        const y = gy - 70 * S - Math.sin((x + off * 0.15) * 0.007) * 45 * S - Math.cos((x + off * 0.15) * 0.019) * 14 * S;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, gy); ctx.closePath(); ctx.fill();

    // พื้น
    ctx.fillStyle = col('ground');
    ctx.fillRect(-10, gy, W + 20, H - gy + 10);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-10, gy, W + 20, 4 * S);
    // ขีดพื้นเลื่อนให้รู้สึกถึงความเร็ว
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 14; i++) {
        const px = ((i * 120 * S - off) % (W + 120 * S) + (W + 120 * S)) % (W + 120 * S) - 60 * S;
        ctx.fillRect(px, gy + 20 * S + (i % 3) * 22 * S, 40 * S, 3 * S);
    }

    // ต้นไม้/ของตกแต่ง
    const spacing = 220 * S, cnt = Math.ceil(W / spacing) + 2, period = cnt * spacing;
    for (let i = 0; i < cnt; i++) {
        const dx = (((i * spacing - off * 0.9) % period) + period) % period - spacing;
        drawDecor(cur.deco, dx, gy, col('foliage'), S);
    }

    // เหรียญ
    for (const c of coinList) {
        ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, 10 * S, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // สิ่งกีดขวาง
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const o of obstacles) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(o.x, gy + 2, o.w * 0.45, 5 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${o.h}px serif`;
        ctx.fillStyle = '#000';
        ctx.fillText(o.emoji, o.x, gy);
    }

    // ตัวละคร
    drawPlayer(gy);

    // อนุภาค
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * S, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (paused && !over) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Kanit, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('⏸️ พักเกม', W / 2, H / 2);
    }
}

function drawPlayer(gy) {
    const cx = CHAR_X(), r = RADIUS(), leg = LEG();
    const feetY = gy + player.y;
    const headY = feetY - leg - r;

    // เงา
    const air = Math.min(1, -player.y / (130 * S));
    ctx.fillStyle = `rgba(0,0,0,${0.25 - air * 0.12})`;
    ctx.beginPath(); ctx.ellipse(cx, gy + 2, r * (1 - air * 0.4), 5 * S, 0, 0, Math.PI * 2); ctx.fill();

    if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    // ขา + แขน แกว่งตามจังหวะวิ่ง
    const swing = player.onGround ? Math.sin(runPhase) : 0.9;
    ctx.strokeStyle = selectedCharacter === 'POTTER' ? '#1b6fb5' : '#e8663d';
    ctx.lineCap = 'round'; ctx.lineWidth = 7 * S;
    const hip = feetY - leg;
    ctx.beginPath(); ctx.moveTo(cx, hip); ctx.lineTo(cx + swing * 16 * S, feetY - (player.onGround ? Math.max(0, -Math.cos(runPhase)) * 8 * S : 8 * S)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hip); ctx.lineTo(cx - swing * 16 * S, feetY - (player.onGround ? Math.max(0, Math.cos(runPhase)) * 8 * S : 0)); ctx.stroke();
    // ตัว
    ctx.lineWidth = 16 * S;
    ctx.beginPath(); ctx.moveTo(cx, hip + 2 * S); ctx.lineTo(cx, headY + r * 0.6); ctx.stroke();
    ctx.lineWidth = 5 * S; ctx.strokeStyle = '#e0a979';
    ctx.beginPath(); ctx.moveTo(cx, headY + r + 8 * S); ctx.lineTo(cx - swing * 14 * S, headY + r + 20 * S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, headY + r + 8 * S); ctx.lineTo(cx + swing * 14 * S, headY + r + 20 * S); ctx.stroke();

    // หัว = รูปหน้าในวงกลม
    const img = faces[selectedCharacter];
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, headY, r, 0, Math.PI * 2); ctx.clip();
    if (img.complete && img.naturalWidth) ctx.drawImage(img, cx - r, headY - r, r * 2, r * 2);
    else { ctx.fillStyle = '#e0a979'; ctx.fillRect(cx - r, headY - r, r * 2, r * 2); }
    ctx.restore();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.arc(cx, headY, r, 0, Math.PI * 2); ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(13 * Math.max(S, 0.8))}px Kanit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    const name = selectedCharacter === 'POTTER' ? 'POTTER' : 'WINNER';
    ctx.strokeText(name, cx, gy + 22 * S); ctx.fillText(name, cx, gy + 22 * S);
}

// สำหรับทดสอบอัตโนมัติ
window.__pw = { get state() { return { dist, coins, lives, over, running, speed, obstacles: obstacles.length }; }, jump, set invulnerable(v) { invuln = v ? 1e9 : 0; } };
