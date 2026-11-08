/* Cartelera + votaciones (Supabase). Un voto por persona y combate, validado en la base de datos. */
(() => {
  const $ = id => document.getElementById(id);
  const MSG_DUP = 'YA REGISTRASTE TU VOTO EN ESTE COMBATE. NO PUEDES VOLVER A VOTAR NI CAMBIAR TU ELECCIÓN.';
  const FIGHTS = [
    {id: 'round1', badge: 'ROUND 1', t: 'Primer Round', a: 'PANDY', b: 'JORGE'},
    {id: 'round2', badge: 'ROUND 2', t: 'Segundo Round — Pelea de Hermanos', a: 'JEFFERSON', b: 'PATRICK'},
    {id: 'round3', badge: 'ROUND 3', t: 'Tercer Round', a: 'ADRIANO', b: 'ANGELO'},
    {id: 'exhibicion', badge: 'EXHIBICIÓN', t: 'Pelea de Exhibición', a: 'ROGER', b: 'JOSÉ CARLOS'},
    {id: 'sorpresa', badge: 'SORPRESA', t: 'Pelea Sorpresa de Entretiempo', a: 'PARTICIPANTE SORPRESA', b: 'PARTICIPANTE SORPRESA', corner: true}
  ];
  const cfg = window.VELADA_CONFIG || {};
  const sb = window.supabase && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('TU-PROYECTO')
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const totals = {}, mine = {}, busy = new Set(); let user = null;
  const label = (f, k) => f.corner ? (k === 1 ? 'ESQUINA ROJA' : 'ESQUINA DORADA') : (k === 1 ? f.a : f.b);

  const side = (f, k) => `<div class="side sd${k}"><span class="corner">${k === 1 ? 'Esquina roja' : 'Esquina dorada'}</span>
    <strong class="nm">${k === 1 ? f.a : f.b}</strong><b class="pc">0 %</b><span class="vt">0 VOTOS</span>
    <button class="vote" type="button" data-f="${f.id}" data-c="${k}">VOTAR ${f.corner ? label(f, k) : 'POR ' + label(f, k)}</button></div>`;
  FIGHTS.forEach(f => {
    const el = document.createElement('article'); el.className = 'fight'; el.id = 'f-' + f.id;
    el.innerHTML = `<header><span class="badge">${f.badge}</span><h3>${f.t}</h3></header>
      <div class="ring">${side(f, 1)}<div class="vs">VS</div>${side(f, 2)}</div>
      <div class="bar"><i class="ba"></i><i class="bb"></i></div><p class="fav"></p><p class="state" role="status"></p>`;
    $('cards').append(el);
  });

  function paint(f) {
    const t = totals[f.id] || {a: 0, b: 0}, tot = t.a + t.b, el = $('f-' + f.id), v = mine[f.id];
    const pa = tot ? Math.round(t.a / tot * 100) : 0, pb = tot ? 100 - pa : 0;
    el.querySelector('.sd1 .pc').textContent = pa + ' %'; el.querySelector('.sd2 .pc').textContent = pb + ' %';
    el.querySelector('.sd1 .vt').textContent = t.a + (t.a === 1 ? ' VOTO' : ' VOTOS');
    el.querySelector('.sd2 .vt').textContent = t.b + (t.b === 1 ? ' VOTO' : ' VOTOS');
    el.querySelector('.ba').style.width = (tot ? t.a / tot * 100 : 0) + '%';
    el.querySelector('.bb').style.width = (tot ? t.b / tot * 100 : 0) + '%';
    el.querySelector('.fav').textContent = !tot ? 'TODAVÍA NO HAY VOTOS.' : t.a === t.b ? 'EMPATE EN LAS VOTACIONES.'
      : 'FAVORITO DEL PÚBLICO: ' + (t.a > t.b ? label(f, 1) : label(f, 2));
    el.classList.toggle('lead1', t.a > t.b); el.classList.toggle('lead2', t.b > t.a);
    el.classList.toggle('voted', !!v);
    el.querySelectorAll('.side').forEach((s, i) => s.classList.toggle('mine', v === i + 1));
    el.querySelectorAll('.vote').forEach(b => { b.setAttribute('aria-disabled', v ? 'true' : 'false'); b.tabIndex = v ? -1 : 0; });
    el.querySelector('.state').innerHTML = v ? 'VOTO REGISTRADO CORRECTAMENTE<br><small>TU ELECCIÓN YA NO SE PUEDE MODIFICAR.</small>' : '';
  }
  const paintAll = () => FIGHTS.forEach(paint);
  paintAll();

  let tt; function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 7000); }

  /* ---- Identidad: cuenta real (Google o enlace al correo). Sin anónimos, sin apodos. ---- */
  function renderAuth() {
    $('auth-out').hidden = !!user; $('auth-in').hidden = !user;
    if (user) $('who').textContent = user.email || user.user_metadata?.name || 'Sesión iniciada';
    $('auth-note').hidden = !!sb;
  }
  async function loadMine() {
    Object.keys(mine).forEach(k => delete mine[k]);
    if (sb && user) { const {data} = await sb.from('votes').select('fight_id,choice'); (data || []).forEach(r => mine[r.fight_id] = r.choice); }
    paintAll();
  }
  async function refreshTotals() {
    if (!sb) return;
    const {data} = await sb.from('fight_totals').select('*');
    (data || []).forEach(r => totals[r.fight_id] = {a: r.votes_a, b: r.votes_b}); paintAll();
  }
  const back = () => location.href.split('#')[0];
  $('g-login').onclick = () => sb ? sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: back()}}) : toast('Falta conectar Supabase en config.js');
  $('m-login').onclick = async () => {
    const email = $('email').value.trim(); if (!sb) return toast('Falta conectar Supabase en config.js');
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Escribe un correo válido.');
    const {error} = await sb.auth.signInWithOtp({email, options: {emailRedirectTo: back()}});
    toast(error ? 'No se pudo enviar el enlace. Intenta de nuevo.' : 'Te enviamos un enlace a tu correo. Ábrelo para entrar y votar.');
  };
  $('logout').onclick = () => sb && sb.auth.signOut();

  /* ---- Votar ---- */
  $('cards').addEventListener('click', async e => {
    const b = e.target.closest('.vote'); if (!b) return;
    const id = b.dataset.f, c = +b.dataset.c;
    if (mine[id]) return toast(MSG_DUP);
    if (!sb) return toast('Votaciones sin conectar: completa config.js con tu proyecto de Supabase.');
    if (!user) { toast('Inicia sesión para votar (un voto por persona y combate).'); return $('auth').scrollIntoView({behavior: 'smooth', block: 'center'}); }
    if (busy.has(id)) return; busy.add(id);
    try {
    // 1) comprobar en la base de datos si ya votó en este combate
    const {data: ex} = await sb.from('votes').select('choice').eq('fight_id', id).maybeSingle();
    if (ex) { mine[id] = ex.choice; paint(FIGHTS.find(f => f.id === id)); return toast(MSG_DUP); }
    // 2) registrar (el servidor vuelve a validar y la restricción UNIQUE es la garantía final)
    const {error} = await sb.rpc('cast_vote', {p_fight: id, p_choice: c});
    if (!error) { mine[id] = c; paintAll(); return refreshTotals(); }
    if (/ALREADY_VOTED/.test(error.message)) { await loadMine(); return toast(MSG_DUP); }
    paintAll();
    toast(/VOTING_CLOSED/.test(error.message) ? 'La votación de este combate aún no está abierta.' : /LOGIN_REQUIRED/.test(error.message) ? 'Inicia sesión para votar.' : 'No se pudo registrar tu voto. Intenta de nuevo.');
    } finally { busy.delete(id); }
  });

  if (sb) {
    sb.auth.onAuthStateChange((_ev, s) => { user = s && s.user && !s.user.is_anonymous ? s.user : null; renderAuth(); setTimeout(loadMine, 0); });
    refreshTotals();
    sb.channel('totales').on('postgres_changes', {event: '*', schema: 'public', table: 'fight_totals'}, p => {
      const r = p.new; if (r && r.fight_id) { totals[r.fight_id] = {a: r.votes_a, b: r.votes_b}; paintAll(); }
    }).subscribe();
    setInterval(refreshTotals, 30000);
  }
  renderAuth();

  /* ---- Transición hacia la cartelera ---- */
  window.showCartelera = () => {
    const fin = $('final'); fin.classList.add('out');
    setTimeout(() => { fin.hidden = true; }, 1000);
    document.body.classList.add('live'); $('cartelera').hidden = false; window.scrollTo(0, 0);
  };
})();
