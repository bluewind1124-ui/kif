/*
 * 한보금on 활동지원 — 계정 서버 (Cloudflare Worker)
 *
 * 하는 일: 로그인 확인, 계정 신청·승인, 비밀번호 변경, 비밀번호 분실 시 초기화 요청.
 * 보관하는 것: 아이디, 비밀번호(되돌릴 수 없는 형태로만), 권한(FC/관리자), 상태(승인 대기/사용/정지).
 *   이름·소속·고객 자료는 이 서버에 없습니다. 고객 자료는 각자의 기기·개인 클라우드에 저장합니다.
 * 비밀번호 원문은 서버로 오지 않습니다. 포털이 폰·PC에서 먼저 풀 수 없는 값(PBKDF2)으로 바꿔 보내고,
 *   서버는 그 값을 한 번 더 섞어(SHA-256 + 계정마다 다른 소금값) 저장합니다.
 *
 * Cloudflare 설정 (Settings → Bindings / Variables and Secrets)
 *   ACCOUNTS        KV 연결(필수)   계정 목록을 넣어 두는 저장 공간
 *   SECRET          Secret(필수)    아무 긴 글자 40자 이상 — 로그인 증표 서명용, 남에게 알려 주지 않음
 *   ADMIN_ID        Text(필수)      처음 관리자 아이디. 이 아이디로 「계정 신청」하면 바로 관리자가 됨
 *   ALLOWED_ORIGINS Text(선택)      쉼표로 구분. 기본: 포털 주소(https://bluewind1124-ui.github.io)
 *   DATA_REPO       Text(자료 잠금)  자료가 든 비공개 저장소. 예: bluewind1124-ui/kif-data
 *   DATA_TOKEN      Secret(자료 잠금) 그 저장소를 「읽기만」 할 수 있는 GitHub 키
 *
 * 자료 내주기 (v2, 2026-11-13): GET /d/<경로>?t=<로그인 증표>
 *   로그인 증표가 맞을 때만 비공개 저장소에서 파일을 꺼내 준다. 로그인 안 한 사람은 401.
 *   내줄 수 있는 경로: content.json, files/, news/, refs/, classic/data/, classic/base/, classic/cmp_, uw/
 */
const DEFAULT_ORIGINS = 'https://bluewind1124-ui.github.io,http://localhost:8770,http://127.0.0.1:8770';
const TOKEN_HOURS = 12;
const MAX_FAIL = 10, LOCK_MIN = 10;
const ID_RE = /^[a-z0-9._-]{3,30}$/;

