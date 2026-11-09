// PotterWinner Game JS
let selectedCharacter = 'POTTER';
let selectedMode = 'SANDBOX';
let gameSpeed = 5;
let score = 0;
let isRunning = false;
let animationFrameId = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const imgPotter = new Image();
imgPotter.src = 'potter.jpg';

const imgWinner = new Image();
imgWinner.src = 'winner.jpg';

let bgOffset = 0;
let obstacles = [];
let toastTimeout = null;
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('มีเวอร์ชันใหม่ของ PotterWinner พร้อมใช้งาน! ต้องการอัปเดตเลยไหม?')) {
                            window.location.reload();
                        }
                    }
                };
            };
        });
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.classList.remove('hidden');
        btnInstall.addEventListener('click', () => {
            btnInstall.classList.add('hidden');
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
            });
        });
    }
});

function checkForUpdate() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
                reg.update().then(() => {
                    alert('เช็คการอัปเดตเรียบร้อย! หากมีเวอร์ชันใหม่ระบบจะรีโหลดแอปให้อัตโนมัติ');
                });
            } else {
                alert('แอปเวอร์ชันล่าสุดแล้ว');
            }
        });
    } else {
        window.location.reload();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function selectCharacter(char) {
    selectedCharacter = char;
    document.getElementById('card-potter').classList.toggle('selected', char === 'POTTER');
    document.getElementById('card-winner').classList.toggle('selected', char === 'WINNER');
}

function selectMode(mode) {
    selectedMode = mode;
    document.getElementById('mode-sandbox').classList.toggle('selected', mode === 'SANDBOX');
    document.getElementById('mode-normal').classList.toggle('selected', mode === 'NORMAL');
    document.getElementById('mode-adventure').classList.toggle('selected', mode === 'ADVENTURE');
    
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
}

function updateSpeed(val) {
    gameSpeed = parseFloat(val);
    document.getElementById('speedVal').innerText = val;
}

function startGame() {
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    document.getElementById('sandbox-controls').classList.toggle('hidden', selectedMode !== 'SANDBOX');
    document.getElementById('normal-controls').classList.toggle('hidden', selectedMode !== 'NORMAL');
    document.getElementById('adventure-controls').classList.toggle('hidden', selectedMode !== 'ADVENTURE');

    resizeCanvas();
    isRunning = true;
    score = 0;
    bgOffset = 0;
    obstacles = [];
    gameLoop();
}

function backToMenu() {
    isRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('selection-screen').classList.remove('hidden');
}

const biomes = [
    { name: ' mountain 🏔️ ภูเขาสูงสดชื่น', sky: ['#6baed6', '#9ecae1'], mountain: '#3182bd', ground: '#41ab5d', foliage: '#238b45' },
    { name: ' ocean 🌊 ทะเลและหาดทราย', sky: ['#4292c6', '#9ecae1'], mountain: '#08519c', ground: '#fec44f', foliage: '#006d2c' },
    { name: ' ricefield 🌾 ทุ่งนาทองคำ', sky: ['#fed976', '#ffdda1'], mountain: '#d95f0e', ground: '#fecc5c', foliage: '#74c476' },
    { name: ' garden 🌸 สวนดอกไม้ป่า', sky: ['#c6dbef', '#fcbba1'], mountain: '#756bb1', ground: '#a1d99b', foliage: '#e7298a' },
    { name: ' river 🏞️ ลำห้วยแม่น้ำ', sky: ['#9ecae1', '#c6dbef'], mountain: '#2b8cbe', ground: '#74c476', foliage: '#005a32' },
    { name: ' forest 🌲 ป่าดงพงไพร', sky: ['#41ab5d', '#a1d99b'], mountain: '#00441b', ground: '#238b45', foliage: '#002500' },
    { name: ' grassland 🌿 ทุ่งหญ้ากว้างใหญ่', sky: ['#80b1d3', '#b3de69'], mountain: '#b3de69', ground: '#8dd3c7', foliage: '#33a02c' }
];

function gameLoop() {
    if (!isRunning) return;

    updateGame();
    renderGame();

    animationFrameId = requestAnimationFrame(gameLoop);
}

function updateGame() {
    bgOffset += gameSpeed;
    score += Math.floor(gameSpeed / 2);

    if (selectedMode === 'NORMAL') {
        document.getElementById('scoreVal').innerText = score;
    } else if (selectedMode === 'ADVENTURE') {
        document.getElementById('questText').innerText = `สำรวจ ${score}/1000M`;
        if (score >= 1000) {
            alert('🎉 ยินดีด้วย! พิชิตภารกิจ PotterWinner ผจญภัยสำเร็จ!');
            backToMenu();
            return;
        }
    }

    if (selectedMode !== 'SANDBOX' && Math.random() < 0.015) {
        obstacles.push({ x: canvas.width, type: 'ก้อนหิน 🪨' });
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].x -= gameSpeed;

        if (obstacles[i].x > 100 && obstacles[i].x < 160) {
            if (selectedMode === 'SANDBOX') {
                showToast();
            } else {
                alert('💥 ชนสิ่งกีดขวาง! จบการเดินทาง (ระยะทาง: ' + score + ' M)');
                backToMenu();
                return;
            }
        }
    }

    obstacles = obstacles.filter(obs => obs.x > -50);
}

