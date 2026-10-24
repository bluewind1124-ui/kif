/* 한보금on 「약관 분석」 — 보험 약관 PDF를 이 브라우저 안에서 읽고, 질문하면 등록한 AI(내 AI 등록 = window.KIFAI)가 약관 근거로 답한다.
   - AI 연결은 포털 공통 「내 AI 등록」을 그대로 쓴다(관리자는 회사 AI 기본 연결). 따로 키 칸을 두지 않는다.
   - PDF는 서버로 보내지 않는다. 글자를 꺼내 질문과 함께 AI에만 보낸다. 글자 없는 스캔 PDF는 KIFAI.ocrPdf(문자 인식)로 읽는다.
   - 약관이 길면 질문과 관련 깊은 쪽만 골라 보낸다(복사·붙여넣기는 더 적게).
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
var S={docs:[],qa:[],busy:false,tab:'life',msg:''};
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
  var c=K.cfg(),ok=K.chosen()&&c.mode==='ai'&&!(K.AIP[c.prov]&&K.AIP[c.prov].key&&!c.keys[c.prov]);
  return {ok:ok,paste:c.prov==='paste',html:K.statusHTML()};
}
function aiBox(){
  var a=aiState();
  return '<div class="pol-ai" id="polAi"><div class="s">'+a.html+(a.ok&&a.paste?'<br><span class="note">복사·붙여넣기 방식은 질문을 AI 사이트에 붙여넣고 답을 다시 가져옵니다. 약관이 길면 질문과 관련된 쪽만 골라 보냅니다.</span>':'')+'</div>'+
    '<button type="button" class="btn sm'+(a.ok?' ghost':' gold')+'" data-kai-open>'+(a.ok?'AI 바꾸기':'내 AI 등록')+'</button><button type="button" class="btn sm ghost" data-pol="keyhelp">AI 연결 방법</button></div>';
}
function docsHtml(){
  if(!S.docs.length)return '';
  return '<ul class="pol-docs">'+S.docs.map(function(d,i){
    var ch=d.pages.reduce(function(x,p){return x+p.t.length;},0);
    return '<li><b>📄 '+esc(d.name)+'</b><span class="note">'+d.num+'쪽'+(d.pages.length<d.num?' 중 '+d.pages.length+'쪽 읽음':'')+' · 글자 '+ch.toLocaleString()+'자</span>'+
      (d.ocr?'<span class="tag w">문자 인식</span>':'<span class="tag">읽기 완료</span>')+'<button type="button" class="pol-x" data-pol="rm" data-i="'+i+'" aria-label="'+esc(d.name)+' 빼기">✕</button></li>';}).join('')+'</ul>';
}
function linksHtml(){
  var L=S.tab==='life'?LINKS.life:LINKS.nonlife;
  return '<details class="pol-dir" id="polDir"><summary>🔗 약관은 어디서 받나요? — 보험사 공시실 바로가기</summary><div class="in">'+
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
      (r.caution?'<div class="cv">⚠ '+esc(r.caution)+'</div>':''))+
      '<div class="ft"><span class="note">'+esc(a.at)+(a.part?' · '+esc(a.part):'')+'</span>'+(a.err?'':'<button type="button" class="btn sm ghost" data-pol="copy" data-i="'+i+'">답 복사</button>')+'<button type="button" class="btn sm ghost" data-pol="del" data-i="'+i+'">지우기</button></div></div>';
  }).join('');
}
function html(){
  addCss();var a=aiState(),has=S.docs.length>0;
  return '<div class="pol">'+
    '<div class="pol-top"><div class="ph"><div class="kicker">교육 · 연계</div><h1>약관 분석</h1><p>보험 약관 PDF를 올리고 궁금한 것을 물어보세요. 등록한 AI가 약관을 읽고 <b>조항과 근거</b>를 붙여 답합니다. 파일은 서버에 올라가지 않습니다.</p></div>'+
      '<div class="bt"><button type="button" class="btn sm ghost" data-pol="guide">📖 이용 가이드</button><button type="button" class="btn sm ghost" data-go="home">✕ 닫기</button></div></div>'+
    '<div class="pol-cta"><span style="font-size:1.5rem" aria-hidden="true">💡</span><div class="note"><b>상담에 이렇게 써 보세요</b><br>고객이 "이것도 보험금 나와요?"라고 물을 때, 가입한 상품의 약관을 올리고 그대로 물어보면 해당 조항을 찾아 줍니다. 답은 참고용이니 최종 확인은 약관 원문으로 하세요.</div><button type="button" class="btn sm" data-pol="guide">사용 순서 보기</button></div>'+
    '<section class="pol-st'+(a.ok?' done':'')+'"><div class="pol-sh"><span class="n">1</span><h3>AI 연결하기</h3><span class="note">AI보장분석과 같은 AI를 씁니다 · 따로 등록할 필요 없음</span></div><div class="pol-sb">'+aiBox()+'</div></section>'+
    '<section class="pol-st'+(has?' done':'')+'"><div class="pol-sh"><span class="n">2</span><h3>약관 PDF 올리기</h3><span class="note">파일은 이 브라우저 안에서만 읽습니다</span></div><div class="pol-sb">'+
      '<label class="pol-drop" id="polDrop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12 17v-6M9.5 13.5L12 11l2.5 2.5"/></svg><b>약관 PDF를 여기에 끌어다 놓거나 눌러서 고르기</b><span class="note">주계약·특약 약관을 여러 개 함께 올려도 됩니다 · 서버로 보내지 않습니다</span><input type="file" id="polFile" accept="application/pdf,.pdf" multiple></label>'+
      '<div id="polDocs">'+docsHtml()+'</div><div class="pol-msg" id="polMsg" role="status">'+esc(S.msg)+'</div>'+linksHtml()+'</div></section>'+
    '<section class="pol-st'+(S.qa.length?' done':'')+'"><div class="pol-sh"><span class="n">3</span><h3>질문하기</h3><span class="note">약관에서 근거를 찾아 답합니다</span></div><div class="pol-sb">'+
      '<b style="font-size:.92rem">이렇게 물어보세요</b><div class="pol-ex">'+EX.map(function(x,i){return '<button type="button" data-pol="ex" data-i="'+i+'">'+esc(x[0])+'</button>';}).join('')+'</div>'+
      '<textarea class="pol-q" id="polQ" placeholder="예) 유방암 수술 후 재발하면 암 진단비를 또 받을 수 있나요?"></textarea>'+
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
    '<h4>③ 질문</h4><p style="margin:0">「이렇게 물어보세요」 버튼을 누르거나 고객이 물은 말을 그대로 적고 <b>약관에서 찾기</b>를 누릅니다. 답에는 근거 조항과 원문 인용이 붙습니다.</p>'+
    '<h4>스캔본(그림) PDF</h4><p style="margin:0">글자를 고를 수 없는 스캔본은 이 브라우저에서 문자 인식으로 읽습니다(앞 40쪽까지, 시간이 조금 걸림). 가능하면 공시실의 원본 PDF를 쓰세요.</p>'+
    '<h4>긴 약관</h4><p style="margin:0">약관이 아주 길면 질문과 관련이 깊은 쪽(목차 포함)만 골라 AI에 보냅니다. 답 아래에 몇 쪽을 읽혔는지 표시됩니다. 원하는 내용이 빠지면 질문에 <b>담보 이름·조항 이름</b>을 넣어 다시 물어보세요.</p>'+
    '<div class="pol-tip">고객 개인정보(이름·주민번호)가 담긴 증권이 아니라 <b>약관</b>만 올리세요. 답은 상담 참고용이며 지급 여부의 최종 판단은 보험사가 합니다.</div>');
}

/* ---------- PDF 읽기 ---------- */
var PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',CMAPS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
function loadPdf(){if(window.pdfjsLib){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return Promise.resolve();}
  return new Promise(function(res,rej){var s=document.createElement('script');s.src=PDFJS;s.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();};s.onerror=function(){rej(new Error('PDF 읽기 도구를 불러오지 못했습니다(인터넷 연결 확인).'));};document.head.appendChild(s);});}
