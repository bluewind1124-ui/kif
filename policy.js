/* 한보금on 「약관 분석」 — 보험 약관 PDF를 이 브라우저 안에서 읽고, 질문하면 등록한 AI(내 AI 등록 = window.KIFAI)가 약관 근거로 답한다.
   - AI 연결은 포털 공통 「내 AI 등록」을 그대로 쓴다(관리자는 회사 AI 기본 연결). 따로 키 칸을 두지 않는다.
   - PDF는 서버로 보내지 않는다. 글자를 꺼내 질문과 함께 AI에만 보낸다. 글자 없는 스캔 PDF는 KIFAI.ocrPdf(문자 인식)로 읽는다.
   - 약관이 한 번에 안 들어가면 기본은 「빠짐없이 전체 읽기」: 전체를 묶음으로 나눠 AI가 모든 쪽을 읽고 관련 쪽을 고른 뒤, 그 쪽 원문으로 답한다.
     「빠른 찾기」는 낱말로 관련 쪽만 골라 한 번에 보낸다. 어느 쪽이든 답마다 읽힌 범위·못 읽은 쪽을 표시한다.
   - 글자 없는 쪽(표·별표 그림, 스캔)은 문자 인식(KIFAI.ocrPages)으로 읽을 수 있게 하고, 읽기 전까지 화면에 계속 알린다.
   window.KIFPOL = { html(), bind(root), card() } */