function renderGame() {
    let width = canvas.width;
    let height = canvas.height;

    let biomeIndex = Math.floor((bgOffset / 1500) % biomes.length);
    let currentBiome = biomes[biomeIndex];
    document.getElementById('biomeName').innerText = currentBiome.name;

    // 1. Sky Gradient
    let skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    skyGradient.addColorStop(0, currentBiome.sky[0]);
    skyGradient.addColorStop(1, currentBiome.sky[1]);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Mountains
    ctx.fillStyle = currentBiome.mountain;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.65);
    for (let x = 0; x <= width; x += 60) {
        let mY = height * 0.45 + Math.sin((x + bgOffset * 0.2) * 0.008) * 50 + Math.cos(x * 0.02) * 15;
        ctx.lineTo(x, mY);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    // 3. Ground
    ctx.fillStyle = currentBiome.ground;
    ctx.fillRect(0, height * 0.65, width, height * 0.35);

    // 4. Moving Decor
    ctx.fillStyle = currentBiome.foliage;
    for (let i = 0; i < 8; i++) {
        let decorX = ((i * 180 - bgOffset) % (width + 120));
        if (decorX < -60) decorX += width + 120;

        let groundY = height * 0.65;
        if (currentBiome.name.includes('ทะเล')) {
            ctx.fillStyle = '#8c510a';
            ctx.fillRect(decorX + 35, groundY - 60, 10, 60);
            ctx.fillStyle = '#006d2c';
            ctx.beginPath();
            ctx.arc(decorX + 40, groundY - 65, 25, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#5C4033';
            ctx.fillRect(decorX + 35, groundY - 70, 14, 70);
            ctx.fillStyle = currentBiome.foliage;
            ctx.beginPath();
            ctx.arc(decorX + 42, groundY - 80, 32, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 5. Draw Obstacles
    ctx.font = '28px Arial';
    obstacles.forEach(obs => {
        ctx.fillText('🪨', obs.x, height * 0.72);
    });

    // 6. Character Photo Icon Rendering
    let bounce = Math.sin(bgOffset * 0.12) * 6;
    let charImg = selectedCharacter === 'POTTER' ? imgPotter : imgWinner;
    let displayName = selectedCharacter === 'POTTER' ? 'POTTER (พอตเตอร์)' : 'WINNER (วินเนอร์)';
    
    let charX = 120;
    let charY = height * 0.62 + bounce;
    let radius = 34;

    ctx.save();
    ctx.beginPath();
    ctx.arc(charX, charY, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(charImg, charX - radius, charY - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(charX, charY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Kanit';
    ctx.fillText(displayName, charX - 45, charY + radius + 18);
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 1500);
}