var MAXP=400;
async function readPdf(f,prog){
  await loadPdf();var buf=await f.arrayBuffer(),doc;
  try{doc=await pdfjsLib.getDocument({data:buf.slice(0),cMapUrl:CMAPS,cMapPacked:true}).promise;}catch(e){throw new Error(f.name+' 파일을 열지 못했습니다'+(/password/i.test(e&&e.name||'')?' (비밀번호가 걸린 파일)':'')+'.');}
  var n=Math.min(doc.numPages,MAXP),pages=[],chars=0;
  for(var i=1;i<=n;i++){
    if(i%10===1)prog('「'+f.name+'」 읽는 중… '+i+'/'+n+'쪽');
    var pg=await doc.getPage(i),tc=await pg.getTextContent(),line='',last=null,t='';
    tc.items.forEach(function(it){var y=it.transform?Math.round(it.transform[5]):0;if(last!==null&&Math.abs(y-last)>3){t+=line.trim()+'\n';line='';}line+=it.str+(it.hasEOL?'':' ');last=y;});
    t=(t+line).replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').trim();chars+=t.replace(/\s/g,'').length;pages.push({p:i,t:t});
  }
  var d={name:f.name,num:doc.numPages,pages:pages,ocr:false};
  if(chars<Math.min(400,40*n)){
    if(!window.KIFAI||!KIFAI.ocrPdf)throw new Error(f.name+' — 글자가 없는 스캔본입니다. 공시실의 원본 PDF를 올려 주세요.');
    if(!confirmScan(f.name,doc.numPages))throw new Error(f.name+' — 스캔본이라 읽지 않았습니다. 공시실의 원본 PDF를 올려 주세요.');
    var r=await KIFAI.ocrPdf(buf,40,prog);
    d.ocr=true;d.pages=r.pages.map(function(t,k){return {p:k+1,t:String(t).replace(/^\[p\.\d+\]\s*/,'')};});
  }
  return d;
}
function confirmScan(nm,n){return window.confirm('「'+nm+'」은 글자 정보가 없는 스캔본(그림) PDF입니다.\n이 브라우저에서 문자 인식으로 앞 '+Math.min(40,n)+'쪽을 읽을까요? (몇 분 걸릴 수 있습니다)');}

