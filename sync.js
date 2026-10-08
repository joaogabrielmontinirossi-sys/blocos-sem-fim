'use strict';
/* Blocos Sem Fim — sincronização.
   1) Pasta (só no programa de Windows): grava blocos-sem-fim-sync.json numa pasta do Google Drive para computador.
   2) Conta Google (Windows, site e celular): guarda o mesmo arquivo na área do app no Google Drive.
   Nos dois casos a mescla é por peça: vale a versão mais recente, e as exclusões são propagadas (ver merge() em app.js). */

const GAPI = 'https://www.googleapis.com/';
const PORT = 47896;
const NAME = 'blocos-sem-fim-sync.json';
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const Sync = {
  avail: false, on: false, folder: null, detected: null, drives: [], busy: false, again: false, last: 0, error: '',
  g: { token: '', exp: 0, last: 0, error: '', file: null },

  api: (path, opt = {}) => fetch('/api/' + path, Object.assign({}, opt, { headers: Object.assign({ 'X-BSF': '1' }, opt.headers) })),
  async init() {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) try { const r = await Sync.api('sync/info'); if (r.ok && (r.headers.get('content-type') || '').includes('json')) { Sync.avail = true; Sync.info(await r.json()); } } catch (e) {}
    try { const t = JSON.parse(localStorage.getItem('blocos-sem-fim-g') || 'null'); if (t && t.exp > Date.now() + 60000) { Sync.g.token = t.token; Sync.g.exp = t.exp; } } catch (e) {}
    BSF.onChange = () => Sync.soon();
    Sync.chip();
    await Sync.run();
    setInterval(() => { if (!document.hidden) Sync.run(); }, 30000);
    addEventListener('focus', () => Sync.run());
    addEventListener('online', () => Sync.run());
  },
  info(i) { Sync.on = !!i.enabled; Sync.folder = i.folder; Sync.detected = i.detected; Sync.drives = i.drives || []; },
  soon: debounce(() => Sync.run(), 1500),
  gOn: () => !!(BSF.set.gClient && Sync.g.token && Sync.g.exp > Date.now()),
  any: () => Sync.on || Sync.gOn(),
  status() {
    if (!Sync.any()) return BSF.set.gClient && BSF.set.gWas ? 'Reconectar Google' : 'Só neste aparelho';
    const err = Sync.error || Sync.g.error, last = Math.max(Sync.last, Sync.g.last);
    return err ? 'Falha na sincronização' : last ? 'Sincronizado ' + new Date(last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Sincronizando…';
  },
  chip() { const c = document.querySelector('#syncChip'); if (c) c.textContent = Sync.status(); if (!document.querySelector('#syncPanel').hidden && !Sync.typing()) Sync.render(); },
  typing: () => document.activeElement && document.activeElement.id === 'gClient',

  async run() {
    if (Sync.busy) { Sync.again = true; return; }
    if (!Sync.any()) { Sync.chip(); return; }
    Sync.busy = true;
    if (Sync.on) { try { await Sync.folderSync(); Sync.error = ''; Sync.last = Date.now(); } catch (e) { console.warn(e); Sync.error = 'A pasta de sincronização não está acessível.'; } }
    if (Sync.gOn() && navigator.onLine !== false) {
      try { await Sync.driveSync(); Sync.g.error = ''; Sync.g.last = Date.now(); } catch (e) { console.warn(e); Sync.g.error = e.message || 'Falha ao falar com o Google.'; }
    }
    Sync.busy = false;
    Sync.chip();
    if (Sync.again) { Sync.again = false; Sync.soon(); }
  },

  /* ---------- 1) Pasta ---------- */
  async folderSync() {
    const r = await Sync.api('sync');
    if (r.status === 409) { Sync.on = false; return; }
    const remote = r.status === 200 ? await r.json().catch(() => null) : null;
    if (remote) BSF.merge(remote);
    const local = BSF.payload();
    if (!remote || BSF.print(remote) !== BSF.print(local)) { const w = await Sync.api('sync', { method: 'POST', body: JSON.stringify(local) }); if (!w.ok) throw new Error('gravação'); }
  },
  async config(v) { const r = await Sync.api(v === 'choose' ? 'sync/choose' : 'sync/config', { method: 'POST', body: v === 'choose' ? '' : v }); Sync.info(await r.json()); Sync.error = ''; Sync.last = 0; await Sync.run(); },

  /* ---------- 2) Conta Google (área de dados do app no Drive) ---------- */
  gis: () => Sync._gis || (Sync._gis = new Promise((res, rej) => { if (window.google && google.accounts) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => { Sync._gis = null; rej(new Error('Sem acesso ao Google. Verifique a internet.')); }; document.head.appendChild(s); })),
  // Abre a janela do Google. Precisa partir de um clique do usuário (os navegadores bloqueiam janelas espontâneas).
  async connect() {
    if (!BSF.set.gClient) throw new Error('Informe o ID do cliente OAuth.');
    await Sync.gis();
    const tok = await new Promise((res, rej) => {
      const c = google.accounts.oauth2.initTokenClient({ client_id: BSF.set.gClient.trim(), scope: 'https://www.googleapis.com/auth/drive.appdata', callback: r => r.error ? rej(new Error(r.error_description || r.error)) : res(r), error_callback: e => rej(new Error(e.type === 'popup_closed' ? 'A janela do Google foi fechada.' : e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google.' : (e.message || 'Falha na autorização.'))) });
      c.requestAccessToken({ prompt: BSF.set.gWas ? '' : 'consent' });
    });
    Sync.g.token = tok.access_token; Sync.g.exp = Date.now() + (tok.expires_in - 90) * 1000; Sync.g.error = ''; Sync.g.file = null;
    localStorage.setItem('blocos-sem-fim-g', JSON.stringify({ token: Sync.g.token, exp: Sync.g.exp }));
    BSF.set.gWas = true; BSF.saveSet();
    await Sync.run();
  },
  disconnect() {
    try { if (window.google && Sync.g.token) google.accounts.oauth2.revoke(Sync.g.token, () => {}); } catch (e) {}
    Sync.g.token = ''; Sync.g.exp = 0; localStorage.removeItem('blocos-sem-fim-g'); BSF.set.gWas = false; BSF.saveSet();
  },
  async gfetch(path, opt = {}) {
    const r = await fetch(GAPI + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + Sync.g.token }, opt.headers) }));
    if (r.status === 401) { Sync.g.token = ''; localStorage.removeItem('blocos-sem-fim-g'); throw new Error('A sessão do Google expirou. Clique em “Reconectar”.'); }
    if (!r.ok && r.status !== 404) { let msg = 'Google respondeu ' + r.status; try { msg = (await r.json()).error.message || msg; } catch (e) {} throw new Error(msg); }
    return r;
  },
  async driveSync() {
    if (!Sync.g.file) { const j = await (await Sync.gfetch(`drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${NAME}'`)}&fields=files(id)`)).json(); Sync.g.file = (j.files && j.files[0] && j.files[0].id) || null; }
    let remote = null;
    if (Sync.g.file) { const r = await Sync.gfetch(`drive/v3/files/${Sync.g.file}?alt=media`); if (r.ok) remote = await r.json().catch(() => null); else Sync.g.file = null; }
    if (remote) BSF.merge(remote);
    const local = BSF.payload();
    if (remote && BSF.print(remote) === BSF.print(local)) return;
    const body = JSON.stringify(local);
    if (Sync.g.file) await Sync.gfetch(`upload/drive/v3/files/${Sync.g.file}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    else {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
      form.append('file', new Blob([body], { type: 'application/json' }));
      Sync.g.file = (await (await Sync.gfetch('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form })).json()).id;
    }
  },

  /* ---------- painel ---------- */
  open() { document.querySelector('#syncPanel').hidden = false; Sync.render(); },
  close() { document.querySelector('#syncPanel').hidden = true; },
  render() {
    const s = BSF.set, gOn = Sync.gOn();
    document.querySelector('#syncBody').innerHTML = `
    ${Sync.avail ? `<section><h2>Pasta do Google Drive para computador</h2>
      <p>${Sync.on ? `Ativa em <b>${esc(Sync.folder)}</b>${Sync.error ? ' · ' + esc(Sync.error) : ''}` : Sync.detected ? 'Desativada.' : 'Não encontrei o Google Drive neste computador; escolha uma pasta sincronizada.'}</p>
      <div class="row">${Sync.drives.filter(d => d !== Sync.folder).map(d => `<button class="btn" data-act="use" data-path="${esc(d)}">Usar ${esc(d)}</button>`).join('')}
        <button class="btn" data-act="pick">Escolher pasta…</button>${Sync.on ? `<button class="btn" data-act="off">Desativar</button>` : ''}</div></section>` : ''}
    <section><h2>Conta Google (Windows, site e celular)</h2>
      <p>${gOn ? `Conectada${Sync.g.error ? ' · ' + esc(Sync.g.error) : ''}. O arquivo ${NAME} fica na área privada do app no seu Google Drive.` : 'Use o mesmo ID de cliente em todos os aparelhos para ver as mesmas construções.'}</p>
      <label class="fld" for="gClient">ID do cliente OAuth<input id="gClient" value="${esc(s.gClient)}" placeholder="0000000000-xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
      <div class="row"><button class="btn sun" data-act="connect">${gOn ? 'Sincronizar agora' : s.gWas ? 'Reconectar' : 'Conectar'}</button>${gOn || s.gWas ? `<button class="btn" data-act="disconnect">Desconectar</button>` : ''}</div>
      <details><summary>Como criar o ID do cliente (uma vez só)</summary><ol>
        <li>Abra <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> e crie um projeto, ou use o mesmo dos seus outros aplicativos (o ID já existente serve).</li>
        <li>Em <b>APIs e serviços › Biblioteca</b>, ative a <b>Google Drive API</b>.</li>
        <li>Em <b>Tela de permissão OAuth</b>, escolha <b>Externo</b> e adicione o seu e-mail em <b>Usuários de teste</b>.</li>
        <li>Em <b>Credenciais › Criar credenciais › ID do cliente OAuth</b>, tipo <b>Aplicativo da Web</b>. Em <b>Origens JavaScript autorizadas</b>, adicione:<br><code>https://joaogabrielmontinirossi-sys.github.io</code><br><code>http://localhost:${PORT}</code></li>
        <li>Copie o ID do cliente, cole acima e clique em Conectar. Repita só a colagem nos outros aparelhos.</li></ol></details></section>
    <p class="note">Estado: <b>${esc(Sync.status())}</b>. Alterações feitas em dois aparelhos são mescladas peça por peça; se duas peças ocuparem o mesmo lugar, fica a mais nova.</p>`;
  },
  async act(el) {
    const a = el.dataset.act, busy = async f => { el.disabled = true; try { await f(); } catch (e) { BSF.toast(e.message || 'Não deu certo.'); } Sync.chip(); Sync.render(); };
    if (a === 'use') busy(() => Sync.config(el.dataset.path));
    else if (a === 'pick') { BSF.toast('Escolha a pasta na janela que abriu.'); busy(() => Sync.config('choose')); }
    else if (a === 'off') busy(() => Sync.config('off'));
    else if (a === 'disconnect') { Sync.disconnect(); Sync.chip(); Sync.render(); }
    else if (a === 'connect') {
      const v = document.querySelector('#gClient').value.trim();
      if (!/\.apps\.googleusercontent\.com$/.test(v)) return BSF.toast('Cole o ID do cliente OAuth (termina em .apps.googleusercontent.com).');
      BSF.set.gClient = v; BSF.saveSet(); busy(() => Sync.gOn() ? Sync.run() : Sync.connect());
    }
  },
};
document.querySelector('#syncBody').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) Sync.act(b); });
document.querySelector('#closeSync').onclick = Sync.close;
document.querySelector('#syncPanel').addEventListener('pointerdown', e => { if (e.target.id === 'syncPanel') Sync.close(); });
Sync.init();
