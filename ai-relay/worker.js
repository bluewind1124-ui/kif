/*
 * 한국보험금융 FC 포털 — 회사 AI 중계 서버 (Cloudflare Worker)
 *
 * 하는 일: 포털에서 보낸 질문(가입설계서 글자·사진)을 회사 API 키로 AI 회사에 대신 보내고,
 *          받은 답을 포털로 돌려줍니다. FC는 키 없이 쓰고, 요금은 회사 계정 하나로 나옵니다.
 *
 * 이 파일에는 비밀번호·키가 없습니다. 키는 Cloudflare 화면의 "Secret"에만 넣습니다.
 *
 * Cloudflare 설정값(Settings → Variables and Secrets)
 *   API_KEY          (Secret, 필수)  AI 회사에서 만든 회사 API 키
 *   PROVIDER         (Text, 선택)    claude | openai | gemini  (기본 claude)
 *   MODEL            (Text, 선택)    비우면 아래 기본 모델
 *   ACCESS_CODE      (Secret, 선택)  넣으면 FC가 포털에 같은 코드를 넣어야 씁니다
 *   ALLOWED_ORIGINS  (Text, 선택)    쉼표로 구분. 기본: 회사 포털 주소
 */
const DEFAULT_MODEL = { claude: 'claude-opus-5-5', openai: 'gpt-4.1', gemini: 'gemini-2.5-flash' };
const DEFAULT_ORIGINS = 'https://bluewind1124-ui.github.io';
const MAX_PROMPT = 400000;      // 글자 수
const MAX_IMAGES = 12;
const MAX_IMAGE_B64 = 7000000;  // 사진 한 장(base64) 약 5MB

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allow = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allow.includes('*') || allow.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? (origin || '*') : allow[0],
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET') return out(200, { ok: true, service: '한국보험금융 FC 포털 AI 중계', provider: env.PROVIDER || 'claude', ready: !!env.API_KEY });
    if (req.method !== 'POST') return out(405, { error: 'POST만 받습니다.' });
    if (!okOrigin) return out(403, { error: '허용되지 않은 사이트에서 온 요청입니다.' });
    if (!env.API_KEY) return out(500, { error: '서버에 API_KEY가 설정되지 않았습니다.' });

    let body;
    try { body = await req.json(); } catch (e) { return out(400, { error: '요청 형식이 올바르지 않습니다.' }); }
    if (env.ACCESS_CODE && String(body.code || '') !== String(env.ACCESS_CODE)) return out(401, { error: 'code' });

    const prompt = String(body.prompt || '');
    const images = Array.isArray(body.images) ? body.images : [];
    if (!prompt) return out(400, { error: '질문이 비어 있습니다.' });
    if (prompt.length > MAX_PROMPT) return out(413, { error: '자료가 너무 큽니다.' });
    if (images.length > MAX_IMAGES) return out(413, { error: '사진이 너무 많습니다.' });
    for (const im of images) {
      if (!im || typeof im.data !== 'string' || !/^image\/(png|jpeg|webp|gif)$/.test(String(im.mime))) return out(400, { error: '사진 형식이 올바르지 않습니다.' });
      if (im.data.length > MAX_IMAGE_B64) return out(413, { error: '사진이 너무 큽니다.' });
    }

    const provider = String(env.PROVIDER || 'claude').toLowerCase();
    const model = String(env.MODEL || DEFAULT_MODEL[provider] || '').trim();
    if (!DEFAULT_MODEL[provider]) return out(500, { error: 'PROVIDER는 claude, openai, gemini 중 하나여야 합니다.' });

    let r;
    try {
      r = await callAI(provider, env.API_KEY, model, prompt, images);
    } catch (e) {
      return out(502, { error: 'AI 회사에 연결하지 못했습니다.' });
    }
    if (r.status === 429) return out(429, { error: 'AI 사용량 한도에 걸렸습니다.' });
    if (r.status === 401 || r.status === 403) return out(502, { error: '서버의 API 키가 맞지 않거나 권한이 없습니다(관리자 확인).' });
    if (!r.ok) {
      let msg = String(r.status);
      try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch (e) {}
      return out(502, { error: 'AI 회사 오류: ' + String(msg).slice(0, 300) });
    }
    const j = await r.json();
    return out(200, { text: pickText(provider, j) });
  },
};

function callAI(provider, key, model, prompt, images) {
  if (provider === 'claude') {
    const body = {
      model, max_tokens: 16000,
      messages: [{ role: 'user', content: images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })).concat([{ type: 'text', text: prompt }]) }],
    };
    const headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (/^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(model)) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
    return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  }
  if (provider === 'openai') {
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }].concat(images.map(i => ({ type: 'image_url', image_url: { url: 'data:' + i.mime + ';base64,' + i.data } }))) }] }),
    });
  }
  return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }].concat(images.map(i => ({ inline_data: { mime_type: i.mime, data: i.data } }))) }],
      generationConfig: { responseMimeType: 'application/json' } }),
  });
}

function pickText(provider, j) {
  if (provider === 'claude') return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (provider === 'openai') return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  const c = j.candidates && j.candidates[0];
  return (c && c.content && (c.content.parts || []).map(x => x.text || '').join('')) || '';
}
