/* 한보금on 활동지원 — 자료 잠금 도우미 v1.0 (2026-11-13)
   사내 자료(content.json, files/, news/, refs/, 상품 비교 데이터, 언더라이팅 데이터)는 공개 사이트에 두지 않고
   비공개 저장소(kif-data)에 둔다. 로그인한 FC만 계정 서버(클라우드플레어)를 거쳐 받을 수 있다.
   이 파일은 포털·상품 비교·언더라이팅 화면이 예전처럼 'files/…', 'content.json' 같은 주소를 써도
   자동으로 「계정 서버 + 로그인 증표」 주소로 바꿔 준다(fetch, XMLHttpRequest, 그림·링크·창 열기 모두).
   로그인하지 않으면 계정 서버가 「로그인이 필요합니다」만 돌려준다. */
(function () {
  if (window.KIFD) return;
  var API = 'https://kif-auth.bluewind1124.workers.dev';
  try { var o = localStorage.getItem('kif_api_override'); if (o && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) API = o; } catch (e) { } /* 시험용(이 PC 안)에서만 */
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? new URL('./', me).href : new URL('./', location.href).href; /* 사이트 맨 위 주소 (…/kif/) */
  var PROT = /^(content\.json$|files\/(?!design\/)|news\/|refs\/|classic\/data\/|classic\/base\/|classic\/cmp_[^/?#]+\.html?$|uw\/[^/?#]+\.json$)/;
  function tok() { try { var t = JSON.parse(localStorage.getItem('kif_tok') || 'null'); return t && t.exp > Date.now() ? t.token : ''; } catch (e) { return ''; } }
  /* 사이트 안의 잠긴 자료 주소이면 계정 서버 주소로 바꾼다. 아니면 그대로 */
  function map(u) {
    if (u == null) return u;
    var s = String(u);
    if (!s || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(s)) return u;
    if (s.indexOf(API + '/d/') === 0) { /* 이미 바꾼 주소: 뒤에 ?v= 등이 덧붙어도 바로잡고 최신 증표로 */
      try { var b = new URL(s), z = new URLSearchParams(b.search.replace(/\?/g, '&').slice(1)); z.delete('v'); z.delete('_'); z.set('t', tok()); return b.origin + b.pathname + '?' + z.toString() + b.hash; } catch (e) { return u; }
    }
    var a; try { a = new URL(s, document.baseURI); } catch (e) { return u; }
    if (a.href.indexOf(ROOT) !== 0) return u;
    var p; try { p = decodeURIComponent(a.pathname.slice(new URL(ROOT).pathname.length)); } catch (e) { return u; }
    if (!PROT.test(p)) return u;
    var q = new URLSearchParams(a.search); q.delete('t'); q.delete('_'); q.delete('v'); q.set('t', tok());
    return API + '/d/' + p.split('/').map(encodeURIComponent).join('/') + '?' + q.toString() + a.hash;
  }
  /* 잠긴 자료(JSON)를 바로 받아 돌려준다(못 받으면 null). 상품 비교·원픽 화면이 처음 그릴 때 쓴다 */
  function json(p) {
    try { var x = new XMLHttpRequest(); x.open('GET', map(new URL(p, ROOT).href), false); x.send(null); return x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { return null; }
  }
  window.KIFD = { api: API, root: ROOT, tok: tok, url: map, json: json, prot: function (p) { return PROT.test(String(p || '').replace(/^\.?\//, '')); } };

  /* fetch · XMLHttpRequest */
  var F = window.fetch;
  if (F) window.fetch = function (i, o) {
    if (typeof i === 'string' || i instanceof URL) return F.call(this, map(String(i)), o);
    if (i && i.url) { var m = map(i.url); if (m !== i.url) return F.call(this, new Request(m, i), o); }
    return F.call(this, i, o);
  };
  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { var a = [].slice.call(arguments); a[1] = map(u); return XO.apply(this, a); };
  /* 새 창으로 열기 */
  var WO = window.open;
  window.open = function (u) { var a = [].slice.call(arguments); a[0] = map(u); return WO.apply(this, a); };
  /* 그림·틀(iframe)·링크 주소를 코드로 넣는 경우 */
  [['HTMLImageElement', 'src'], ['HTMLIFrameElement', 'src'], ['HTMLEmbedElement', 'src'], ['HTMLSourceElement', 'src'],
   ['HTMLMediaElement', 'src'], ['HTMLAnchorElement', 'href'], ['HTMLObjectElement', 'data']].forEach(function (x) {
    var C = window[x[0]]; if (!C) return;
    var d = Object.getOwnPropertyDescriptor(C.prototype, x[1]); if (!d || !d.set) return;
    Object.defineProperty(C.prototype, x[1], { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, map(v)); } });
  });
  var SA = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { var k = String(n).toLowerCase(); return SA.call(this, n, (k === 'src' || k === 'href' || k === 'data' || k === 'poster') ? map(v) : v); };
  /* innerHTML로 한꺼번에 넣은 그림·링크: 화면에 붙자마자 주소를 바꾼다 */
  var ATTR = { IMG: 'src', IFRAME: 'src', EMBED: 'src', SOURCE: 'src', VIDEO: 'src', AUDIO: 'src', A: 'href', OBJECT: 'data' };
  function fix(el) {
    var k = ATTR[el.tagName]; if (!k) return;
    var v = el.getAttribute(k); if (!v) return;
    var m = map(v); if (m !== v) SA.call(el, k, m);
  }
  function scan(n) {
    if (n.nodeType !== 1) return; fix(n);
    if (n.querySelectorAll) { var L = n.querySelectorAll('img,iframe,embed,source,video,audio,a,object'); for (var i = 0; i < L.length; i++) fix(L[i]); }
  }
  /* 꾸미는 그림(배경 그림 등)이 아닌 실제 자료만 바뀌므로 화면 모양은 그대로다 */
  var mo = new MutationObserver(function (R) {
    for (var i = 0; i < R.length; i++) {
      var r = R[i];
      if (r.type === 'attributes') fix(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) scan(r.addedNodes[j]);
    }
  });
  function start() { mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'data'] }); scan(document.documentElement); }
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
  /* 잠긴 자료를 링크로 누를 때 그 순간의 로그인 증표로 다시 맞춘다(오래 열어 둔 화면 대비) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href'); if (h && h.indexOf(API + '/d/') === 0) SA.call(a, 'href', h.replace(/([?&])t=[^&#]*/, '$1t=' + encodeURIComponent(tok())));
  }, true);
})();