(function(){
'use strict';
if(window.KIFPOL)return;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* ---------- 보험사 공시실 (content.json policyLinks {life:[[이름,주소]],nonlife:[...]} 가 있으면 그것을 쓴다) ---------- */
var LINKS={
  common:[['생명보험협회 공시실 (전 생보사 상품·약관)','https://pub.insure.or.kr/'],['손해보험협회 공시실 (전 손보사 상품·약관)','https://kpub.knia.or.kr/']],
  life:[['삼성생명','https://www.samsunglife.com/'],['한화생명','https://www.hanwhalife.com/'],['교보생명','https://www.kyobo.com/'],['신한라이프','https://www.shinhanlife.co.kr/'],
    ['NH농협생명','https://www.nhlife.co.kr/'],['KB라이프','https://www.kblife.co.kr/'],['미래에셋생명','https://life.miraeasset.com/'],['동양생명','https://www.myangel.co.kr/'],
    ['흥국생명','https://www.heungkuklife.co.kr/'],['ABL생명','https://www.abllife.co.kr/'],['DB생명','https://www.idblife.com/'],['메트라이프생명','https://www.metlife.co.kr/'],
    ['라이나생명','https://www.lina.co.kr/'],['AIA생명','https://www.aia.co.kr/'],['하나생명','https://www.hanalife.co.kr/'],['KDB생명','https://www.kdblife.co.kr/'],
    ['푸본현대생명','https://www.fubonhyundai.com/'],['처브라이프생명','https://www.chubblife.co.kr/'],['BNP파리바카디프생명','https://www.cardif.co.kr/disclosure/product/papag001.do'],['교보라이프플래닛','https://www.lifeplanet.co.kr/']],
  nonlife:[['삼성화재','https://www.samsungfire.com/'],['현대해상','https://www.hi.co.kr/'],['DB손해보험','https://www.idbins.com/'],['KB손해보험','https://www.kbinsure.co.kr/CG802010001.ec'],
    ['메리츠화재','https://www.meritzfire.com/'],['한화손해보험','https://www.hwgeneralins.com/'],['롯데손해보험','https://www.lotteins.co.kr/'],['흥국화재','https://www.heungkukfire.co.kr/'],
    ['NH농협손해보험','https://www.nhfire.co.kr/'],['하나손해보험','https://www.hanainsure.co.kr/'],['AXA손해보험','https://www.axa.co.kr/'],['캐롯손해보험','https://www.carrotins.com/'],
    ['처브손해보험','https://www.chubb.com/kr-kr/disclosure/product-disclosure.html']]
};
fetch('content.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).then(function(c){var p=c&&c.policyLinks;if(p&&typeof p==='object'){if(Array.isArray(p.life)&&p.life.length)LINKS.life=p.life;if(Array.isArray(p.nonlife)&&p.nonlife.length)LINKS.nonlife=p.nonlife;if(Array.isArray(p.common)&&p.common.length)LINKS.common=p.common;}}).catch(function(){});

/* ---------- 예시 질문 (FC 상담에서 자주 묻는 것) ---------- */
var EX=[
  ['지급 조건','이 약관에서 주요 진단비(암·뇌·심장)가 지급되는 조건과 진단 확정 기준을 정리해 주세요.'],
  ['면책·감액','보험금을 지급하지 않는 경우(면책)와 감액 지급 기간을 조항별로 정리해 주세요.'],
  ['소액암 기준','갑상선암·기타피부암·제자리암·경계성종양 같은 소액암이 어떻게 정의되고 얼마나 지급되는지 찾아 주세요.'],
  ['납입면제','보험료 납입면제가 되는 조건을 정리해 주세요.'],
  ['해지·환급','해지할 때 돌려받는 돈(해지환급금)과 무해지·저해지 여부, 해지 시 불이익을 알려 주세요.'],
  ['고지의무','계약 전 알릴 의무(고지의무)를 어기면 어떻게 되는지, 계약 해지 가능 기간과 함께 알려 주세요.'],
  ['청구 서류','보험금 청구할 때 필요한 서류와 청구 기한(소멸시효)을 알려 주세요.'],
  ['상담 포인트','고객에게 이 상품을 설명할 때 꼭 짚어야 할 핵심 포인트 5가지와 오해하기 쉬운 부분을 뽑아 주세요.']
];

/* ---------- 상태 (화면을 옮겨 다녀도 이 창이 열려 있는 동안 유지) ---------- */
var S={docs:[],qa:[],busy:false,tab:'life',msg:'',mode:''};
/* mode: ''=자동(긴 약관+붙여넣기면 특약 목차, 아니면 전체 읽기), 사용자가 고르면 그 방식 */
try{var _m=localStorage.getItem('kif_pol_mode2');if(/^(toc|full|quick)$/.test(_m||''))S.mode=_m;}catch(e){}
function totalChars(){return S.docs.reduce(function(a,d){return a+d.pages.reduce(function(x,p){return x+p.t.length;},0);},0);}
function totalPages(){return S.docs.reduce(function(a,d){return a+d.pages.length;},0);}

/* ---------- 스타일 ---------- */
var CSS='.pol{max-width:880px;margin:0 auto}'+
'.pol-top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}.pol-top .ph{flex:1 1 320px;border:0;padding-bottom:0}'+
'.pol-top .bt{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}'+
'.pol-cta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--gold-soft);border:1px solid var(--kgold-2);border-radius:6px;padding:12px 16px;margin:16px 0 0}'+
'.pol-cta b{color:var(--gold)}.pol-cta .note{flex:1 1 260px}'+
'.pol-st{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-top:16px;overflow:hidden}'+
'.pol-sh{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}'+
'.pol-sh .n{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--navy);color:#fff;font-weight:800;flex:none}'+
'.pol-st.done .pol-sh .n{background:var(--kgold);color:#0f2240}'+
'.pol-sh h3{font-size:1.05rem;margin:0}.pol-sh .note{margin-left:auto}'+
'.pol-sb{padding:16px 18px}'+
'.pol-ai{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:12px 14px}.pol-ai .s{flex:1 1 300px;font-size:.92rem}'+
'.pol-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;border:2px dashed var(--line-strong);border-radius:8px;padding:30px 16px;background:var(--surface-2);cursor:pointer;transition:border-color .15s,background .15s}'+
'.pol-drop:hover,.pol-drop.over{border-color:var(--kgold);background:var(--gold-soft)}.pol-drop svg{width:38px;height:38px;stroke:var(--kgold);fill:none;stroke-width:1.6}'+
'.pol-drop b{font-size:1rem}.pol-drop input{display:none}'+
'.pol-docs{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}'+
'.pol-docs li{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:6px;padding:9px 12px;background:var(--surface)}'+
'.pol-docs li b{flex:1 1 200px;min-width:0;overflow-wrap:anywhere}.pol-docs .tag{font-size:.75rem;font-weight:700;border-radius:3px;padding:1px 7px;background:var(--good-soft);color:var(--good)}.pol-docs .tag.w{background:var(--warn-soft);color:var(--warn)}'+
'.pol-x{border:0;background:none;color:var(--muted);font-size:1.05rem;padding:2px 6px}'+
'.pol-msg{margin-top:10px;font-size:.88rem;color:var(--gold);min-height:1em}'+
'.pol-dir{margin-top:14px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2)}.pol-dir summary{padding:10px 14px;font-weight:700;cursor:pointer}'+
'.pol-dir .in{padding:4px 14px 14px}.pol-tabs{display:flex;gap:6px;margin:6px 0 10px}.pol-tabs button{border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:20px;padding:4px 14px;font-weight:600}'+
'.pol-tabs button.on{background:var(--navy);border-color:var(--navy);color:#fff}'+
'.pol-co{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}.pol-co a{display:block;border:1px solid var(--line);border-radius:5px;padding:7px 10px;text-decoration:none;background:var(--surface);font-size:.9rem}.pol-co a:hover{border-color:var(--kgold)}'+
'.pol-co.wide{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-bottom:10px}.pol-co.wide a{font-weight:700;color:var(--navy-ink)}'+
'.pol-ex{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px}.pol-ex button{border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:20px;padding:5px 12px;font-size:.88rem}.pol-ex button:hover{border-color:var(--kgold);background:var(--gold-soft)}'+
'.pol-q{width:100%;min-height:84px;border:1px solid var(--line-strong);border-radius:6px;padding:10px 12px;background:var(--surface);color:var(--ink);resize:vertical;font-size:1rem}'+
'.pol-qr{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.pol-qr .note{flex:1 1 220px}'+
'.pol-ans{margin-top:16px;display:grid;gap:12px}.pol-a{border:1px solid var(--line);border-left:4px solid var(--kgold);border-radius:6px;padding:14px 16px;background:var(--surface)}'+
'.pol-a .qq{font-weight:700;color:var(--navy-ink);margin-bottom:8px}.pol-a .tx{white-space:pre-wrap}.pol-a ul{margin:8px 0 0;padding-left:20px}'+
'.pol-a .rf{margin-top:10px;font-size:.88rem;background:var(--surface-2);border-radius:5px;padding:8px 12px}.pol-a .rf li{margin:3px 0}.pol-a .rf q{color:var(--muted)}'+
'.pol-a .cv{margin-top:8px;font-size:.85rem;color:var(--warn)}.pol-a .ft{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.pol-a .ft .note{flex:1}'+
'.pol-dis{margin:18px 0 6px;font-size:.82rem;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}'+
'.pol-ov{position:fixed;inset:0;background:rgba(10,18,26,.55);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto}'+
'.pol-box{background:var(--surface);color:var(--ink);border-radius:10px;max-width:640px;width:100%;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}'+
'.pol-box .hd{display:flex;align-items:center;gap:10px;background:var(--navy);color:#fff;padding:14px 18px}.pol-box .hd h2{font-size:1.1rem;margin:0;color:#fff}.pol-box .hd button{margin-left:auto;border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:6px;width:32px;height:32px;font-size:1rem}'+
'.pol-box .bd{padding:16px 20px 20px}.pol-box ol{padding-left:20px;margin:6px 0}.pol-box li{margin:6px 0}.pol-box h4{margin:14px 0 6px;font-size:.98rem;color:var(--navy-ink)}'+
'.pol-tip{background:var(--gold-soft);border-left:3px solid var(--kgold);border-radius:4px;padding:9px 12px;font-size:.88rem;margin-top:12px}'+
'.pol-docs .gap{flex-basis:100%;font-size:.85rem;color:var(--warn);display:flex;gap:8px;align-items:center;flex-wrap:wrap}'+
'.pol-mode{display:grid;gap:6px;margin:10px 0 0;font-size:.9rem}.pol-mode label{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:6px;padding:8px 10px;background:var(--surface);cursor:pointer}.pol-mode label.on{border-color:var(--kgold);background:var(--gold-soft)}.pol-mode input{margin-top:3px}.pol-mode .ok{color:var(--good);font-weight:600}'+
'.pol-kw{margin:8px 0 0;font-size:.9rem;display:grid;gap:4px}.pol-kw:empty{display:none}.pol-kwin{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:6px;padding:6px 10px;background:var(--surface);color:var(--ink);font-size:.92rem}'+
'.pol-a .cov{margin-top:10px;font-size:.85rem;border-radius:5px;padding:8px 12px;background:var(--good-soft);color:var(--ink)}.pol-a .cov.w{background:var(--warn-soft)}.pol-a .cov b{color:var(--navy-ink)}.pol-a .cov details{margin-top:4px}.pol-a .cov .btn{margin-top:6px}'+
'@media (max-width:640px){.pol-sh .note{margin-left:0;flex-basis:100%}.pol-sb{padding:14px}.pol-top .bt{margin-left:0}}';
function addCss(){if(document.getElementById('polCss'))return;var s=document.createElement('style');s.id='polCss';s.textContent=CSS;document.head.appendChild(s);}

/* ---------- 홈 카드 ---------- */
function card(){
  return '<button type="button" class="hm-tool pol-card" data-go="policy"><span class="ti"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h7M9 14h7M9 17h4"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M19.3 20.3L21 22"/></svg></span>'+
    '<span class="tt"><b>약관 분석</b><small>약관 PDF를 올리고 물어보면 AI가 조항을 찾아 답합니다</small></span><em>열기 ›</em></button>';
}

/* ---------- 화면 ---------- */
function aiState(){
  var K=window.KIFAI;if(!K)return {ok:false,html:'AI 연결 도구를 불러오지 못했습니다. 새로고침해 주세요.'};
  var c=K.cfg();
  /* 아직 AI를 정하지 않았으면 키 없이 되는 복사·붙여넣기로 바로 쓴다 */
  if(!K.chosen())return {ok:true,paste:true,html:'연결된 AI: <b>복사·붙여넣기</b> (기본 · 키 없이 무료로 ChatGPT·Gemini·Claude 사이트에 붙여넣어 씁니다) · <button type="button" class="kai-link" data-kai-open>바꾸기</button>'};
  var ok=c.mode==='ai'&&!(K.AIP[c.prov]&&K.AIP[c.prov].key&&!c.keys[c.prov]);
  return {ok:ok,paste:c.prov==='paste',html:K.statusHTML()};
}
function aiBox(){
  var a=aiState();
  return '<div class="pol-ai" id="polAi"><div class="s">'+a.html+(a.ok&&a.paste?'<br><span class="note">복사·붙여넣기 방식은 질문을 AI 사이트에 붙여넣고 답을 다시 가져옵니다. 약관이 길면 여러 번 나눠 붙여넣어 전체를 읽힙니다. 자주 쓰면 무료 Gemini 키를 등록해 두면 버튼 한 번에 전체를 읽습니다.</span>':'')+'</div>'+
    '<button type="button" class="btn sm'+(a.ok?' ghost':' gold')+'" data-kai-open>'+(a.ok?'AI 바꾸기':'내 AI 등록')+'</button><button type="button" class="btn sm ghost" data-pol="keyhelp">AI 연결 방법</button></div>';
}
function docsHtml(){
  if(!S.docs.length)return '';
  return '<ul class="pol-docs">'+S.docs.map(function(d,i){
    var ch=d.pages.reduce(function(x,p){return x+p.t.length;},0);
    return '<li><b>📄 '+esc(d.name)+'</b><span class="note">'+d.num+'쪽'+(d.pages.length<d.num?' 중 '+d.pages.length+'쪽 읽음':'')+' · 글자 '+ch.toLocaleString()+'자</span>'+
      (d.ocr?'<span class="tag w">문자 인식</span>':d.weak.length||d.num>d.pages.length?'<span class="tag w">일부 못 읽음</span>':'<span class="tag">전체 읽기 완료</span>')+'<button type="button" class="pol-x" data-pol="rm" data-i="'+i+'" aria-label="'+esc(d.name)+' 빼기">✕</button>'+
      (d.weak.length?'<span class="gap">⚠ 글자가 없는 쪽 '+d.weak.length+'개('+pList(d.weak)+') — 표·별표가 그림으로 들어 있으면 AI가 못 읽습니다.<button type="button" class="btn sm" data-pol="ocr" data-i="'+i+'">문자 인식으로 읽기</button></span>':'')+
      (d.num>d.pages.length?'<span class="gap">⚠ 너무 길어 p.'+(d.pages.length+1)+'~'+d.num+'는 읽지 않았습니다. 필요한 특약 부분만 따로 PDF로 나눠 올려 주세요.</span>':'')+
      (d.ocrd.length&&!d.ocr?'<span class="gap" style="color:var(--muted)">문자 인식으로 읽은 쪽 '+d.ocrd.length+'개 ('+pList(d.ocrd.slice().sort(function(x,y){return x-y;}))+') · 글자가 틀릴 수 있음</span>':'')+'</li>';}).join('')+'</ul>';
}
function linksHtml(){
  var L=S.tab==='life'?LINKS.life:LINKS.nonlife;
  return '<details class="pol-dir" id="polDir"><summary>🔗 약관 PDF 내려받는 곳 (생보·손보 공시실)</summary><div class="in">'+
    '<p class="note" style="margin:0 0 8px">협회 공시실에서는 모든 회사의 판매 중·판매 중지 상품 약관을 한곳에서 찾을 수 있습니다. 회사 홈페이지는 보통 맨 아래 <b>공시실 › 상품공시</b>에 약관이 있습니다.</p>'+
    '<div class="pol-co wide">'+LINKS.common.map(function(x){return '<a target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(x[0])+' ↗</a>';}).join('')+'</div>'+
    '<div class="pol-tabs" role="tablist"><button type="button" role="tab" data-pol="tab" data-v="life" class="'+(S.tab==='life'?'on':'')+'" aria-selected="'+(S.tab==='life')+'">생명보험</button><button type="button" role="tab" data-pol="tab" data-v="nonlife" class="'+(S.tab==='nonlife'?'on':'')+'" aria-selected="'+(S.tab==='nonlife')+'">손해보험</button></div>'+
    '<div class="pol-co">'+L.map(function(x){return '<a target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(x[0])+' ↗</a>';}).join('')+'</div>'+adminHtml()+'</div></details>';
}
function ansHtml(){
  return S.qa.map(function(a,i){
    var r=a.r||{};
    return '<div class="pol-a"><div class="qq">Q. '+esc(a.q)+'</div>'+
      (a.err?'<div class="cv">'+esc(a.err)+'</div>':
      '<div class="tx">'+esc(r.answer||'')+'</div>'+
      (Array.isArray(r.points)&&r.points.length?'<ul>'+r.points.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>':'')+
      (Array.isArray(r.refs)&&r.refs.length?'<div class="rf"><b>약관 근거</b><ul>'+r.refs.map(function(f){f=f||{};return '<li><b>'+esc(f.where||'')+'</b>'+(f.quote?' — <q>'+esc(f.quote)+'</q>':'')+'</li>';}).join('')+'</ul></div>':'')+
      (r.caution?'<div class="cv">⚠ '+esc(r.caution)+'</div>':'')+covHtml(a,i))+
      '<div class="ft"><span class="note">'+esc(a.at)+(a.part?' · '+esc(a.part):'')+'</span>'+(a.err?'':'<button type="button" class="btn sm ghost" data-pol="copy" data-i="'+i+'">답 복사</button>')+'<button type="button" class="btn sm ghost" data-pol="del" data-i="'+i+'">지우기</button></div></div>';
  }).join('');
}
function kwHtml(q){
  q=q==null?(document.getElementById('polQ')||{}).value||'':q;if(!String(q).trim()&&!S.kw)return '';
  var G=kwGroups(q);if(!G.length)return '';
  var h='<div>🔎 <b>찾을 키워드</b> <span class="note">질문에서 뽑았습니다 · 같은 뜻 말은 /로 묶음 · 고칠 수 있음</span></div><input type="text" id="polKwIn" class="pol-kwin" value="'+esc(kwText(G))+'" aria-label="찾을 키워드">';
  if(S.docs.length){var K=kwSecs(G);h+='<div class="note">'+(K.length?'이 키워드가 나오는 특약·조항 <b>'+K.length+'개</b> — <details style="display:inline"><summary style="display:inline;cursor:pointer;text-decoration:underline">목록 보기</summary><div style="margin-top:4px">'+K.slice(0,60).map(function(r){return esc(r.x.t)+' (p.'+r.x.a+(r.x.b>r.x.a?'~'+r.x.b:'')+') — '+esc(r.hit.join('·'));}).join('<br>')+(K.length>60?'<br>외 '+(K.length-60)+'개':'')+'</div></details>':'이 키워드가 함께 나오는 특약·조항을 찾지 못했습니다. 키워드를 고쳐 보세요.')+'</div>';}
  return h;
}
function modeHtml(){
  if(!S.docs.length||!aiState().ok)return '';var pl=plan();
  if(pl.fits)return '<div class="pol-mode"><span class="ok">✓ 올린 약관 전체('+pl.pages+'쪽)가 한 번에 AI에 들어갑니다 · 빠지는 쪽 없음</span></div>';
  var o=function(v,t,d){return '<label class="'+(pl.mode===v?'on':'')+'"><input type="radio" name="polMode" data-pol="mode" value="'+v+'"'+(pl.mode===v?' checked':'')+'><span><b>'+t+'</b><br><span class="note">'+d+'</span></span></label>';};
  return '<div class="pol-mode" role="radiogroup" aria-label="읽는 방법">'+
    (pl.toc?o('toc','키워드·특약 목차로 찾기'+(pl.paste||pl.n>4?' (긴 약관 추천)':''),'① 위 키워드가 나오는 특약을 포털이 약관 전체에서 모두 모으고 ② AI가 특약·조항 '+pl.secs+'개 목록 전체를 보고 이름이 다른 관련 특약을 더 고른 뒤 ③ 고른 특약의 원문 전체로 답합니다. '+(pl.paste?'AI 창에 보통 <b>2~4번</b> 붙여넣기':'AI에 보통 2~4번 물어봄')):'')+
    o('full','빠짐없이 전체 읽기','약관 '+pl.pages+'쪽 본문 전체를 '+pl.n+'묶음으로 나눠 AI가 모두 읽고 관련 쪽을 고른 뒤 답합니다. '+(pl.paste?'AI 창에 <b>'+(pl.n+1)+'번</b> 붙여넣기'+(pl.n>6?' — 너무 많으면 「내 AI 등록」에서 Gemini 키를 넣으면 자동으로 합니다':''):'AI에 '+(pl.n+1)+'번 물어봄 · 1~3분'))+
    o('quick','빠른 찾기','질문 낱말로 관련 쪽만 골라 한 번에 보냅니다. 빠르지만 이름이 다른 특약·표는 빠질 수 있습니다.')+'</div>';
}
function covHtml(a,i){
  var c=a.cov;if(!c)return '';var h='',w=false;
  if(c.mode==='all')h='✓ <b>읽힌 범위</b>: 올린 약관 전체 '+c.pages+'쪽 (빠진 쪽 없음)';
  else if(c.mode==='full'){h='✓ <b>읽힌 범위</b>: 전체 '+c.pages+'쪽을 '+c.n+'묶음으로 모두 읽고, 관련 쪽 '+c.hits+'곳을 골라 답했습니다.';
    if(c.hitList&&c.hitList.length)h+='<details><summary>AI가 고른 관련 쪽 보기</summary>'+c.hitList.map(function(x){return '문서'+(x.d+1)+' p.'+x.p+(x.where?' '+esc(x.where):'');}).join(' · ')+'</details>';
    if(c.left){w=true;h+='<br>⚠ 관련 쪽이 많아 '+c.left+'곳은 원문 대신 찾은 문구로만 답에 넣었습니다. 해당 쪽은 약관 원문으로 확인하세요.';}}
  else if(c.mode==='toc'){h='✓ <b>읽힌 범위</b>: 약관 '+c.pages+'쪽의 특약·조항 '+c.secs+'개를 모두 살펴, 관련 '+c.chosen.length+'개('+c.cpages+'쪽)의 원문 전체를 읽혀 답했습니다.'+
      (c.kw?'<br>🔎 <b>찾은 키워드</b>: '+esc(c.kw):'')+
      '<details><summary>키워드가 나온 특약·조항 '+c.kwList.length+'개</summary>'+(c.kwList.map(esc).join('<br>')||'없음')+'</details>'+
      (c.aiList.length?'<details><summary>AI가 목록을 보고 더 고른 특약 '+c.aiList.length+'개</summary>'+c.aiList.map(esc).join('<br>')+'</details>':'')+
      (c.drop.length?'<details><summary>⚠ 키워드는 나오지만 양이 많아 보내지 못한 특약 '+c.drop.length+'개</summary>'+c.drop.map(esc).join('<br>')+'</details>':'')+
      '<span class="note">키워드도 없고 AI도 고르지 않은 특약은 본문을 읽지 않았습니다. 빠진 특약이 의심되면 아래 버튼으로 본문 전체를 읽혀 보세요.</span>'+
      (c.left?'<br>⚠ 고른 쪽이 많아 '+c.left+'곳은 원문 대신 찾은 문구로만 답에 넣었습니다.':'')+
      '<br><button type="button" class="btn sm ghost" data-pol="redo" data-i="'+i+'">빠짐없이 전체 읽기로 다시 찾기</button>';if(c.left||c.drop.length)w=true;}
  else{w=true;h='⚠ <b>읽힌 범위</b>: '+c.pages+'쪽 중 '+c.used+'쪽만 읽혔습니다 (빠른 찾기).';
    if(c.names&&c.names.length)h+='<details><summary>AI에 보내지 않은 특약 '+c.names.length+'개 보기</summary>'+esc(c.names.join(', '))+'</details>';
    h+='<br><button type="button" class="btn sm" data-pol="redo" data-i="'+i+'">빠짐없이 전체 읽기로 다시 찾기</button>';}
  (c.gaps||[]).forEach(function(g){
    if(g.weak.length){w=true;h+='<br>⚠ 「'+esc(g.name)+'」 글자가 없어 읽지 못한 쪽 '+g.weak.length+'개: '+pList(g.weak)+' — 2번의 「문자 인식으로 읽기」 후 다시 물어보세요.';}
    if(g.cut){w=true;h+='<br>⚠ 「'+esc(g.name)+'」 p.'+g.cut[0]+'~'+g.cut[1]+'는 읽지 않았습니다(쪽수 한도).';}
    if(g.ocr)h+='<br>· 「'+esc(g.name)+'」 '+g.ocr+'쪽은 문자 인식 글자라 틀릴 수 있습니다.';});
  return '<div class="cov'+(w?' w':'')+'">'+h+'</div>';
}
function html(){
  addCss();var a=aiState(),has=S.docs.length>0;
  return '<div class="pol">'+
    '<div class="pol-top"><div class="ph"><div class="kicker">교육 · 연계</div><h1>약관 분석</h1><p>보험 약관 PDF를 올리고 궁금한 것을 물어보세요. 등록한 AI가 약관을 읽고 <b>조항과 근거</b>를 붙여 답합니다. 파일은 서버에 올라가지 않습니다.</p></div>'+
      '<div class="bt"><button type="button" class="btn sm ghost" data-pol="guide">📖 이용 가이드</button><button type="button" class="btn sm ghost" data-go="home">✕ 닫기</button></div></div>'+
    '<div class="pol-cta"><span style="font-size:1.5rem" aria-hidden="true">💡</span><div class="note"><b>상담에 이렇게 써 보세요</b><br>고객이 "이것도 보험금 나와요?"라고 물을 때, 가입한 상품의 약관을 올리고 그대로 물어보면 해당 조항을 찾아 줍니다. 답은 참고용이니 최종 확인은 약관 원문으로 하세요.</div><button type="button" class="btn sm" data-pol="guide">사용 순서 보기</button></div>'+
    '<section class="pol-st'+(a.ok?' done':'')+'"><div class="pol-sh"><span class="n">1</span><h3>AI 연결하기</h3><span class="note">AI보장분석과 같은 AI를 씁니다 · 따로 등록할 필요 없음</span></div><div class="pol-sb">'+aiBox()+'</div></section>'+
    '<section class="pol-st'+(has?' done':'')+'"><div class="pol-sh"><span class="n">2</span><h3>약관 PDF 올리기</h3><span class="note">올린 파일은 내 컴퓨터 밖으로 나가지 않습니다</span></div><div class="pol-sb">'+
      '<label class="pol-drop" id="polDrop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12 17v-6M9.5 13.5L12 11l2.5 2.5"/></svg><b>약관 PDF를 여기에 끌어다 놓거나 눌러서 고르기</b><span class="note">주계약·특약 약관을 여러 개 함께 올려도 됩니다 · 서버로 보내지 않습니다</span><input type="file" id="polFile" accept="application/pdf,.pdf" multiple></label>'+
      '<div id="polDocs">'+docsHtml()+'</div><div class="pol-msg" id="polMsg" role="status">'+esc(S.msg)+'</div>'+linksHtml()+'</div></section>'+
    '<section class="pol-st'+(S.qa.length?' done':'')+'"><div class="pol-sh"><span class="n">3</span><h3>약관에 묻기</h3><span class="note">답마다 근거 조항과 쪽을 붙입니다</span></div><div class="pol-sb">'+
      '<b style="font-size:.92rem">FC가 자주 찾는 질문</b> <span class="note">누르면 질문 칸에 들어갑니다</span><div class="pol-ex">'+EX.map(function(x,i){return '<button type="button" data-pol="ex" data-i="'+i+'">'+esc(x[0])+'</button>';}).join('')+'</div>'+
      '<textarea class="pol-q" id="polQ" placeholder="예) 유방암 수술 후 재발하면 암 진단비를 또 받을 수 있나요?"></textarea>'+
      '<div class="pol-kw" id="polKw">'+kwHtml()+'</div>'+
      '<div id="polMode">'+modeHtml()+'</div>'+
      '<div class="pol-qr"><span class="note" id="polHint">'+(has?'올린 약관 '+S.docs.length+'개 · '+totalPages()+'쪽을 기준으로 답합니다.':'먼저 2번에서 약관 PDF를 올려 주세요.')+'</span><button type="button" class="btn gold" id="polAsk" data-pol="ask">약관에서 찾기</button></div>'+
      '<div class="pol-ans" id="polAns">'+ansHtml()+'</div>'+
      '<p class="pol-dis">이 분석은 상담 참고용입니다. AI가 내용을 놓치거나 잘못 해석할 수 있으니, 보험금 지급 여부는 약관 원문과 보험사 확인을 거쳐 안내하세요.</p></div></section>'+
  '</div>';
}

/* ---------- 안내 창 ---------- */
function modal(title,body){
  addCss();var w=document.createElement('div');w.className='pol-ov';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-label',title);
  w.innerHTML='<div class="pol-box"><div class="hd"><h2>'+esc(title)+'</h2><button type="button" data-x aria-label="닫기">✕</button></div><div class="bd">'+body+'</div></div>';
  var close=function(){w.remove();document.removeEventListener('keydown',k);};var k=function(e){if(e.key==='Escape')close();};
  w.addEventListener('click',function(e){if(e.target===w||e.target.closest('[data-x]'))close();else if(e.target.closest('[data-kai-open]'))close();});
  document.addEventListener('keydown',k);document.body.appendChild(w);w.querySelector('[data-x]').focus();
}
function keyHelp(){
  modal('AI 연결 방법',
    '<p style="margin:0">약관 분석은 <b>AI보장분석과 같은 「내 AI 등록」</b>을 씁니다. 보장분석에서 이미 AI를 등록했다면 <b>여기서 따로 할 일은 없습니다.</b> 관리자는 회사 AI로 바로 씁니다.</p>'+
    '<h4>아직 등록 전이라면 (셋 중 하나)</h4><ol><li><b>복사·붙여넣기</b> — 키 없이 무료. 평소 쓰는 ChatGPT·Gemini·Claude 사이트에 질문을 붙여넣고 답을 가져옵니다.</li><li><b>내 API 키</b> — Claude·ChatGPT·Gemini 중 하나의 키를 넣으면 버튼 한 번에 바로 답이 나옵니다. 아래는 무료로 시작할 수 있는 Gemini 예시입니다.</li><li><b>회사 AI</b> — 관리자가 켜 둔 경우 등록 없이 씁니다.</li></ol>'+
    '<h4>(선택) Gemini 키 받기 — 무료, 약 3분</h4><ol><li>구글 계정으로 <a target="_blank" rel="noopener" href="https://aistudio.google.com/apikey">Google AI Studio ↗</a>에 들어갑니다.</li><li><b>Create API key</b>(API 키 만들기)를 누르면 긴 글자(키)가 나옵니다.</li><li>그 키를 <b>복사</b>합니다.</li><li>포털 <b>「내 AI 등록」 › Gemini (Google)</b>을 고르고 키를 붙여넣은 뒤 <b>저장</b>합니다.</li></ol>'+
    '<h4>Claude · ChatGPT 키 (유료)</h4><ol><li><a target="_blank" rel="noopener" href="https://console.anthropic.com/settings/keys">Anthropic 콘솔 ↗</a> 또는 <a target="_blank" rel="noopener" href="https://platform.openai.com/api-keys">OpenAI 플랫폼 ↗</a>에서 키를 만듭니다.</li><li>「내 AI 등록」에서 해당 AI를 고르고 키를 붙여넣습니다.</li></ol>'+
    '<div class="pol-tip"><b>주의</b> 키는 비밀번호와 같습니다. 남에게 알려 주거나 단톡방·인터넷에 올리지 마세요. 키는 이 기기 브라우저에만 저장되니 공용 PC에서는 쓰고 나서 「내 AI 등록」에서 지워 주세요.</div>'+
    '<div class="row" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm gold" data-kai-open>내 AI 등록 열기</button></div>');
}
function guide(){
  modal('약관 분석 이용 가이드',
    '<h4>① AI 연결</h4><p style="margin:0">AI보장분석에서 등록한 AI를 그대로 씁니다(따로 등록할 필요 없음). 관리자는 회사 AI로 바로 씁니다. 연결이 「복사·붙여넣기」로 나오면 질문을 AI 사이트에 붙여넣고 답을 가져오는 방식입니다.</p>'+
    '<h4>② 약관 받기 → 올리기</h4><p style="margin:0">고객이 가입한 상품의 <b>판매 시기에 맞는 약관</b>을 공시실에서 내려받아 올립니다. (같은 상품도 판매 시기마다 약관이 다릅니다. 가입일을 꼭 확인하세요.) 주계약과 특약 약관이 따로 있으면 함께 올리세요.</p>'+
    '<h4>③ 질문</h4><p style="margin:0">「FC가 자주 찾는 질문」 버튼을 누르거나 고객이 물은 말을 그대로 적고 <b>약관에서 찾기</b>를 누릅니다. 답에는 근거 조항과 원문 인용이 붙습니다.</p>'+
    '<h4>찾을 키워드</h4><p style="margin:0">질문을 적으면 주요 키워드(예: 암·재발·수술)를 뽑고 같은 뜻의 약관 말(재발 → 재진단·계속받는·전이)을 붙여 보여 줍니다. 그 키워드가 나오는 특약 목록도 바로 보이니, 빠진 말이 있으면 키워드 칸을 고치세요.</p>'+
    '<h4>긴 약관 — 읽는 방법</h4><p style="margin:0"><b>키워드·특약 목차로 찾기</b>(긴 약관 기본): 키워드가 나오는 특약을 포털이 약관 전체에서 모으고, AI가 특약 목록 전체를 보고 이름이 다른 관련 특약을 더 고른 뒤, 고른 특약 원문 전체로 답합니다. 붙여넣기는 보통 2~4번.<br><b>빠짐없이 전체 읽기</b>: 본문 전체를 묶음으로 나눠 AI가 모두 읽습니다. 가장 꼼꼼하지만 붙여넣기 횟수가 많아, 1,000쪽이 넘으면 Gemini 키 등록(자동)을 권합니다.</p>'+
    '<h4>AI 답 가져오기</h4><p style="margin:0">AI 창에서 답 아래의 <b>복사</b> 아이콘을 누르고 포털로 돌아오면 자동으로 들어갑니다. 안 들어오면 창의 <b>「복사한 답 가져오기」</b>를 누르고, 그래도 안 되면 아래 칸에 직접 붙여넣고 「반영」을 누르세요.</p>'+
    '<h4>읽힌 범위 확인</h4><p style="margin:0">답 아래 초록 칸은 빠짐없이 읽힌 것, 노란 칸은 <b>못 읽은 쪽이나 보내지 않은 특약</b>이 있다는 뜻입니다. 노란 칸이면 안내대로 다시 찾거나 원문을 확인하세요.</p>'+
    '<h4>글자 없는 쪽 · 스캔본</h4><p style="margin:0">표·별표가 그림으로 들어간 쪽은 글자가 없어 AI가 못 읽습니다. 올린 파일 아래 「문자 인식으로 읽기」를 누르면 이 브라우저에서 읽어 줍니다. 전체가 스캔본이면 올릴 때 전 쪽을 문자 인식합니다(쪽당 3~6초). 문자 인식 글자는 틀릴 수 있으니 숫자는 원문으로 확인하세요.</p>'+
    '<div class="pol-tip">고객 개인정보(이름·주민번호)가 담긴 증권이 아니라 <b>약관</b>만 올리세요. 답은 상담 참고용이며 지급 여부의 최종 판단은 보험사가 합니다.</div>');
}

/* ---------- PDF 읽기 ---------- */
var PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',CMAPS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
function loadPdf(){if(window.pdfjsLib){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return Promise.resolve();}
  return new Promise(function(res,rej){var s=document.createElement('script');s.src=PDFJS;s.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();};s.onerror=function(){rej(new Error('PDF 읽기 도구를 불러오지 못했습니다(인터넷 연결 확인).'));};document.head.appendChild(s);});}
var MAXP=1500;
function plain(t){return String(t||'').replace(/\s/g,'').length;}
async function readPdf(f,prog){
  await loadPdf();var buf=await f.arrayBuffer(),doc;
  try{doc=await pdfjsLib.getDocument({data:buf.slice(0),cMapUrl:CMAPS,cMapPacked:true}).promise;}catch(e){throw new Error(f.name+' 파일을 열지 못했습니다'+(/password/i.test(e&&e.name||'')?' (비밀번호가 걸린 파일)':'')+'.');}
  var n=Math.min(doc.numPages,MAXP),pages=[],chars=0;
  for(var i=1;i<=n;i++){
    if(i%10===1)prog('「'+f.name+'」 읽는 중… '+i+'/'+n+'쪽');
    var pg=await doc.getPage(i),tc=await pg.getTextContent(),line='',last=null,t='';
    tc.items.forEach(function(it){var y=it.transform?Math.round(it.transform[5]):0;if(last!==null&&Math.abs(y-last)>3){t+=line.trim()+'\n';line='';}line+=it.str+(it.hasEOL?'':' ');last=y;});
    t=(t+line).replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').trim();chars+=plain(t);pages.push({p:i,t:t});
  }
  var d={name:f.name,num:doc.numPages,pages:pages,ocr:false,buf:buf,ocrd:[],blank:[]};
  if(chars<Math.min(400,40*n)){
    if(!window.KIFAI||!KIFAI.ocrPages)throw new Error(f.name+' — 글자가 없는 스캔본입니다. 공시실의 원본 PDF를 올려 주세요.');
    if(!confirmScan(f.name,n))throw new Error(f.name+' — 스캔본이라 읽지 않았습니다. 공시실의 원본 PDF를 올려 주세요.');
    var all=pages.map(function(x){return x.p;}),r=await KIFAI.ocrPages(buf,all,prog);
    d.ocr=true;d.ocrd=all.slice();pages.forEach(function(x){x.t=String(r[x.p]||'').trim();});
  }
  d.blank=[];d.weak=weakOf(d);
  return d;
}
/* 글자가 거의 없는 쪽 = 표·별표가 그림으로 들어 있거나 빈 쪽. 그대로 두면 AI가 못 읽으니 화면에 항상 알린다 */
function weakOf(d){return d.pages.filter(function(x){return plain(x.t)<20&&d.blank.indexOf(x.p)<0;}).map(function(x){return x.p;});}
function confirmScan(nm,n){return window.confirm('「'+nm+'」은 글자 정보가 없는 스캔본(그림) PDF입니다.\n이 브라우저에서 문자 인식으로 '+n+'쪽 전체를 읽을까요?\n(쪽당 3~6초, 약 '+Math.max(1,Math.round(n*5/60))+'분 걸립니다. 그동안 이 창을 닫지 마세요)');}
function pList(L){if(!L.length)return '';var out=[],s=L[0],e=L[0];for(var i=1;i<=L.length;i++){if(L[i]===e+1){e=L[i];continue;}out.push(s===e?'p.'+s:'p.'+s+'~'+e);s=e=L[i];}return out.length>12?out.slice(0,12).join(', ')+' 외 '+(out.length-12)+'곳':out.join(', ');}
async function ocrWeak(root,i){
  var d=S.docs[i];if(!d||!d.weak.length||S.busy)return;S.busy=true;
  try{var list=d.weak.slice(),r=await KIFAI.ocrPages(d.buf,list,function(t){setMsg(root,'「'+d.name+'」 '+t);});
    var got=0;d.pages.forEach(function(x){if(list.indexOf(x.p)<0)return;var t=String(r[x.p]||'').trim();if(plain(t)>=20){x.t=t;got++;if(d.ocrd.indexOf(x.p)<0)d.ocrd.push(x.p);}else d.blank.push(x.p);});
    d.weak=weakOf(d);d.secs=null;refreshDocs(root);
    setMsg(root,'✓ 「'+d.name+'」 글자 없던 '+list.length+'쪽 중 '+got+'쪽을 문자 인식으로 읽었습니다.'+(list.length-got?' 나머지 '+(list.length-got)+'쪽은 빈 쪽으로 보입니다.':'')+' (문자 인식 글자는 틀릴 수 있습니다)');}
  catch(e){setMsg(root,'문자 인식을 하지 못했습니다: '+((window.KIFAI&&KIFAI.err(e))||e));}
  S.busy=false;
}

/* ---------- 질문에 맞는 쪽 고르기 (빠른 찾기) ---------- */
/* ---------- 질문 키워드: 질문의 주요 낱말(암·재발·수술…)을 모두 뽑고, 같은 뜻의 약관 말을 붙여 묶음으로 만든다 ---------- */
var SYN={'재발':['재진단','계속받는','전이','2차','재발암'],'또':['재진단','계속받는','2차'],'추가':['재진단','계속받는','2차'],'수술':['수술'],'치료':['항암','방사선','표적','직접치료','주요치료'],'항암':['항암','표적'],'진단':['진단확정'],
  '입원':['입원'],'통원':['통원','외래'],'면책':['지급하지 않는','보장개시'],'감액':['감액'],'납입면제':['납입면제','납입을 면제'],'해지':['해지환급금'],'고지':['알릴 의무'],'청구':['청구','소멸시효'],
  '소액암':['유사암','갑상선','기타피부암','제자리암','경계성'],'유사암':['유사암','갑상선','기타피부암','제자리암','경계성'],'뇌':['뇌혈관','뇌졸중','뇌출혈','뇌경색'],'심장':['허혈성','심근경색'],'골절':['골절'],'치매':['치매','장기요양'],'간병':['간병','장기요양'],'후유':['후유장해','장해'],'사망':['사망']};
function kwGroups(q){
  if(S.kw)return S.kw.split(/[,，\n]/).map(function(g){var t=g.split(/[\/·]/).map(function(x){return x.trim();}).filter(function(x){return x.length>=1;});return t.length?{k:t[0],terms:t}:null;}).filter(Boolean);
  var stop=/^(이|그|저|어떤|어떻게|무엇|뭐|알려|주세요|정리해|찾아|있나요|되나요|경우|약관|에서|보험|보험금|이것|것|수|등|및|해|좀|대해|관련|받을|받는|받나요|받을수|있는|있을|이후|후|때|시|하면|되면|나요|가능|여부|얼마|정도|무슨|어디)$/;
  var tk=[];String(q).replace(/[^가-힣a-zA-Z0-9\s]/g,' ').split(/\s+/).forEach(function(x){
    for(var r=0;r<3;r++)x=x.replace(/(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서|까지|부터|만|이나|나|요|인가요|인지|하면|되면|하는|되는|할|된|시|후|때|받을|받는)$/,'');
    if(x.length>=1&&!stop.test(x)&&(x.length>=2||x==='암'||x==='뇌'))tk.push(x);});
  var G=[],key={};
  tk.forEach(function(t){var terms=[t];
    Object.keys(SYN).forEach(function(k){if(t.indexOf(k)>=0)terms=terms.concat(SYN[k]);});
    if(/[가-힣]암$/.test(t))terms=terms.concat(['암','악성신생물']);
    terms=terms.filter(function(x,i){return terms.indexOf(x)===i;});var id=terms.slice().sort().join('|');if(!key[id]){key[id]=1;G.push({k:t,terms:terms});}});
  return G;
}
function kwText(G){return G.map(function(g){return g.terms.join('/');}).join(', ');}
function words(q){var out=[];kwGroups(q).forEach(function(g){out=out.concat(g.terms);});return out.filter(function(x,i){return out.indexOf(x)===i&&x.length>=1;});}
/* 각 특약·조항에 키워드가 얼마나 나오는지: 제목에 나오면 크게, 본문에 여러 키워드가 함께 나오면 높게 */
function kwSecs(G){
  var secs=allSecs();if(!G.length)return [];
  return secs.map(function(x){var t=secText(x),th=0,gh=0,cnt=0,hit=[];
    G.forEach(function(g){var inT=g.terms.some(function(w){return x.t.indexOf(w)>=0;}),c=0;g.terms.forEach(function(w){if(w.length<2&&w!=='암'&&w!=='뇌')return;c+=t.split(w).length-1;});if(inT)th++;if(c||inT){gh++;var mt=g.terms.filter(function(w){return x.t.indexOf(w)>=0||t.indexOf(w)>=0;})[0];hit.push(mt||g.k);}cnt+=Math.min(c,10);});
    return {x:x,th:th,gh:gh,s:th*4+gh*2+cnt/10,hit:hit};})
  .filter(function(r){return r.x.t.indexOf('앞부분')!==0&&((r.th&&r.gh>=1)||r.gh>=Math.min(2,G.length));})
  .sort(function(a,b){return b.s-a.s;});
}
function allPages(){var all=[];S.docs.forEach(function(d,di){d.pages.forEach(function(p){if(plain(p.t))all.push({d:di,p:p.p,t:p.t,name:d.name});});});return all;}
function fmt(L){var by={};return L.map(function(x){var h=by[x.d]?'':'\n===== 문서'+(x.d+1)+': '+x.name+' =====\n';by[x.d]=1;return h+'[p.'+x.p+'] '+x.t;}).join('\n');}
function size(L){return L.reduce(function(a,x){return a+x.t.length+20;},0);}
function specials(all,keep){var names=[],seen={};all.forEach(function(x,i){if(keep[i])return;var m=x.t.match(/([가-힣A-Za-z0-9·]{3,30}(?:\([^)]{0,30}\))?)\s?특별약관/);if(m){var n=m[1].replace(/\s+/g,' ').trim();if(!seen[n]&&names.length<80){seen[n]=1;names.push(n+' 특별약관(p.'+x.p+')');}}});return names;}
function rank(q,all){var W=words(q);return all.map(function(x,i){var s=0,hit=0;W.forEach(function(w){var m=x.t.split(w).length-1;if(m){hit++;s+=Math.min(m,6)*(w.length>=3?2:1);}});s+=hit*3;if(hit&&/보험금의\s*지급\s*사유/.test(x.t))s+=12;if(/목\s*차|차\s*례/.test(x.t.slice(0,200)))s+=3;return {i:i,s:s};}).sort(function(a,b){return b.s-a.s;});}
function pick(q,budget){
  var all=allPages();
  if(size(all)<=budget)return {text:fmt(all),part:'',used:all.length,all:all.length,names:[]};
  var keep={};all.forEach(function(x,i){if(x.p<=2)keep[i]=1;});
  var sc=rank(q,all),used=Object.keys(keep).reduce(function(a,i){return a+all[i].t.length;},0);
  for(var k=0;k<sc.length&&used<budget;k++){if(!sc[k].s)break;[sc[k].i,sc[k].i+1].forEach(function(i){if(i<all.length&&!keep[i]&&all[i].d===all[sc[k].i].d&&used+all[i].t.length<=budget){keep[i]=1;used+=all[i].t.length;}});}
  var L=all.filter(function(x,i){return keep[i];}),names=specials(all,keep);
  /* 보내지 않은 쪽에 어떤 특약이 있는지 이름만이라도 알려, AI가 '범위 밖에 이런 특약이 있음'을 말할 수 있게 한다 */
  return {text:fmt(L)+(names.length?'\n\n[보내지 않은 쪽에 있는 특별약관 이름 — 내용은 없음]\n'+names.join(', '):''),part:'약관 '+totalPages()+'쪽 중 관련 '+L.length+'쪽 읽힘',used:L.length,all:all.length,names:names};
}

/* ---------- 빠짐없이 전체 읽기: 약관 전체를 묶음으로 나눠 AI가 모든 쪽을 읽고 관련 쪽을 고른 뒤, 고른 쪽 원문으로 답한다 ---------- */
function chunks(all,cap){var out=[],cur=[],n=0;all.forEach(function(x){
  /* 한 쪽이 묶음보다 길면(드묾) 잘라서 이어 붙인다 — 버리지 않는다 */
  var parts=[];for(var o=0;o<x.t.length;o+=cap-200)parts.push(x.t.slice(o,o+cap-200));
  parts.forEach(function(t,j){var y={d:x.d,p:x.p,name:x.name,t:j?'(이어서) '+t:t};if(n+t.length+20>cap&&cur.length){out.push(cur);cur=[];n=0;}cur.push(y);n+=t.length+20;});});
  if(cur.length)out.push(cur);return out;}
/* ---------- 특약 목차 만들기: 본문에서 「…특별약관」·「보통약관」·「[별표…]」 제목 줄을 찾아 약관을 특약 단위로 나눈다 ---------- */
function headLine(l){
  l=String(l||'').trim().replace(/\s+/g,' ');
  if(l.length<4||l.length>80||/\d$/.test(l))return '';          /* 목차 줄은 끝에 쪽번호가 붙는다 */
  if(/^[\[【<〔(]\s*별\s*표/.test(l))return l;
  if(/^(\S{1,20}\s)?보통\s*약관$/.test(l))return l;
  if(/특별\s*약관$/.test(l)&&!/제\s*\d+\s*조/.test(l)&&!/(^|\s)(이|본|위|해당|각|그|다음의?|아래의?)\s*특별\s*약관$/.test(l)&&!/(니다|한다|된다|있다|다\.)/.test(l))return l;
  return '';
}
function sections(d){
  var cand=[];
  d.pages.forEach(function(pg,k){
    var L=pg.t.split('\n'),found=[];
    L.forEach(function(l,j){var h=headLine(l);if(!h)return;
      var after=L.slice(j+1).join('\n')+'\n'+(d.pages[k+1]?d.pages[k+1].t.slice(0,800):'');
      /* 특약 제목은 바로 뒤에 제1조가 나오거나 번호(2-3.)가 붙어 있어야 진짜 제목으로 본다 (본문 속 '…특별약관' 문장 걸러내기) */
      if(/특별\s*약관$/.test(h)&&!/^\d+(-\d+)*\.?\s/.test(h)&&!/제\s*1\s*조/.test(after.slice(0,1500)))return;
      found.push({t:h.replace(/^\d+(-\d+)*\.?\s*/,''),j:j});});
    if(found.length>=6)return;                                     /* 한 쪽에 제목이 잔뜩 = 목차 쪽 */
    found.forEach(function(h){cand.push({p:pg.p,t:h.t,top:h.j<=2});});
  });
  var S2=[],cur={t:'앞부분 (안내·요약서·목차)',a:d.pages.length?d.pages[0].p:1};
  cand.forEach(function(c){if(c.t===cur.t)return;cur.b=c.top&&c.p>cur.a?c.p-1:c.p;if(cur.b>=cur.a&&!(S2.length===0&&c.p===cur.a&&cur.t.indexOf('앞부분')===0))S2.push(cur);cur={t:c.t,a:c.p};});
  cur.b=d.pages.length?d.pages[d.pages.length-1].p:cur.a;S2.push(cur);
  return S2;
}
function allSecs(){var out=[];S.docs.forEach(function(d,di){if(!d.secs)d.secs=sections(d);d.secs.forEach(function(x){out.push({id:'S'+(out.length+1),d:di,a:x.a,b:x.b,t:x.t});});});return out;}
function canToc(){return allSecs().length>=5;}
function secText(x){var d=S.docs[x.d];return d.pages.filter(function(p){return p.p>=x.a&&p.p<=x.b;}).map(function(p){return p.t;}).join('\n');}
function tocLines(secs,cap,mark){mark=mark||{};
  var base=secs.reduce(function(a,x){return a+x.t.length+22;},0),sn=Math.max(0,Math.min(140,Math.floor((cap-base)/Math.max(1,secs.length))-12));
  return secs.map(function(x){var t=secText(x),i=t.search(/보험금의\s*지급\s*사유/),snip='';
    if(sn>20){snip=(i>=0?t.slice(i,i+sn+40):t.slice(0,sn)).replace(/\s+/g,' ').slice(0,sn);}
    return x.id+' | '+(S.docs.length>1?'문서'+(x.d+1)+' ':'')+'p.'+x.a+(x.b>x.a?'~'+x.b:'')+' | '+x.t+(mark[x.id]?' | [키워드: '+mark[x.id]+']':'')+(snip?' | '+snip:'');});
}
function caps(paste){var p=window.KIFAI?KIFAI.cfg().prov:'';return {quick:paste?45000:(p==='openai'?150000:220000),chunk:paste?60000:(p==='gemini'?220000:p==='openai'?120000:150000),final:paste?45000:(p==='openai'?120000:150000),toc:paste?55000:100000};}
function plan(){var a=aiState(),c=caps(a.paste),all=allPages(),sz=size(all),fits=sz<=c.quick,n=fits?1:chunks(all,c.chunk).length,toc=!fits&&canToc();
  var auto=toc&&(a.paste||n>4)?'toc':'full',m=S.mode||auto;if(m==='toc'&&!toc)m='full';
  return {paste:a.paste,fits:fits,n:n,pages:totalPages(),toc:toc,secs:toc?allSecs().length:0,mode:fits?'all':m};}
/* 답 모양이 조금 어긋나도(따옴표가 깨지는 등) 필요한 것만 꺼내 읽는다 */
function mapParse(t){t=String(t||'');var out=[];(t.match(/\{[^{}]*?"p"\s*:\s*\d+[^{}]*?\}/g)||[]).forEach(function(o){var p=o.match(/"p"\s*:\s*(\d+)/),d=o.match(/"d"\s*:\s*(\d+)/),w=o.match(/"where"\s*:\s*"([^"]{0,60})/);out.push({p:+p[1],d:d?+d[1]:1,where:w?w[1]:'',why:'',quote:''});});
  if(out.length||/"pages"\s*:\s*\[\s*\]/.test(t))return {pages:out};return null;}
function tocParse(t){var m=String(t||'').match(/\bS\d{1,4}\b/g);return m?{sections:m}:null;}
function ansParse(t,explicit){t=String(t||'');var m=t.match(/"answer"\s*:\s*"([\s\S]*?)"\s*,\s*"(points|refs|caution)"/);
  if(m)return {answer:m[1].replace(/\\n/g,'\n'),points:[],refs:[],caution:'AI 답의 형식이 조금 달라 답 본문만 옮겼습니다. 근거 조항은 원문으로 확인하세요.'};
  if(explicit&&t.trim().length>30&&!/<<KIF|\[한국보험금융 FC 포털 요청\]/.test(t))return {answer:t.trim(),points:[],refs:[],caution:'AI 답이 정해진 형식이 아니라 그대로 옮겼습니다.'};return null;}
function tocPrompt(q,k,n,G){
  return '너는 보험 약관에서 질문에 답하는 데 필요한 부분을 고르는 도우미다. 아래 [목록]은 약관 전체를 특약·조항 단위로 나눈 목록이다(번호 | 쪽 | 제목 | 지급사유 첫 문구)'+(n>1?' — 목록이 길어 '+n+'번에 나눠 보내며 이번은 '+k+'번째':'')+'. 이번에는 답을 쓰지 말고 읽어야 할 항목 번호만 고른다.\n'+
    '규칙:\n1) 목록을 처음부터 끝까지 모두 보고, 질문에 답하려면 읽어야 할 항목을 모두 고른다. 이름이 질문의 말과 달라도 뜻이 같거나 관련되면 고른다(예: 재발→계속받는·재진단·2차, 수술→수술비, 치료→항암·방사선·표적·직접치료·주요치료).\n'+
    '2) 그 보장의 지급 조건을 바꾸는 항목(보통약관, 관련 별표 분류표, 용어 정의)도 고른다.\n'+
    '3) [키워드: …] 표시는 질문의 주요 키워드가 그 항목 본문에 나온다는 뜻이다(포털이 이미 골라 둠). 표시가 없어도 관련 있으면 꼭 고른다.\n4) 빠뜨리는 것보다 넉넉히 고르는 편이 낫다. 다만 질문과 상관없는 특약까지 고르지는 않는다.\n'+
    '\n답은 설명 없이 JSON 하나로만: {"sections":["S12","S40"],"why":"고른 이유 한 줄"}\n\n[질문]\n'+q+(G&&G.length?'\n[질문의 주요 키워드]\n'+kwText(G):'')+'\n\n[목록]';
}
function mapPrompt(q,k,n){
  return '너는 보험 약관에서 질문과 관련된 부분을 빠짐없이 찾아내는 도우미다. 아래 [약관]은 약관 전체를 '+n+'묶음으로 나눈 것 중 '+k+'번째 묶음이다. 이번에는 답을 쓰지 말고, 관련된 쪽만 찾는다.\n'+
    '규칙:\n1) 이 묶음의 모든 쪽을 처음부터 끝까지 읽고, 질문과 조금이라도 관련 있는 쪽은 모두 고른다. 빠뜨리는 것보다 많이 고르는 편이 낫다.\n'+
    '2) 특약·담보 이름이 질문의 말과 달라도 뜻이 같으면 고른다(예: 재발→재진단·계속받는·2차, 수술→수술비·수술특약, 치료→항암·방사선·표적·통원).\n'+
    '3) 표와 별표(질병·수술 분류표, 지급률표, 장해분류표 등)에 질문 관련 항목이 있으면 그 쪽도 고른다.\n'+
    '4) 지급하지 않는 사유(면책), 감액, 보장개시일, 지급 횟수·한도(최초 1회 등), 용어 정의처럼 답을 바꿀 수 있는 조건이 있는 쪽도 고른다.\n'+
    '5) 쪽마다 문서번호(d, ===== 문서N 의 N)와 쪽번호(p, [p.숫자]의 숫자), 조항·특약 이름(where), 관련 이유(why, 30자 이내), 핵심 문구(quote, 원문 그대로 120자 이내)를 적는다.\n'+
    '\n답은 설명 없이 JSON 하나로만: {"pages":[{"d":1,"p":12,"where":"조항·특약 이름","why":"관련 이유","quote":"원문 문구"}]} 관련된 쪽이 하나도 없으면 {"pages":[]}\n\n'+
    '[질문]\n'+q+(kwGroups(q).length?'\n[질문의 주요 키워드 — 이 낱말(같은 뜻 포함)이 나오는 쪽은 특히 놓치지 말 것]\n'+kwText(kwGroups(q)):'')+'\n\n[약관 '+k+'/'+n+'묶음]';
}
function prompt(q,part,full){
  return '너는 한국 보험 약관을 읽고 보험설계사(FC)의 상담을 돕는 약관 분석 도우미다.\n'+
    '규칙:\n1) 아래 [약관] 글에 적힌 내용만 근거로 답한다. 약관에 없는 내용은 "약관에서 찾지 못함"이라고 쓰고 추측하지 않는다.\n'+
    '2) 금액·기간·비율은 약관 문구 그대로 옮긴다. 상품마다 가입금액이 다르면 "가입금액의 OO%"처럼 쓴다.\n'+
    '3) 근거는 조항 이름(예: 제3조(보험금의 지급사유))과 쪽([p.숫자] 표시)을 함께 적고, 핵심 문구를 짧게(80자 이내) 그대로 인용한다.\n'+
    '4) FC가 고객에게 바로 설명할 수 있게 쉬운 말로, 존댓말로 쓴다. 지급을 보장하는 표현("무조건 나옵니다")은 쓰지 않는다.\n'+
    (full?'5) 약관 전체('+full+')를 먼저 모두 읽어 질문과 관련된 쪽을 골랐고, 아래는 그 쪽들의 원문이다. 관련 특약이 여러 개면 빠짐없이 모두 답에 넣는다. [원문을 다 싣지 못한 관련 쪽 — 찾은 문구] 가 있으면 그것도 근거로 쓰되 원문 확인이 필요하다고 caution에 적는다.\n':
     part?'5) 약관이 길어 질문과 관련된 쪽만 보냈다('+part+'). 빠진 부분이 있을 수 있으면 caution에 적고, 맨 끝 [보내지 않은 쪽에 있는 특별약관 이름] 중 질문과 관련 있어 보이는 특약 이름과 쪽을 caution에 함께 적어 FC가 따로 확인하게 한다.\n':'')+
    '\n답은 설명 없이 JSON 하나로만: {"answer":"질문에 대한 답(3~8문장)","points":["상담 때 짚을 핵심 2~5개"],"refs":[{"where":"조항 이름 (p.쪽)","quote":"약관 원문 인용"}],"caution":"주의할 점이나 확인이 더 필요한 것(없으면 빈 글자)"}\n\n'+
    '[질문]\n'+q+'\n\n[약관]';
}
function now(){var d=new Date(),z=function(n){return (n<10?'0':'')+n;};return (d.getMonth()+1)+'/'+d.getDate()+' '+z(d.getHours())+':'+z(d.getMinutes());}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function askOnce(p,mat){try{return await KIFAI.ask(p,mat);}catch(e){if(e&&(e.code==='rate_limited'||e.code==='network'||e.code==='bad_json')&&!aiState().paste){await sleep(e.code==='rate_limited'?20000:3000);return await KIFAI.ask(p,mat);}throw e;}}
function isEcho(r){return /^질문에 대한 답\(3~8문장\)$/.test(String(r&&r.answer||'').trim());}
/* 지금 올린 약관에서 AI가 읽지 못하는 부분 (글자 없는 쪽, 1500쪽 넘는 부분, 문자 인식 쪽) — 답마다 항상 보여 준다 */
function gaps(){return S.docs.map(function(d){return {name:d.name,weak:d.weak.slice(),cut:d.num>d.pages.length?[d.pages.length+1,d.num]:null,ocr:d.ocrd.length};}).filter(function(g){return g.weak.length||g.cut||g.ocr;});}
/* 쪽 묶음 읽기 → 관련 쪽 고르기 → 고른 쪽 원문으로 답. o.pages(읽을 쪽, 기본 전체), o.label·o.off·o.tot(진행 표시), o.extra(답할 때 덧붙일 안내) */
async function fullRead(q,root,item,step,o){
  o=o||{};var a=aiState(),c=caps(a.paste),all=allPages(),src=o.pages||all,C=chunks(src,c.chunk),n=C.length,hits=[],seen={},k0=0,off=o.off||0,tot=o.tot||(n+1),lab=o.label||'빠짐없이 전체 읽기';
  var fits=size(src)<=c.final;
  /* 붙여넣기를 중간에 멈췄으면 같은 질문·같은 약관일 때 멈춘 묶음부터 이어서 읽는다 */
  var key=(o.key||'full')+'|'+q+'|'+n+'|'+src.length,R=S.resume;if(R&&R.key===key){k0=R.k;hits=R.hits;seen=R.seen;}
  S.resume=null;
  if(fits){n=0;src.forEach(function(x){hits.push({d:x.d,p:x.p,where:'',why:'',quote:''});});}
  for(var k=k0;k<n;k++){
    step('약관 묶음 '+(k+1)+'/'+n+' 읽는 중',off+k+1,tot);
    var r;try{r=await askOnce(mapPrompt(q,k+1,n),{text:fmt(C[k]),images:[],scanned:[],parse:mapParse,step:lab+' '+(off+k+1)+'/'+tot+' — 약관 묶음 '+(k+1)+'/'+n+' (같은 AI 대화창에 이어서 붙여넣어도 됩니다)'});}
    catch(e){if(e&&e.code==='paste_cancel'&&k>0)S.resume={key:key,k:k,hits:hits,seen:seen,o:o};throw e;}
    if(!r||!Array.isArray(r.pages))throw {code:'map_bad',message:'묶음 '+(k+1)+'/'+n+'의 AI 답 형식이 맞지 않습니다. 다시 눌러 주세요.'};
    var inC={};C[k].forEach(function(x){inC[x.d+':'+x.p]=1;});
    r.pages.forEach(function(h){var d=(+h.d||1)-1,p=+h.p,kk=d+':'+p;if(!inC[kk]){/* 문서번호를 틀리게 적은 경우: 쪽번호로 맞춘다 */var m=C[k].filter(function(x){return x.p===p;});if(m.length===1){d=m[0].d;kk=d+':'+p;}else return;}
      if(!seen[kk]){seen[kk]=1;hits.push({d:d,p:p,where:String(h.where||'').split('\n')[0].slice(0,40),why:String(h.why||''),quote:String(h.quote||'')});}});
  }
  /* 고른 쪽 + 다음 쪽(조항이 넘어가는 경우)의 원문을 싣는다. 다 못 실으면 찾은 문구로 대신하고 그 사실을 표시 */
  var idx={};all.forEach(function(x,i){idx[x.d+':'+x.p]=i;});
  var keep={},used=0,left=[];
  hits.sort(function(x,y){return x.d-y.d||x.p-y.p;}).forEach(function(h){var i=idx[h.d+':'+h.p];if(i==null)return;if(used+all[i].t.length<=c.final){if(!keep[i]){keep[i]=1;used+=all[i].t.length;}}else left.push(h);});
  if(n)hits.forEach(function(h){var i=idx[h.d+':'+h.p],j=i+1;if(i!=null&&j<all.length&&!keep[j]&&all[j].d===all[i].d&&used+all[j].t.length<=c.final){keep[j]=1;used+=all[j].t.length;}});
  var L=all.filter(function(x,i){return keep[i];}),text=L.length?fmt(L):'(읽었지만 질문과 관련된 쪽을 찾지 못했습니다)';
  if(left.length)text+='\n\n[원문을 다 싣지 못한 관련 쪽 — 찾은 문구]\n'+left.map(function(h){return '- 문서'+(h.d+1)+' p.'+h.p+' '+h.where+': "'+h.quote+'"';}).join('\n');
  step(n?'찾은 '+hits.length+'쪽으로 답 정리 중':'고른 부분으로 답 정리 중',off+n+1,off+n+1);
  var res;try{res=await askOnce(prompt(q,'',o.full||(totalPages()+'쪽, '+n+'묶음')),{text:text+(o.extra||''),images:[],scanned:[],parse:ansParse,step:lab+' '+(off+n+1)+'/'+(off+n+1)+' — 마지막: 찾은 부분으로 답 정리'});}
  catch(e){if(e&&e.code==='paste_cancel')S.resume={key:key,k:n,hits:hits,seen:seen,o:o};throw e;}
  item.cov={mode:'full',pages:totalPages(),n:n,hits:hits.length,hitList:n?hits.map(function(h){return {d:h.d,p:h.p,where:h.where};}):[],left:left.length,gaps:gaps()};
  return res;
}
/* 특약 목차로 좁혀 읽기: ① AI가 전체 특약·조항 목록(제목+지급사유 첫 문구)을 모두 보고 관련 항목을 고른다 ② 고른 항목의 원문 전체를 읽혀 답한다 */
async function tocRead(q,root,item,step){
  var a=aiState(),c=caps(a.paste),secs=allSecs(),G=kwGroups(q),K=kwSecs(G),mark={};
  /* ① 키워드가 나오는 특약을 포털이 먼저 모은다 (제목에 나오면 꼭, 나머지는 점수 순으로 읽을 수 있는 만큼) */
  var kw=[],kwUsed=0,kwDrop=[],lim=c.final*3;
  K.forEach(function(r){var sz=secText(r.x).length;mark[r.x.id]=r.hit.join('·');if(r.th||kwUsed+sz<=lim){kw.push(r.x);kwUsed+=sz;}else kwDrop.push(r.x);});
  var L=tocLines(secs,c.toc,mark),parts=[],cur=[],n=0;
  L.forEach(function(l){if(n+l.length+1>c.toc&&cur.length){parts.push(cur);cur=[];n=0;}cur.push(l);n+=l.length+1;});if(cur.length)parts.push(cur);
  var key='toc|'+q+'|'+secs.length+'|'+kwText(G),chosen=[],seen={};
  if(S.tocSel&&S.tocSel.key===key)chosen=S.tocSel.chosen;
  else{
    for(var k=0;k<parts.length;k++){
      step('특약 목록 '+(parts.length>1?(k+1)+'/'+parts.length+' ':'')+'보고 고르는 중',k+1,parts.length+1);
      var r=await askOnce(tocPrompt(q,k+1,parts.length,G),{text:parts[k].join('\n'),images:[],scanned:[],parse:tocParse,step:'키워드·특약 목차로 찾기 '+(k+1)+'/'+(parts.length+1)+'~ — 먼저 특약 목록에서 관련 항목 고르기'});
      if(!r||!Array.isArray(r.sections))throw {code:'map_bad',message:'특약 목록 고르기의 AI 답 형식이 맞지 않습니다. 다시 눌러 주세요.'};
      r.sections.forEach(function(id){id=String(id).trim().toUpperCase();var x=secs.filter(function(y){return y.id===id;})[0];if(x&&!seen[id]){seen[id]=1;chosen.push(x);}});
    }
    S.tocSel={key:key,chosen:chosen};
  }
  var kwId={};kw.forEach(function(x){kwId[x.id]=1;});var aiOnly=chosen.filter(function(x){return !kwId[x.id];});
  chosen=kw.concat(aiOnly);
  if(!chosen.length)throw {code:'toc_none',message:'AI가 특약 목록에서 관련 항목을 고르지 못했습니다. 질문을 조금 바꾸거나 「빠짐없이 전체 읽기」를 골라 주세요.'};
  var want={};chosen.forEach(function(x){for(var p=x.a;p<=x.b;p++)want[x.d+':'+p]=1;});
  var pages=allPages().filter(function(x){return want[x.d+':'+x.p];});
  var off=parts.length,res=await fullRead(q,root,item,step,{pages:pages,key:key,label:'키워드·특약 목차로 찾기',off:off,tot:off+(size(pages)<=c.final?1:chunks(pages,c.chunk).length+1),
    full:'특약·조항 목록 '+secs.length+'개를 모두 보고 고른 '+chosen.length+'개, '+pages.length+'쪽',
    extra:'\n\n[목록에서 고른 항목]\n'+chosen.map(function(x){return x.id+' '+x.t+' (p.'+x.a+'~'+x.b+')';}).join('\n')});
  S.tocSel=null;
  var nm=function(x){return (S.docs.length>1?'문서'+(x.d+1)+' ':'')+x.t+' (p.'+x.a+(x.b>x.a?'~'+x.b:'')+')';};
  item.cov={mode:'toc',pages:totalPages(),secs:secs.length,kw:kwText(G),kwList:kw.map(function(x){return nm(x)+(mark[x.id]?' — '+mark[x.id]:'');}),aiList:aiOnly.map(nm),drop:kwDrop.map(nm),chosen:chosen.map(function(x){return (S.docs.length>1?'문서'+(x.d+1)+' ':'')+x.t+' (p.'+x.a+(x.b>x.a?'~'+x.b:'')+')';}),cpages:pages.length,n:item.cov.n,left:item.cov.left,gaps:gaps()};
  return res;
}
async function ask(root,force){
  var qEl=root.querySelector('#polQ'),q=(force&&force.q)||qEl.value.trim();
  if(S.busy)return;
  if(!q){qEl.focus();setMsg(root,'질문을 적어 주세요.');return;}
  if(!S.docs.length){setMsg(root,'먼저 2번에서 약관 PDF를 올려 주세요.');var d=root.querySelector('#polDrop');d&&d.scrollIntoView({block:'center',behavior:'smooth'});return;}
  var a=aiState();if(!a.ok){setMsg(root,'먼저 1번에서 AI를 연결해 주세요.');if(window.KIFAI)KIFAI.open();return;}
  var pl=plan(),mode=pl.fits?'all':((force&&force.mode)||pl.mode);
  S.busy=true;var b=root.querySelector('#polAsk');b.disabled=true;b.textContent='찾는 중…';
  var lab=mode==='toc'?'키워드·특약 목차로 찾기':'빠짐없이 전체 읽기';
  var step=function(t,k,n){setMsg(root,lab+' '+k+'/'+n+' · '+t+'…');b.textContent='읽는 중 '+k+'/'+n;};
  var item={q:q,at:now()},r;
  try{
    if(mode==='full'){r=await fullRead(q,root,item,step);item.part='전체 '+item.cov.pages+'쪽 읽음';}
    else if(mode==='toc'){r=await tocRead(q,root,item,step);item.part='특약 목록 전체 확인 · 관련 '+item.cov.chosen.length+'개 원문 읽음';}
    else{var sel=pick(q,caps(a.paste).quick);item.part=sel.part;setMsg(root,'AI가 약관을 읽고 있습니다'+(sel.part?' ('+sel.part+')':'')+'…');
      r=await askOnce(prompt(q,sel.part),{text:sel.text,images:[],scanned:[],parse:ansParse});
      item.cov={mode:pl.fits?'all':'quick',pages:totalPages(),used:sel.used,names:sel.names,gaps:gaps()};}
    if(!r||typeof r!=='object')throw {code:'bad_json'};
    if(isEcho(r))throw {code:'echo',message:'AI 답 대신 보낸 질문의 형식 틀이 들어왔습니다. AI 창에서 답 아래의 복사 아이콘을 누른 뒤 다시 가져와 주세요.'};
    if(!r.answer&&r.text)r.answer=r.text;item.r=r;setMsg(root,'');if(!force){qEl.value='';S.kw='';var kb=root.querySelector('#polKw');if(kb)kb.innerHTML='';}}
  catch(e){if(e&&e.code==='paste_cancel'){if(mode!=='quick'&&!pl.fits){var go=S.resume||S.tocSel;setMsg(root,go?lab+'를 중간에 멈췄습니다. 같은 질문으로 「약관에서 찾기」를 다시 누르면 멈춘 곳부터 이어서 합니다.':lab+'를 멈췄습니다.');if(go&&!force)qEl.value=q;}else setMsg(root,KIFAI.err(e));item=null;}else{item.err=KIFAI.err(e);setMsg(root,'');}}
  S.busy=false;b.disabled=false;b.textContent='약관에서 찾기';
  if(item){S.qa.unshift(item);var an=root.querySelector('#polAns');an.innerHTML=ansHtml();an.scrollIntoView({block:'start',behavior:'smooth'});}
}
function setMsg(root,t){S.msg=t;var m=root.querySelector('#polMsg');if(m)m.textContent=t;}
function refreshDocs(root){var d=root.querySelector('#polDocs');if(d)d.innerHTML=docsHtml();var h=root.querySelector('#polHint');if(h)h.textContent=S.docs.length?'올린 약관 '+S.docs.length+'개 · '+totalPages()+'쪽을 기준으로 답합니다.':'먼저 2번에서 약관 PDF를 올려 주세요.';
  var st=root.querySelectorAll('.pol-st')[1];if(st)st.classList.toggle('done',S.docs.length>0);var mo=root.querySelector('#polMode');if(mo)mo.innerHTML=modeHtml();var kb=root.querySelector('#polKw');if(kb)kb.innerHTML=kwHtml();}
async function addFiles(root,files){
  files=Array.prototype.filter.call(files||[],function(f){return f.type==='application/pdf'||/\.pdf$/i.test(f.name);});
  if(!files.length){setMsg(root,'PDF 파일만 올릴 수 있습니다.');return;}
  for(var i=0;i<files.length;i++){
    if(S.docs.some(function(d){return d.name===files[i].name;})){setMsg(root,'「'+files[i].name+'」은 이미 올렸습니다.');continue;}
    try{var d=await readPdf(files[i],function(t){setMsg(root,t);});S.docs.push(d);refreshDocs(root);
      setMsg(root,'✓ 「'+d.name+'」 '+d.pages.length+'쪽을 읽었습니다.'+(d.num>MAXP?' (앞 '+MAXP+'쪽까지)':'')+(d.ocr?' (문자 인식 — 글자가 틀릴 수 있습니다)':'')+(d.weak.length?' 글자가 없는 쪽 '+d.weak.length+'개는 아래 「문자 인식으로 읽기」를 눌러 주세요.':''));}
    catch(e){setMsg(root,(e&&e.message)||String(e));}
  }
}
function copyText(t){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);return true;}}catch(e){}var x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}x.remove();return ok;}
function answerText(a){var r=a.r||{};return 'Q. '+a.q+'\n\n'+(r.answer||'')+(r.points&&r.points.length?'\n\n'+r.points.map(function(p){return '· '+p;}).join('\n'):'')+(r.refs&&r.refs.length?'\n\n[약관 근거]\n'+r.refs.map(function(f){return '- '+(f.where||'')+(f.quote?' : "'+f.quote+'"':'');}).join('\n'):'')+(r.caution?'\n\n※ '+r.caution:'')+'\n\n(약관 분석 참고용 · 최종 확인은 약관 원문과 보험사)';}


/* ---------- 관리자: 공시실 바로가기 고치기 (content.json policyLinks로 저장, 모든 FC 화면에 반영) ---------- */
function isAdmin(){try{return !!(window.KIFPUB&&KIFPUB.admin&&KIFPUB.admin());}catch(e){return false;}}
function lines(L){return (L||[]).map(function(x){return x[0]+' | '+x[1];}).join('\n');}
function parse(t){return String(t||'').split('\n').map(function(l){var p=l.split('|').map(function(y){return y.trim();});return p;}).filter(function(p){return p[0]&&/^https?:\/\//.test(p[1]||'');}).map(function(p){return [p[0],p[1]];});}
function adminHtml(){
  if(!isAdmin())return '';
  return '<details class="pol-adm" style="margin-top:14px;border-top:1px dashed var(--line-strong);padding-top:10px"><summary style="cursor:pointer;font-weight:700;color:var(--gold)">관리자: 바로가기 목록 고치기</summary>'+
    '<p class="note">한 줄에 <b>이름 | 주소</b> 하나씩 적습니다. 저장하면 모든 FC 화면에 바로 반영됩니다.</p>'+
    [['common','협회 공시실'],['life','생명보험'],['nonlife','손해보험']].map(function(k){return '<label class="note" style="display:block;margin-top:8px"><b>'+k[1]+'</b><textarea class="pol-q" style="min-height:90px;font-size:.85rem" data-pl="'+k[0]+'">'+esc(lines(LINKS[k[0]]))+'</textarea></label>';}).join('')+
    '<div class="pol-qr"><span class="note" id="polAdmMsg" role="status"></span><button type="button" class="btn sm gold" data-pol="plsave">저장해서 반영</button></div></details>';
}
async function saveLinks(root,b){
  var o={},m=root.querySelector('#polAdmMsg');
  root.querySelectorAll('[data-pl]').forEach(function(t){o[t.dataset.pl]=parse(t.value);});
  if(!o.life.length||!o.nonlife.length){m.textContent='생명·손해보험 목록이 비었습니다. "이름 | https://주소" 형식인지 확인하세요.';return;}
  b.disabled=true;m.textContent='저장 중…';
  try{await KIFPUB.policyLinks(o);LINKS.common=o.common.length?o.common:LINKS.common;LINKS.life=o.life;LINKS.nonlife=o.nonlife;
    var dd=root.querySelector('#polDir');dd.outerHTML=linksHtml();var nd=root.querySelector('#polDir');nd.open=true;var a=nd.querySelector('.pol-adm');if(a)a.open=true;var mm=root.querySelector('#polAdmMsg');if(mm)mm.textContent='✓ 저장했습니다. 1~2분 뒤 모든 화면에 반영됩니다.';}
  catch(e){b.disabled=false;m.textContent='저장하지 못했습니다: '+((e&&e.message)||e);}
}
/* ---------- 이벤트 ---------- */
function bind(root){
  if(!root)return;addCss();
  var drop=root.querySelector('#polDrop'),file=root.querySelector('#polFile');
  file.addEventListener('change',function(){addFiles(root,file.files).then(function(){file.value='';});});
  ['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over');});});
  ['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over');});});
  drop.addEventListener('drop',function(e){addFiles(root,e.dataTransfer&&e.dataTransfer.files);});
  root.addEventListener('change',function(e){var t=e.target;if(t&&t.name==='polMode'){S.mode=t.value;try{localStorage.setItem('kif_pol_mode2',S.mode);}catch(er){}var mo=root.querySelector('#polMode');if(mo)mo.innerHTML=modeHtml();}});
  var kt=null,kwRefresh=function(){var k=root.querySelector('#polKw');if(k)k.innerHTML=kwHtml();};
  root.querySelector('#polQ').addEventListener('input',function(){S.kw='';clearTimeout(kt);kt=setTimeout(kwRefresh,500);});
  root.addEventListener('change',function(e){if(e.target&&e.target.id==='polKwIn'){S.kw=e.target.value.trim();kwRefresh();}});
  root.querySelector('#polQ').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();ask(root);}});
  root.addEventListener('click',function(e){
    var b=e.target.closest('[data-pol]');if(!b||!root.contains(b))return;var k=b.dataset.pol,i=+b.dataset.i;
    if(k==='guide')guide();else if(k==='keyhelp')keyHelp();
    else if(k==='rm'){S.docs.splice(i,1);refreshDocs(root);setMsg(root,'');}
    else if(k==='tab'){S.tab=b.dataset.v;var L=S.tab==='life'?LINKS.life:LINKS.nonlife;
      root.querySelectorAll('[data-pol="tab"]').forEach(function(x){var on=x.dataset.v===S.tab;x.classList.toggle('on',on);x.setAttribute('aria-selected',on);});
      root.querySelector('#polDir .pol-co:not(.wide)').innerHTML=L.map(function(x){return '<a target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(x[0])+' ↗</a>';}).join('');}
    else if(k==='plsave')saveLinks(root,b);
    else if(k==='ex'){var q=root.querySelector('#polQ');q.value=EX[i][1];S.kw='';q.focus();var kb=root.querySelector('#polKw');if(kb)kb.innerHTML=kwHtml();}
    else if(k==='ask')ask(root);
    else if(k==='ocr')ocrWeak(root,i);
    else if(k==='redo'){var qa=S.qa[i];if(qa)ask(root,{q:qa.q,mode:'full'});}
    else if(k==='copy'){var ok=copyText(answerText(S.qa[i]));b.textContent=ok?'✓ 복사됨':'복사 실패';setTimeout(function(){b.textContent='답 복사';},1500);}
    else if(k==='del'){S.qa.splice(i,1);root.querySelector('#polAns').innerHTML=ansHtml();}
  });
}
if(window.KIFAI)KIFAI.onChange(function(){var el=document.getElementById('polAi');if(el){el.outerHTML=aiBox();var st=document.querySelector('.pol-st');if(st)st.classList.toggle('done',aiState().ok);}var mo=document.getElementById('polMode');if(mo)mo.innerHTML=modeHtml();});
window.KIFPOL={html:html,bind:bind,card:card,css:addCss};
})();