/* ---------- 질문에 맞는 쪽 고르기 ---------- */
function words(q){
  var w=String(q).replace(/[^가-힣a-zA-Z0-9\s]/g,' ').split(/\s+/).filter(function(x){return x.length>=2;});
  var stop=/^(이|그|저|어떤|어떻게|무엇|알려|주세요|정리해|찾아|있나요|되나요|경우|약관|에서|보험|이것|것|수|등|및|해|좀|대해|관련)$/;
  var out=[];w.forEach(function(x){x=x.replace(/(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서|까지|부터|만|이나|나|요|인가요|인지|하면|되면|하는|되는|할|된)$/,'');if(x.length>=2&&!stop.test(x))out.push(x);});
  var extra={'진단비':['진단','확정'],'면책':['지급하지','면책','보장개시'],'감액':['감액','50%'],'납입면제':['납입면제','납입을 면제'],'해지':['해지환급금','해지'],'고지':['알릴 의무','고지'],'청구':['청구','서류','소멸시효'],'소액암':['갑상선','기타피부암','제자리암','경계성']};
  Object.keys(extra).forEach(function(k){if(String(q).indexOf(k)>=0)out=out.concat(extra[k]);});
  return out.filter(function(x,i){return out.indexOf(x)===i;});
}
function pick(q,budget){
  var all=[];S.docs.forEach(function(d,di){d.pages.forEach(function(p){all.push({d:di,p:p.p,t:p.t,name:d.name});});});
  var total=all.reduce(function(a,x){return a+x.t.length+20;},0);
  var fmt=function(L){var by={};return L.map(function(x){var h=by[x.d]?'':'\n===== '+x.name+' =====\n';by[x.d]=1;return h+'[p.'+x.p+'] '+x.t;}).join('\n');};
  if(total<=budget)return {text:fmt(all),part:'',used:all.length,all:all.length};
  var W=words(q),sc=all.map(function(x,i){var s=0;W.forEach(function(w){var m=x.t.split(w).length-1;if(m)s+=Math.min(m,6)*(w.length>=3?2:1);});if(/목\s*차|차\s*례/.test(x.t.slice(0,200)))s+=3;return {i:i,s:s};});
  var keep={};all.forEach(function(x,i){if(x.p<=2)keep[i]=1;});
  sc.sort(function(a,b){return b.s-a.s;});
  var used=Object.keys(keep).reduce(function(a,i){return a+all[i].t.length;},0);
  for(var k=0;k<sc.length&&used<budget;k++){if(!sc[k].s)break;[sc[k].i,sc[k].i+1].forEach(function(i){if(i<all.length&&!keep[i]&&all[i].d===all[sc[k].i].d&&used+all[i].t.length<=budget){keep[i]=1;used+=all[i].t.length;}});}
  var L=all.filter(function(x,i){return keep[i];});
  return {text:fmt(L),part:'약관 '+all.length+'쪽 중 관련 '+L.length+'쪽 읽힘',used:L.length,all:all.length};
}