const DATA_OK = /^(content\.json$|files\/|news\/|refs\/|classic\/data\/|classic\/base\/|classic\/cmp_[^/]+\.html?$|uw\/[^/]+\.json$)/;
const MIME = { pdf: 'application/pdf', json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', mp3: 'audio/mpeg',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', js: 'text/javascript; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hwp: 'application/x-hwp', zip: 'application/zip' };

/* 로그인한 사람에게만 비공개 저장소의 파일을 내준다.
   content.json은 늘 새로 받고, 나머지 파일(이름에 임의 글자가 붙어 바뀌지 않음)은 5분 동안 클라우드플레어에 잠시 보관해 GitHub 요청을 줄인다. */
async function serveData(req, env, url, cors) {
  const deny = (st, msg) => new Response(JSON.stringify({ ok: false, error: msg }), { status: st, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.DATA_REPO || !env.DATA_TOKEN) return deny(500, '자료 저장소 설정(DATA_REPO · DATA_TOKEN)이 끝나지 않았습니다.');
  let path;
  try { path = decodeURIComponent(url.pathname.slice(3)); } catch (e) { return deny(400, '주소 형식이 잘못되었습니다.'); }
  if (!path || path.includes('..') || path.includes('\\') || !DATA_OK.test(path)) return deny(404, '없는 자료입니다.');
  const auth = req.headers.get('Authorization') || '';
  const t = url.searchParams.get('t') || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  const tk = await readToken(env, t);
  if (!tk) return deny(401, '로그인이 필요합니다. 포털에 다시 로그인하세요.');
  const fresh = path === 'content.json' || /\.json$/.test(path);
  const key = new Request('https://kif-data.cache/' + encodeURI(path));
  const cache = caches.default;
  const range = req.headers.get('Range');
  let res = (!fresh && !range) ? await cache.match(key) : null;
  if (!res) {
    const gh = 'https://api.github.com/repos/' + env.DATA_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(env.DATA_BRANCH || 'main');
    const h = { 'Authorization': 'Bearer ' + env.DATA_TOKEN, 'Accept': 'application/vnd.github.raw', 'User-Agent': 'kif-auth', 'X-GitHub-Api-Version': '2022-11-28' };
    if (range) h['Range'] = range;
    const r = await fetch(gh, { headers: h });
    if (r.status === 404) return deny(404, '없는 자료입니다.');
    if (!r.ok && r.status !== 206) return deny(502, '자료 저장소에서 파일을 받지 못했습니다(' + r.status + ').');
    const ext = (path.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    const hd = new Headers();
    hd.set('content-type', MIME[ext] || 'application/octet-stream');
    for (const k of ['content-length', 'content-range', 'etag', 'accept-ranges']) { const v = r.headers.get(k); if (v) hd.set(k, v); }
    hd.set('cache-control', fresh ? 'no-store' : 'public, max-age=300');
    res = new Response(r.body, { status: r.status, headers: hd });
    if (!fresh && !range && r.status === 200) await cache.put(key, res.clone());
  }
  const o = new Headers(res.headers);
  for (const k in cors) o.set(k, cors[k]);
  o.set('cache-control', fresh ? 'no-store' : 'private, max-age=300'); /* 브라우저에만 잠시, 중간 서버에는 남기지 않음 */
  o.set('x-content-type-options', 'nosniff');
  if (url.searchParams.get('dl')) o.set('content-disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(path.split('/').pop()));
  return new Response(req.method === 'HEAD' ? null : res.body, { status: res.status, headers: o });
}

const enc = new TextEncoder();
const b64 = (u8) => { let s = ''; u8 = new Uint8Array(u8); for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
const same = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function mix(salt, ph) { // 저장용: SHA-256(소금값 + 포털이 보낸 값)
  const h = await crypto.subtle.digest('SHA-256', new Uint8Array([...unb64(salt), ...unb64(ph)]));
  return b64(h);
}
async function setPw(rec, ph) { const s = b64(crypto.getRandomValues(new Uint8Array(16))); rec.s = s; rec.h = await mix(s, ph); }
async function checkPw(rec, ph) { return !!rec && !!rec.h && same(await mix(rec.s, ph), rec.h); }

async function hmac(env, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))));
}
async function makeToken(env, rec) {
  const p = b64u(JSON.stringify({ id: rec.id, role: rec.role, exp: Date.now() + TOKEN_HOURS * 3600e3 }));
  return p + '.' + await hmac(env, p);
}
async function readToken(env, t) {
  if (typeof t !== 'string' || t.indexOf('.') < 0) return null;
  const [p, sig] = t.split('.');
  if (!same(await hmac(env, p), sig)) return null;
  try { const o = JSON.parse(unb64u(p)); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}

async function loadUsers(env) { return (await env.ACCOUNTS.get('users', 'json')) || {}; }
async function saveUsers(env, u) { await env.ACCOUNTS.put('users', JSON.stringify(u)); }
const pub = (r) => ({ id: r.id, role: r.role, st: r.st, ca: r.ca || 0, la: r.la || 0, rq: r.rq || null, must: !!r.must });
const normId = (id) => String(id || '').trim().toLowerCase();
const okPh = (ph) => typeof ph === 'string' && ph.length >= 40 && ph.length <= 100;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allow = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allow.includes('*') || allow.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allow[0],
      'Access-Control-Allow-Methods': 'POST, GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
    const fail = (status, msg) => out(status, { ok: false, error: msg });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'content-type, authorization, range' } });
    const url = new URL(req.url);
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/d/')) return serveData(req, env, url, { ...cors, 'Access-Control-Allow-Origin': okOrigin ? origin : '*', 'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges' });
    const ready = !!(env.ACCOUNTS && env.SECRET && String(env.SECRET).length >= 20 && env.ADMIN_ID);
    if (req.method === 'GET') return out(200, { ok: true, service: '한보금on 활동지원 계정 서버', ready, data: !!(env.DATA_REPO && env.DATA_TOKEN), ver: 2,
      missing: [!env.ACCOUNTS && 'ACCOUNTS(KV 연결)', !(env.SECRET && String(env.SECRET).length >= 20) && 'SECRET(20자 이상)', !env.ADMIN_ID && 'ADMIN_ID'].filter(Boolean) });
    if (req.method !== 'POST') return fail(405, 'POST만 받습니다.');
    if (!okOrigin) return fail(403, '허용되지 않은 사이트에서 온 요청입니다.');
    if (!ready) return fail(500, '계정 서버 설정이 끝나지 않았습니다(ACCOUNTS · SECRET · ADMIN_ID).');

    let b; try { b = await req.json(); } catch (e) { return fail(400, '요청 형식이 잘못되었습니다.'); }
    const op = String(b.op || ''), now = Date.now(), id = normId(b.id);
    const users = await loadUsers(env);

    /* ---- 누구나 ---- */
    if (op === 'signup') {
      if (!ID_RE.test(id)) return fail(400, '아이디는 영문 소문자·숫자 3~30자로 정해 주세요.');
      if (!okPh(b.ph)) return fail(400, '비밀번호 형식이 잘못되었습니다.');
      if (users[id]) return fail(409, users[id].st === 'pending' ? '이미 신청한 아이디입니다. 관리자 승인을 기다려 주세요.' : '이미 있는 아이디입니다.');
      const isAdmin = id === normId(env.ADMIN_ID);
      const rec = { id, role: isAdmin ? 'admin' : 'fc', st: isAdmin ? 'on' : 'pending', ca: now };
      await setPw(rec, b.ph); users[id] = rec; await saveUsers(env, users);
      return out(200, { ok: true, st: rec.st });
    }
    if (op === 'login') {
      const r = users[id];
      if (r && r.lock && r.lock > now) return fail(429, '비밀번호를 여러 번 틀려 잠시 잠겼습니다. ' + Math.ceil((r.lock - now) / 60000) + '분 뒤 다시 시도하세요.');
      if (!okPh(b.ph) || !(await checkPw(r, b.ph))) {
        if (r) { r.fail = (r.fail || 0) + 1; if (r.fail >= MAX_FAIL) { r.lock = now + LOCK_MIN * 60e3; r.fail = 0; } await saveUsers(env, users); }
        return fail(401, '아이디 또는 비밀번호가 맞지 않습니다.');
      }
      if (r.st === 'pending') return fail(403, '아직 관리자 승인 전입니다. 승인되면 로그인할 수 있습니다.');
      if (r.st === 'off') return fail(403, '사용이 정지된 계정입니다. 본사에 문의하세요.');
      let dirty = false;
      if (r.fail || r.lock) { r.fail = 0; r.lock = 0; dirty = true; }
      if (!r.la || now - r.la > 20 * 3600e3) { r.la = now; dirty = true; } // 접속 기록은 하루 한 번만 저장(무료 사용량 아끼기)
      if (dirty) await saveUsers(env, users);
      return out(200, { ok: true, token: await makeToken(env, r), id: r.id, role: r.role, must: !!r.must, exp: now + TOKEN_HOURS * 3600e3 });
    }
    if (op === 'forgot') {
      const r = users[id];
      if (r && r.st !== 'pending' && !(r.rq && now - r.rq.at < 3600e3)) { r.rq = { t: 'reset', at: now }; await saveUsers(env, users); }
      return out(200, { ok: true }); // 아이디가 있는지는 알려 주지 않음
    }

    /* ---- 로그인한 사람 ---- */
    const tk = await readToken(env, b.token);
    const me = tk && users[tk.id];
    if (!me || me.st !== 'on') return fail(401, '로그인이 끝났습니다. 다시 로그인하세요.');
    if (op === 'check') return out(200, { ok: true, id: me.id, role: me.role, must: !!me.must });
    if (op === 'change') {
      if (!okPh(b.ph) || !okPh(b.nph)) return fail(400, '비밀번호 형식이 잘못되었습니다.');
      if (!(await checkPw(me, b.ph))) return fail(401, '지금 비밀번호가 맞지 않습니다.');
      await setPw(me, b.nph); me.must = false; me.rq = null; await saveUsers(env, users);
      return out(200, { ok: true });
    }

    /* ---- 관리자 ---- */
    if (me.role !== 'admin') return fail(403, '관리자만 할 수 있습니다.');
    if (op === 'list') return out(200, { ok: true, users: Object.values(users).map(pub).sort((a, b) => (a.st === 'pending' ? -1 : 0) - (b.st === 'pending' ? -1 : 0) || a.id.localeCompare(b.id)) });
    if (op === 'create') {
      if (!ID_RE.test(id)) return fail(400, '아이디는 영문 소문자·숫자 3~30자로 정해 주세요.');
      if (users[id]) return fail(409, '이미 있는 아이디입니다.');
      if (!okPh(b.nph)) return fail(400, '비밀번호 형식이 잘못되었습니다.');
      const rec = { id, role: b.role === 'admin' ? 'admin' : 'fc', st: 'on', ca: now, must: true };
      await setPw(rec, b.nph); users[id] = rec; await saveUsers(env, users);
      return out(200, { ok: true });
    }
    const r = users[id];
    if (!r) return fail(404, '그 아이디가 없습니다.');
    if (r.id === me.id && ['stop', 'delete', 'reject', 'role'].includes(op)) return fail(400, '지금 로그인한 본인 계정에는 할 수 없습니다.');
    if (op === 'approve') r.st = 'on';
    else if (op === 'reject') { if (r.st !== 'pending') return fail(400, '승인 대기 중인 신청만 거절할 수 있습니다.'); delete users[id]; }
    else if (op === 'stop') r.st = 'off';
    else if (op === 'resume') r.st = 'on';
    else if (op === 'delete') delete users[id];
    else if (op === 'role') r.role = b.role === 'admin' ? 'admin' : 'fc';
    else if (op === 'reset') { if (!okPh(b.nph)) return fail(400, '비밀번호 형식이 잘못되었습니다.'); await setPw(r, b.nph); r.must = true; r.rq = null; r.fail = 0; r.lock = 0; if (r.st === 'pending') r.st = 'on'; }
    else if (op === 'dismiss') r.rq = null;
    else return fail(400, '알 수 없는 요청입니다.');
    await saveUsers(env, users);
    return out(200, { ok: true });
  },
};
