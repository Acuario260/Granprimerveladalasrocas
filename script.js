// 8 nov 2026, 9:30 AM Perú (UTC-5) = 14:30 UTC. Se calcula contra el reloj real: no se reinicia al recargar.
const TARGET = Date.UTC(2026, 10, 8, 14, 30, 0);
const $ = id => document.getElementById(id);
const els = {d: $('d'), h: $('h'), m: $('m'), s: $('s')};
const pad = n => String(n).padStart(2, '0');
const START_AT_LOAD = Date.now() >= TARGET; // si entra después de la hora: directo a la velada
let finished = false, burstTimer, timer;

/* ---------- Contador ---------- */
function render() {
  const diff = TARGET - Date.now();
  if (diff <= 0) return finish();
  const t = Math.floor(diff / 1000);
  const v = {d: Math.floor(t / 86400), h: Math.floor(t % 86400 / 3600), m: Math.floor(t % 3600 / 60), s: t % 60};
  for (const k in v) {
    const txt = pad(v[k]);
    if (els[k].textContent !== txt) {
      els[k].textContent = txt;
      els[k].classList.remove('tick'); void els[k].offsetWidth; els[k].classList.add('tick');
      if (k === 's') tickSound();
    }
  }
}
function finish() {
  if (finished) return;
  finished = true; clearInterval(timer);
  document.body.classList.add('done');
  if (START_AT_LOAD) return window.showCartelera();
  $('final').hidden = false;
  const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f);
  setTimeout(() => f.remove(), 1500);
  fanfare(); boom();
  setTimeout(window.showCartelera, 9000); // transición automática a la cartelera
  for (let i = 0; i < 6; i++) setTimeout(() => burst(W * (.15 + Math.random() * .7), H * (.2 + Math.random() * .4), LOW ? 55 : 100), i * 350);
  burstTimer = setInterval(() => burst(Math.random() * W, Math.random() * H * .6, LOW ? 30 : 60), 1800);
}

/* ---------- Sonido (sintetizado, sin archivos externos) ---------- */
let ac, master, soundOn = false;
const sndBtn = $('snd');
function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(master);
  [55, 55.4, 82.5].forEach(f => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = f; g.gain.value = .12; o.connect(g); g.connect(lp); o.start(); });
}
function setSound(on) {
  soundOn = on;
  if (on) { initAudio(); ac.resume(); }
  if (ac) master.gain.setTargetAtTime(on ? .5 : 0, ac.currentTime, .3);
  sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
}
function tone(type, f, t0, vol, dur) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .05);
}
function tickSound() { if (soundOn && ac) tone('square', 1200, ac.currentTime, .04, .05); }
function fanfare() { if (soundOn && ac) [261.6, 329.6, 392, 523.3].forEach((f, i) => tone('triangle', f, ac.currentTime + i * .12, .25, 2.2)); }
function boom() { if (!(soundOn && ac)) return; const t = ac.currentTime; tone('sine', 70, t, .6, 1.6); tone('sawtooth', 110, t, .15, 1.2); }
sndBtn.onclick = () => setSound(!soundOn);

/* ---------- Introducción ---------- */
const intro = $('intro');
function enter(withSound) {
  setSound(withSound);
  intro.classList.add('out'); setTimeout(() => intro.remove(), 1000);
}
$('enter').onclick = () => enter(true);
$('enterMute').onclick = () => enter(false);

/* ---------- Canvas: calidad adaptable según el dispositivo ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = reduced || innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4;
const cv = $('fx'), ctx = cv.getContext('2d');
let W, H, smoke = [], sparks = [], bursts = [];
const rnd = (a, b) => a + Math.random() * (b - a);
function resize() {
  const r = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
}
addEventListener('resize', resize); resize();

const small = innerWidth < 700;
for (let i = 0; i < (LOW ? 8 : 22); i++) smoke.push({x: rnd(0, W), y: rnd(0, H), r: rnd(small ? 120 : 200, small ? 240 : 420), vx: rnd(-.25, .25), vy: rnd(-.35, -.08), a: rnd(.05, .13), hot: Math.random() < .3});
const newSpark = init => ({x: rnd(0, W), y: init ? rnd(0, H) : H + 10, r: rnd(.6, 2.4), vy: rnd(.4, 1.6), vx: rnd(-.3, .3), ph: rnd(0, 6.28), c: Math.random() < .5 ? '255,196,0' : '255,106,0'});
for (let i = 0; i < (LOW ? 35 : 120); i++) sparks.push(newSpark(true));

function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), s = rnd(2, 9);
    bursts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, r: rnd(1, 3.2), c: Math.random() < .6 ? '255,200,40' : '255,255,255'});
  }
}
function glow(x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, 6.28); ctx.fill();
}

let tm = 0, last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden || now - last < (LOW ? 33 : 16)) return; // 30 fps en celulares, pausa si la pestaña está oculta
  last = now; tm += .016;
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of smoke) {
    if (!reduced) { p.x += p.vx; p.y += p.vy; }
    if (p.y < -p.r) { p.y = H + p.r; p.x = rnd(0, W); }
    if (p.x < -p.r) p.x = W + p.r; if (p.x > W + p.r) p.x = -p.r;
    const c = p.hot ? '255,110,20' : '170,170,180', g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, `rgba(${c},${p.a})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
  }
  sparks.forEach((s, i) => {
    if (!reduced) { s.y -= s.vy; s.x += s.vx + Math.sin(tm * 2 + s.ph) * .4; }
    if (s.y < -10) sparks[i] = newSpark(false);
    glow(s.x, s.y, s.r, s.c, .5 + .5 * Math.sin(tm * 4 + s.ph));
  });
  if (!reduced && Math.random() < .015) bursts.push({x: rnd(0, W), y: rnd(0, H * .7), vx: 0, vy: 0, life: .9, r: rnd(6, 12), c: '255,230,150', star: true});
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.x += b.vx; b.y += b.vy; b.vx *= .98; b.vy = b.vy * .98 + (b.star ? 0 : .06); b.life -= b.star ? .03 : .014;
    if (b.life <= 0) { bursts.splice(i, 1); continue; }
    glow(b.x, b.y, b.r, b.c, b.life);
    if (b.star) {
      const l = b.r * 5 * b.life; ctx.strokeStyle = `rgba(255,240,200,${b.life})`; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(b.x - l, b.y); ctx.lineTo(b.x + l, b.y); ctx.moveTo(b.x, b.y - l); ctx.lineTo(b.x, b.y + l); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
requestAnimationFrame(loop);

render();
if (!finished) timer = setInterval(render, 250);