/* ---------- 질문 → AI ---------- */
function prompt(q,part){
  return '너는 한국 보험 약관을 읽고 보험설계사(FC)의 상담을 돕는 약관 분석 도우미다.\n'+
    '규칙:\n1) 아래 [약관] 글에 적힌 내용만 근거로 답한다. 약관에 없는 내용은 "약관에서 찾지 못함"이라고 쓰고 추측하지 않는다.\n'+
    '2) 금액·기간·비율은 약관 문구 그대로 옮긴다. 상품마다 가입금액이 다르면 "가입금액의 OO%"처럼 쓴다.\n'+
    '3) 근거는 조항 이름(예: 제3조(보험금의 지급사유))과 쪽([p.숫자] 표시)을 함께 적고, 핵심 문구를 짧게(80자 이내) 그대로 인용한다.\n'+
    '4) FC가 고객에게 바로 설명할 수 있게 쉬운 말로, 존댓말로 쓴다. 지급을 보장하는 표현("무조건 나옵니다")은 쓰지 않는다.\n'+
    (part?'5) 약관이 길어 질문과 관련된 쪽만 보냈다('+part+'). 빠진 부분이 있을 수 있으면 caution에 적는다.\n':'')+
    '\n답은 설명 없이 JSON 하나로만: {"answer":"질문에 대한 답(3~8문장)","points":["상담 때 짚을 핵심 2~5개"],"refs":[{"where":"조항 이름 (p.쪽)","quote":"약관 원문 인용"}],"caution":"주의할 점이나 확인이 더 필요한 것(없으면 빈 글자)"}\n\n'+
    '[질문]\n'+q+'\n\n[약관]';
}
function now(){var d=new Date(),z=function(n){return (n<10?'0':'')+n;};return (d.getMonth()+1)+'/'+d.getDate()+' '+z(d.getHours())+':'+z(d.getMinutes());}
async function ask(root){
  var qEl=root.querySelector('#polQ'),q=qEl.value.trim(),msg=root.querySelector('#polMsg');
  if(S.busy)return;
  if(!q){qEl.focus();setMsg(root,'질문을 적어 주세요.');return;}
  if(!S.docs.length){setMsg(root,'먼저 2번에서 약관 PDF를 올려 주세요.');var d=root.querySelector('#polDrop');d&&d.scrollIntoView({block:'center',behavior:'smooth'});return;}
  var a=aiState();if(!a.ok){setMsg(root,'먼저 1번에서 AI를 연결해 주세요.');if(window.KIFAI)KIFAI.open();return;}
  var paste=a.paste,budget=paste?28000:(KIFAI.cfg().prov==='openai'?150000:220000);
  var sel=pick(q,budget);S.busy=true;var b=root.querySelector('#polAsk');b.disabled=true;b.textContent='찾는 중…';setMsg(root,'AI가 약관을 읽고 있습니다'+(sel.part?' ('+sel.part+')':'')+'…');
  var item={q:q,at:now(),part:sel.part};
  try{var r=await KIFAI.ask(prompt(q,sel.part),{text:sel.text,images:[],scanned:[]});
    if(!r||typeof r!=='object')throw {code:'bad_json'};if(!r.answer&&r.text)r.answer=r.text;item.r=r;setMsg(root,'');qEl.value='';}
  catch(e){if(e&&e.code==='paste_cancel'){setMsg(root,KIFAI.err(e));item=null;}else{item.err=KIFAI.err(e);setMsg(root,'');}}
  S.busy=false;b.disabled=false;b.textContent='약관에서 찾기';
  if(item){S.qa.unshift(item);var an=root.querySelector('#polAns');an.innerHTML=ansHtml();an.scrollIntoView({block:'start',behavior:'smooth'});}
}
function setMsg(root,t){S.msg=t;var m=root.querySelector('#polMsg');if(m)m.textContent=t;}
function refreshDocs(root){var d=root.querySelector('#polDocs');if(d)d.innerHTML=docsHtml();var h=root.querySelector('#polHint');if(h)h.textContent=S.docs.length?'올린 약관 '+S.docs.length+'개 · '+totalPages()+'쪽을 기준으로 답합니다.':'먼저 2번에서 약관 PDF를 올려 주세요.';
  var st=root.querySelectorAll('.pol-st')[1];if(st)st.classList.toggle('done',S.docs.length>0);}
async function addFiles(root,files){
  files=Array.prototype.filter.call(files||[],function(f){return f.type==='application/pdf'||/\.pdf$/i.test(f.name);});
  if(!files.length){setMsg(root,'PDF 파일만 올릴 수 있습니다.');return;}
  for(var i=0;i<files.length;i++){
    if(S.docs.some(function(d){return d.name===files[i].name;})){setMsg(root,'「'+files[i].name+'」은 이미 올렸습니다.');continue;}
    try{var d=await readPdf(files[i],function(t){setMsg(root,t);});S.docs.push(d);refreshDocs(root);
      setMsg(root,'✓ 「'+d.name+'」 '+d.pages.length+'쪽을 읽었습니다.'+(d.num>MAXP?' (앞 '+MAXP+'쪽까지)':'')+(d.ocr?' (문자 인식 — 글자가 틀릴 수 있습니다)':''));}
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
  root.querySelector('#polQ').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();ask(root);}});
  root.addEventListener('click',function(e){
    var b=e.target.closest('[data-pol]');if(!b||!root.contains(b))return;var k=b.dataset.pol,i=+b.dataset.i;
    if(k==='guide')guide();else if(k==='keyhelp')keyHelp();
    else if(k==='rm'){S.docs.splice(i,1);refreshDocs(root);setMsg(root,'');}
    else if(k==='tab'){S.tab=b.dataset.v;var L=S.tab==='life'?LINKS.life:LINKS.nonlife;
      root.querySelectorAll('[data-pol="tab"]').forEach(function(x){var on=x.dataset.v===S.tab;x.classList.toggle('on',on);x.setAttribute('aria-selected',on);});
      root.querySelector('#polDir .pol-co:not(.wide)').innerHTML=L.map(function(x){return '<a target="_blank" rel="noopener" href="'+esc(x[1])+'">'+esc(x[0])+' ↗</a>';}).join('');}
    else if(k==='plsave')saveLinks(root,b);
    else if(k==='ex'){var q=root.querySelector('#polQ');q.value=EX[i][1];q.focus();}
    else if(k==='ask')ask(root);
    else if(k==='copy'){var ok=copyText(answerText(S.qa[i]));b.textContent=ok?'✓ 복사됨':'복사 실패';setTimeout(function(){b.textContent='답 복사';},1500);}
    else if(k==='del'){S.qa.splice(i,1);root.querySelector('#polAns').innerHTML=ansHtml();}
  });
}
if(window.KIFAI)KIFAI.onChange(function(){var el=document.getElementById('polAi');if(el){el.outerHTML=aiBox();var st=document.querySelector('.pol-st');if(st)st.classList.toggle('done',aiState().ok);}});
window.KIFPOL={html:html,bind:bind,card:card,css:addCss};
})();
