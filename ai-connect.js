/* 한보금on 「내 AI 등록」 — 포털 홈 · AI보장분석 기본형 · 고급형이 함께 쓰는 AI 연결
   설정은 이 기기 브라우저의 localStorage 'fc_ai_cfg' 하나에 저장한다 (기본형과 같은 형식).
   방식: 회사 AI(중계 서버) · 복사·붙여넣기(무료) · Claude 화면 · Claude/ChatGPT/Gemini API 키.
   window.KIFAI = { cfg, chosen, statusHTML, open, ask, read, err, onChange, AIP } */
(function(){
'use strict';
if(window.KIFAI) return;
var BASE=(document.currentScript&&document.currentScript.src)||location.href;
var AIK='fc_ai_cfg';
var AIP={
  company:{name:'회사 AI',key:false,help:'관리자가 켜 둔 회사 AI로 바로 읽습니다. 키가 필요 없습니다.'},
  paste:{name:'복사·붙여넣기',key:false,help:'평소 쓰는 ChatGPT·Gemini·Claude 사이트에 질문을 붙여넣어 읽힙니다. 무료 계정도 됩니다.'},
  claudeapp:{name:'Claude (Claude 화면)',key:false,help:'Claude에 로그인해서 포털을 연 경우 키 없이 씁니다.'},
  claude:{name:'Claude API',key:true,model:'claude-opus-5-5',url:'https://console.anthropic.com/settings/keys',help:'Anthropic 콘솔에서 만든 내 API 키'},
  openai:{name:'ChatGPT (OpenAI)',key:true,model:'gpt-4.1',url:'https://platform.openai.com/api-keys',help:'OpenAI 플랫폼에서 만든 내 API 키'},
  gemini:{name:'Gemini (Google)',key:true,model:'gemini-2.5-flash',url:'https://aistudio.google.com/apikey',help:'Google AI Studio에서 만든 내 API 키'}
};
var PASTE_SITES=[['chatgpt','ChatGPT','https://chatgpt.com/'],['gemini','Gemini','https://gemini.google.com/app'],['claude','Claude','https://claude.ai/new']];
var AI_PROXY='',AI_FOR='all',AI_MODELS={},subs=[];
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fire(){subs.forEach(function(f){try{f();}catch(e){}});}
fetch(new URL('content.json',BASE).href,{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).then(function(c){
  if(c&&/^https:\/\/\S+$/.test(String(c.aiProxy||'').trim()))AI_PROXY=String(c.aiProxy).trim();
  if(c&&c.aiProxyFor==='admin')AI_FOR='admin';
  if(c&&c.aiModels&&typeof c.aiModels==='object')AI_MODELS=c.aiModels;
  fire();
}).catch(function(){});
function claudeHost(){try{if(window.claude&&window.claude.use)return window.claude;}catch(e){}try{if(window.top.claude&&window.top.claude.use)return window.top.claude;}catch(e){}return null;}
function raw(){try{return JSON.parse(localStorage.getItem(AIK)||'null')||{};}catch(e){return {};}}
function saveRaw(c){try{localStorage.setItem(AIK,JSON.stringify(c));}catch(e){}fire();}
/* 포털 로그인 증표(kif_tok): 회사 AI 서버가 로그인·권한을 확인하는 데 쓴다. 화면에서는 권한(role)만 읽는다 */
function login(){try{var t=JSON.parse(localStorage.getItem('kif_tok')||'null');if(!t||!(t.exp>Date.now())||!t.token)return null;var p=JSON.parse(atob(String(t.token).split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));return {token:t.token,role:p.role||'fc'};}catch(e){return null;}}
/* 회사 AI를 이 사람이 쓸 수 있는가 (관리자 전용으로 켠 경우 관리자만) */
function ssoAdmin(){try{var s=JSON.parse(localStorage.getItem('kif_sso')||'null');return !!(s&&s.exp>Date.now()&&s.role==='admin');}catch(e){return false;}}
function companyOk(){if(!AI_PROXY)return false;if(AI_FOR!=='admin')return true;var l=login();return !!(l&&l.role==='admin');}
/* 관리자 전용 회사 AI가 켜져 있으면 관리자는 따로 등록하지 않아도 회사 AI로 바로 읽는다 */
function adminDefault(){var l=login();return AI_FOR==='admin'&&companyOk()&&l&&l.role==='admin';}
function chosen(){var r=raw();return !!(r.prov||r.mode)||adminDefault();}
function cfg(){
  var c=raw(),p=c.prov;
  if(adminDefault()&&(!p||p==='paste'||(p==='claudeapp'&&!claudeHost())||(AIP[p]&&AIP[p].key&&!(c.keys||{})[p])))p='company';
  if(!p||!AIP[p]||(p==='claudeapp'&&!claudeHost())||(p==='company'&&!companyOk()))p=claudeHost()?'claudeapp':(companyOk()?'company':'paste');
  return {mode:c.mode||'ai',prov:p,keys:Object.assign({},c.keys||{}),models:c.models||{},code:c.code||'',site:c.site||'chatgpt'};
}
function model(c,p){return String(c.models[p]||AI_MODELS[p]||AIP[p].model||'').trim();}
/* 예전 고급형에 따로 넣어 둔 Claude 키를 공통 설정으로 옮긴다 */
function migrateClaudeKey(k){k=String(k||'').trim();if(!k)return;var c=raw();c.keys=c.keys||{};if(!c.keys.claude){c.keys.claude=k;saveRaw(c);}}
function statusHTML(){
  var c=cfg(),p=c.prov;
  /* 관리자인데 로그인 증표(kif_tok)가 없거나 만료돼 회사 AI 기본 연결이 빠진 경우: 다시 로그인하면 된다고 알려 준다 */
  if(AI_FOR==='admin'&&AI_PROXY&&!adminDefault()&&ssoAdmin()&&!(raw().prov&&raw().prov!=='paste'&&raw().prov!=='company'))return '관리자 계정은 <b>회사 AI</b>로 바로 읽는데, 로그인 확인이 만료되어 지금은 <b>'+esc(AIP[cfg().prov].name)+'</b>로 대신합니다. <b>로그아웃 후 다시 로그인</b>하면 회사 AI로 돌아옵니다. · <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>';
  if(!chosen())return '아직 내 AI를 정하지 않았습니다. <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>';
  if(c.mode!=='ai')return '「AI 없이 쓰기」로 되어 있습니다. <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>에서 AI를 고르세요.';
  if(AIP[p].key&&!c.keys[p])return esc(AIP[p].name)+' 키가 없습니다. <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>에서 키를 넣어 주세요.';
  /* 등록한 AI를 이 화면에서 쓸 수 없어 복사·붙여넣기로 대신하는 경우, 왜 그런지와 해결법을 함께 보여 준다 */
  var rp=raw().prov;
  if(rp==='claudeapp'&&p!=='claudeapp')return '등록한 AI는 <b>Claude (Claude 화면)</b>인데, 이 방식은 <b>Claude 안에서 포털을 열었을 때만</b> 됩니다. 지금은 일반 브라우저로 열어서 <b>'+esc(AIP[p].name)+'</b>로 대신합니다. 여기서도 바로 읽히려면 <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>에서 <b>Claude API 키</b>를 넣거나, Claude 안의 포털에서 작업하세요.';
  if(rp==='company'&&p!=='company')return '등록한 AI는 <b>회사 AI</b>인데 지금 회사 AI가 꺼져 있어 <b>'+esc(AIP[p].name)+'</b>로 대신합니다. <button type="button" class="kai-link" data-kai-open>내 AI 등록</button>에서 다른 AI를 고를 수 있습니다.';
  if(p==='company'&&adminDefault())return '연결된 AI: <b>회사 AI</b> (관리자 기본 연결 · 등록 필요 없음) · <button type="button" class="kai-link" data-kai-open>바꾸기</button>';
  return '연결된 AI: <b>'+esc(AIP[p].name)+'</b>'+(AIP[p].key?' ('+esc(model(c,p))+')':'')+(p==='paste'?' (AI 사이트에 직접 붙여넣는 방식 · 키를 넣으면 바로 읽습니다)':'')+' · <button type="button" class="kai-link" data-kai-open>바꾸기</button>';
}

/* ---------- 스타일 (어느 화면에 붙어도 같은 모양) ---------- */
var css='.kai-ov{position:fixed;inset:0;background:rgba(10,18,26,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto;font-family:inherit}'+
'.kai-box{background:#fff;color:#1b2430;border-radius:14px;width:100%;max-width:680px;box-sizing:border-box;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.3);font-size:14px;line-height:1.6}'+
'.kai-box h2{font-size:18px;margin:0;color:#0f2240}.kai-box h3{font-size:14px;margin:16px 0 8px;color:#0f2240}'+
'.kai-hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}.kai-hd .kai-x{margin-left:auto}'+
'.kai-note{font-size:12.5px;color:#5b6573;margin:4px 0}.kai-warn{background:#fbf1dd;color:#7a4f0e;border-radius:10px;padding:10px 12px;font-size:12.5px;margin-top:12px}'+
'.kai-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}'+
'.kai-opt{text-align:left;border:1.5px solid #d5dbe3;background:#fff;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;color:inherit}'+
'.kai-opt b{display:block;font-size:13.5px;color:#0f2240}.kai-opt span{display:block;font-size:12px;color:#5b6573;margin-top:2px}'+
'.kai-opt.on{border-color:#cb9c3a;background:#fdf7ea;box-shadow:0 0 0 2px rgba(203,156,58,.25)}'+
'.kai-f{display:block;font-size:12.5px;font-weight:600;color:#333;margin-top:10px}.kai-f input,.kai-box textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #c9d1db;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;background:#fff;color:#1b2430}'+
'.kai-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}'+
'.kai-btn{appearance:none;border:1px solid #c9d1db;background:#fff;color:#0f2240;border-radius:8px;padding:8px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}'+
'.kai-btn.p{background:#0f2240;border-color:#0f2240;color:#fff}.kai-btn.g{border-color:transparent;background:transparent}.kai-btn.d{color:#b3261e}.kai-btn[disabled]{opacity:.5;cursor:default}'+
'.kai-link{appearance:none;border:0;background:none;padding:0;font:inherit;color:#b07d1c;font-weight:700;text-decoration:underline;cursor:pointer}'+
'.kai-steps{padding-left:20px;margin:6px 0 0}.kai-steps li{margin-bottom:14px}'+
'.kai-wrap{width:100%;max-width:880px;display:flex;flex-direction:column;gap:12px}.kai-wrap .kai-box{max-width:none}'+
'.kai-ttl{font-size:13px;color:#5b6573;font-weight:700}.kai-pill{font-size:12px;font-weight:700;background:#0f2240;color:#fff;border-radius:6px;padding:3px 10px}.kai-pill.off{background:#eef1f5;color:#5b6573}'+
'.kai-grid{display:grid;grid-template-columns:170px 1fr;gap:22px}.kai-main{min-width:0;border-left:1px solid #e3e7ec;padding-left:22px}.kai-main h2{margin-bottom:6px}'+
'.kai-nav{list-style:none;margin:6px 0 0;padding:0}.kai-nav li{display:flex;align-items:center;gap:10px;padding:8px 0;color:#9aa3ae;font-size:13.5px}.kai-nav li i{font-style:normal;font-weight:700;width:18px}'+
'.kai-nav li.on{color:#0f2240;font-weight:700}.kai-nav li.on i{color:#b07d1c}.kai-nav li.done{color:#1d7f47}.kai-nav li.dim{opacity:.45}'+
'.kai-ol{margin:8px 0 14px;padding-left:20px}.kai-ol li{margin:6px 0}.kai-ol a,.kai-note a{color:#b07d1c}'+
'.kai-btn.gold{display:inline-block;background:#cb9c3a;border-color:#cb9c3a;color:#1b1206;text-decoration:none;padding:11px 18px}'+
'.kai-big{background:#fdf3dc;border:2px solid #cb9c3a;color:#3d2d0c;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.7;margin:4px 0 12px}.kai-big b{color:#0f2240}'+
'.kai-cmsg{font-size:14px;font-weight:700;color:#0f7a48;margin:8px 0 0}'+
'.kai-tip{background:#fbf3e3;color:#5a4416;border-radius:10px;padding:12px 14px;font-size:13px;margin-top:14px}'+
'.kai-opt em{display:block;font-style:normal;font-size:12px;font-weight:700;color:#b07d1c;margin-top:6px}'+
'.kai-krow{display:flex;gap:6px;margin-top:4px}.kai-krow input{margin-top:0!important;flex:1;font-family:ui-monospace,monospace}'+
'.kai-done{background:#e6f4ec;border-radius:10px;padding:14px 16px;margin:8px 0}.kai-done b{display:block;color:#1d7f47;font-size:16px}.kai-done span{font-size:13px}.kai-done span b{display:inline;font-size:inherit;color:inherit}'+
'.kai-fd{border:1px solid #e3e7ec;border-radius:10px;padding:12px 14px;margin:10px 0;background:#f8fafc}.kai-fdl{font-size:14px}.kai-fdl span{color:#9aa3ae}.kai-fd .kai-row{margin-top:8px}'+
'.kai-ul{padding-left:20px;font-size:13px}.kai-faq h3{margin-top:0;font-size:16px}.kai-faq p{font-size:13px;margin:10px 0}'+
'@media (max-width:640px){.kai-grid{grid-template-columns:1fr;gap:8px}.kai-main{border-left:0;padding-left:0}.kai-nav{display:flex;gap:4px;overflow-x:auto}.kai-nav li{flex:none;padding:4px 8px;border-radius:6px;background:#f2f4f7;font-size:12px}.kai-nav li.on{background:#fdf7ea}}'+
'@media (max-width:560px){.kai-box{padding:16px}.kai-opts{grid-template-columns:1fr}}';
function addCss(){if(document.getElementById('kai-css'))return;var s=document.createElement('style');s.id='kai-css';s.textContent=css;(document.head||document.documentElement).appendChild(s);}

/* ---------- 내 AI 등록 창 ----------
   1 AI 고르기 → (API 키 방식이면) 2 키 발급받기 → 3 붙여넣고 확인 → 4 완료.  키 없이 쓰는 방식은 1단계에서 바로 저장 */
var GUIDE={
  claude:{site:'Anthropic 콘솔',url:'https://console.anthropic.com/settings/keys',bill:'https://console.anthropic.com/settings/billing',pre:/^sk-ant-/,preTxt:'sk-ant-',
    steps:['아래 <b>[발급 페이지 열기]</b>를 누르고 Anthropic 계정으로 로그인합니다. 계정이 없으면 이메일로 가입합니다(Claude 앱 계정과 같은 이메일을 써도 됩니다).',
      '처음이면 <b>결제 정보</b>를 등록하고 크레딧을 충전합니다. (<a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener">결제 페이지 열기</a>)',
      '<b>Create Key</b>(키 만들기)를 누르고 이름을 적습니다. 예: 한보금 보장분석',
      '만들어진 키(<b>sk-ant-</b>로 시작) 옆의 <b>복사</b> 버튼을 누릅니다.'],
    tip:'Claude API는 미리 충전한 크레딧에서 쓴 만큼 빠집니다. Claude Pro 구독과는 결제가 따로입니다. 콘솔에서 월 사용 한도를 정해 두면 안심입니다.'},
  openai:{site:'OpenAI 플랫폼',url:'https://platform.openai.com/api-keys',bill:'https://platform.openai.com/settings/organization/billing/overview',pre:/^sk-/,preTxt:'sk-',
    steps:['아래 <b>[발급 페이지 열기]</b>를 누르고 로그인합니다. ChatGPT에서 쓰는 계정으로 그대로 로그인할 수 있습니다.',
      '처음이면 <b>결제 수단</b>을 등록하고 크레딧을 충전합니다. (<a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener">결제 페이지 열기</a>)',
      '<b>Create new secret key</b>(새 키 만들기)를 누르고 이름을 적은 뒤 <b>Create secret key</b>를 누릅니다.',
      '만들어진 키(<b>sk-</b>로 시작) 옆의 <b>복사</b> 버튼을 누릅니다. 이 창을 닫으면 키를 다시 볼 수 없습니다.'],
    tip:'ChatGPT Plus 구독과 API 결제는 따로입니다. 구독만으로는 키를 쓸 수 없고, 충전한 크레딧에서 쓴 만큼 빠집니다.'},
  gemini:{site:'Google AI Studio',url:'https://aistudio.google.com/apikey',bill:'',pre:/^AIza/,preTxt:'AIza',
    steps:['아래 <b>[발급 페이지 열기]</b>를 누르고 구글 계정으로 로그인합니다.',
      '처음이면 이용약관에 동의합니다.',
      '<b>Create API key</b>(API 키 만들기)를 누릅니다.',
      '만들어진 키(<b>AIza</b>로 시작) 옆의 <b>복사</b> 버튼을 누릅니다.'],
    tip:'무료 사용량이 있지만 하루 사용 횟수 제한이 있습니다. 실제 업무에서는 결제 계정을 연결해 두는 것이 안정적입니다.'}
};
var FAQ=[
  ['ChatGPT Plus나 Claude Pro를 쓰고 있는데 왜 또 결제가 필요한가요?','월 구독(채팅용)과 API(프로그램 연결용)는 결제가 따로입니다. 구독만으로는 키가 나오지 않습니다. API는 쓴 만큼만 나갑니다. 결제 없이 쓰려면 1단계에서 <b>복사·붙여넣기</b>를 고르세요.'],
  ['키를 잃어버렸어요.','키는 발급할 때 한 번만 보입니다. 발급 페이지에서 새 키를 만들어 3단계부터 다시 하면 됩니다. 예전 키는 발급 페이지에서 지워 두세요.'],
  ['PC를 바꿨어요.','키는 PC(브라우저)마다 따로 저장됩니다. 새 PC에서 같은 키를 다시 붙여넣으면 됩니다.'],
  ['키를 다른 사람에게 알려 줘도 되나요?','안 됩니다. 키를 아는 사람은 내 결제로 AI를 쓸 수 있습니다. 공용 PC에서는 등록하지 말고, 새어 나간 것 같으면 발급 페이지에서 그 키를 지우세요.'],
  ['요금이 걱정돼요.','자료 양만큼 나갑니다. 발급 페이지에서 월 사용 한도를 정해 두면 그 이상은 나가지 않습니다.']
];
var sel='',ov=null,step=1,draft='';
function open(){addCss();var c=cfg();sel=c.prov;step=1;draft='';if(!ov){ov=document.createElement('div');ov.className='kai-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','내 AI 등록');ov.addEventListener('click',onClick);ov.addEventListener('input',onInput);document.body.appendChild(ov);}ov.hidden=false;render();}
function close(){if(ov){ov.remove();ov=null;}}
function connectedPill(){var c=cfg(),p=c.prov;if(!chosen()||c.mode!=='ai'||(AIP[p].key&&!c.keys[p]))return '<span class="kai-pill off">아직 연결 안 됨</span>';return '<span class="kai-pill">● '+esc(AIP[p].name.replace(/ \(.*\)$/,''))+' 연결됨</span>';}
function stepNav(){var L=['AI 고르기','키 발급받기','붙여넣고 확인','저장 폴더 · 완료'],api=AIP[sel]&&AIP[sel].key;
  return '<ol class="kai-nav">'+L.map(function(t,i){var n=i+1,cls=n===step?'on':n<step?'done':'';if(!api&&n>1&&n<4)cls+=' dim';return '<li class="'+cls+'"><i>'+(n<step?'✓':n)+'</i>'+t+'</li>';}).join('')+'</ol>';}
function render(){
  var c=cfg(),p=sel||c.prov,host=!!claudeHost(),h='';
  if(step===1){
    var card=function(k){return '<button type="button" class="kai-opt'+(k===p?' on':'')+'" data-kai-p="'+k+'"><b>'+(k===p?'✓ ':'')+AIP[k].name+'</b><span>'+AIP[k].help+'</span>'+(AIP[k].key?'<em>'+(c.keys[k]?'키 등록됨 · 바꾸기':'키 발급 안내 따라 하기 ›')+'</em>':'')+'</button>';};
    var easy=['company','paste','claudeapp'].filter(function(k){return (k!=='company'||companyOk())&&(k!=='claudeapp'||host);});
    h='<h2>1. 쓸 AI 고르기</h2><p class="kai-note">한 번 등록하면 <b>AI보장분석 기본형</b>과 <b>고급형</b>이 같은 AI를 씁니다. 기본형은 등록된 기준·샘플대로 분석하고, 고급형은 고급형 계산 규칙대로 제안서를 만듭니다.</p>'+
      '<h3>키 없이 쓰기 <span class="kai-note">추천 · 바로 시작</span></h3><div class="kai-opts">'+easy.map(card).join('')+'</div>'+
      '<h3>내 API 키로 쓰기 <span class="kai-note">더 빠르고 자동 · 발급 안내가 이어집니다</span></h3><div class="kai-opts">'+['claude','openai','gemini'].map(card).join('')+'</div>';
    if(p==='company')h+='<label class="kai-f">회사 접속코드 <span class="kai-note">관리자가 알려준 경우만</span><input type="password" id="kaiCode" autocomplete="off" value="'+esc(c.code||'')+'"></label>';
    else if(p==='paste')h+='<div class="kai-tip"><b>쓰는 법</b> 자료를 올리면 「AI에게 읽히기」 창이 뜹니다. <b>ChatGPT로 보내기</b> → 열린 창에 붙여넣고 보내기 → AI 답의 <b>복사</b> 아이콘 → 포털로 돌아오면 자동으로 들어갑니다. 무료 계정도 됩니다.</div>';
    h+='<div class="kai-warn">고객 증권·병력·재무 자료가 고른 AI 회사로 보내집니다. 개인정보 동의를 받은 고객 자료만 AI로 읽히세요.</div>';
    if(AIP[p].key)h+='<div class="kai-row"><button type="button" class="kai-btn p" data-kai="next">다음: 키 발급받기 ›</button>'+(c.keys[p]?'<button type="button" class="kai-btn" data-kai="have">이미 받은 키가 있어요</button>':'<button type="button" class="kai-btn" data-kai="have">키가 이미 있어요</button>')+'</div>';
    else h+='<div class="kai-row"><button type="button" class="kai-btn p" data-kai="save">이 방식으로 저장</button>'+(p==='company'?'<button type="button" class="kai-btn" data-kai="test">연결 시험</button>':'')+(raw().mode==='manual'?'':'<button type="button" class="kai-btn g" data-kai="off">AI 없이 쓰기</button>')+'<span class="kai-note" id="kaiMsg" role="status"></span></div>';
  }else if(step===2){
    var G=GUIDE[p];
    h='<h2>2. '+esc(AIP[p].name.replace(/ \(.*\)$/,''))+' 키 발급받기</h2><p class="kai-note">'+G.site+'에서 내 키를 만듭니다. 처음 한 번만 하면 됩니다.</p><ol class="kai-ol">'+G.steps.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol>'+
      '<a class="kai-btn gold" href="'+G.url+'" target="_blank" rel="noopener" data-kai="opened">발급 페이지 열기 (새 창) ↗</a>'+
      '<div class="kai-tip">'+G.tip+'</div>'+
      '<div class="kai-row"><button type="button" class="kai-btn" data-kai="prev">이전</button><button type="button" class="kai-btn p" data-kai="copied">키를 복사했어요 ›</button></div>';
  }else if(step===3){
    var G3=GUIDE[p],k=draft||c.keys[p]||'';
    h='<h2>3. 키 붙여넣고 확인</h2><p class="kai-note">복사한 키를 아래 칸에 붙여넣으세요(Ctrl+V, 휴대폰은 길게 눌러 붙여넣기). <b>확인</b>을 누르면 연결이 되는지 시험한 뒤 저장합니다.</p>'+
      '<label class="kai-f">'+esc(AIP[p].name)+' API 키<div class="kai-krow"><input type="password" id="kaiKey" autocomplete="off" spellcheck="false" value="'+esc(k)+'" placeholder="'+G3.preTxt+'… 로 시작하는 키"><button type="button" class="kai-btn" data-kai="clip">붙여넣기</button><button type="button" class="kai-btn g" data-kai="eye" aria-label="키 보기">👁</button></div></label>'+
      '<p class="kai-note" id="kaiFmt"></p>'+
      '<details class="kai-adv"><summary class="kai-note">고급: 모델 바꾸기 (보통은 그대로 두세요)</summary><label class="kai-f">모델 <span class="kai-note">비워 두면 기본값</span><input type="text" id="kaiModel" value="'+esc(c.models[p]||'')+'" placeholder="'+esc(AI_MODELS[p]||AIP[p].model)+'"></label></details>'+
      '<p class="kai-note">키는 이 기기 브라우저에만 저장되고, AI를 부를 때 '+G3.site.replace(/ .*/,'')+' 쪽으로만 보내집니다.</p>'+
      '<div class="kai-row"><button type="button" class="kai-btn" data-kai="prev">이전</button><button type="button" class="kai-btn p" data-kai="check">확인</button><span class="kai-note" id="kaiMsg" role="status"></span></div>'+
      (c.keys[p]?'<div class="kai-row"><button type="button" class="kai-btn g d" data-kai="del">이 기기에서 키 지우기</button></div>':'');
  }else{
    var man=c.mode!=='ai';
    h='<h2>4. 고객 자료 저장 폴더 정하기</h2>'+(man?'<div class="kai-done"><b>✓ AI 없이 쓰기로 저장했습니다</b><span>값은 직접 입력합니다. 나중에 왼쪽 메뉴 아래 「AI 연결」에서 언제든 AI를 연결할 수 있습니다.</span></div>':
      '<div class="kai-done"><b>✓ '+esc(AIP[p].name)+' 연결됨</b><span>이제 AI보장분석 <b>기본형</b>과 <b>고급형</b>에서 자료를 올리면 이 AI가 읽습니다.</span></div>')+
      '<p class="kai-note">상담한 고객 자료는 회사 서버에 올라가지 않고 <b>이 기기</b>에만 있습니다. 내 PC나 내 클라우드(OneDrive·Google Drive) 안에 <b>보관 폴더</b>를 한 번 정해 두면, 「내 정보 · 자료 보관」에서 저장할 때마다 그 폴더에 날짜별 파일로 바로 저장됩니다.</p>'+fdBox()+
      (man?'':'<ul class="kai-ul"><li>기본형: 증권·가입설계서를 올리면 등록된 기준·샘플대로 분석합니다.</li><li>고급형: 「증권·설계서 AI 판독」, 「자료로 채우기 (AI)」, 「AI 의견 초안 받기」에서 씁니다.</li><li>바꾸고 싶으면 왼쪽 메뉴 아래 「AI 연결」(폰은 「내 정보」)에서 언제든 다시 엽니다.</li></ul>')+
      '<div class="kai-row"><button type="button" class="kai-btn p" data-kai="x">닫기</button></div>';
  }
  var faq=(step===2||step===3)?'<div class="kai-box kai-faq"><h3>자주 묻는 것</h3>'+FAQ.map(function(f){return '<p><b>'+f[0]+'</b><br>'+f[1]+'</p>';}).join('')+'</div>':'';
  ov.innerHTML='<div class="kai-wrap"><div class="kai-box"><div class="kai-hd"><b class="kai-ttl">내 AI 등록</b>'+connectedPill()+'<button type="button" class="kai-btn g kai-x" data-kai="x" aria-label="닫기">✕</button></div>'+
    '<div class="kai-grid">'+stepNav()+'<div class="kai-main">'+h+'</div></div></div>'+faq+'</div>';
  if(step===3)fmtCheck();
}
function fmtCheck(){var i=document.getElementById('kaiKey'),m=document.getElementById('kaiFmt');if(!i||!m)return;var v=i.value.trim(),G=GUIDE[sel];draft=i.value;
  m.textContent=!v?'':G.pre.test(v)?'✓ 키 모양이 맞습니다.':'⚠ '+AIP[sel].name+' 키는 보통 "'+G.preTxt+'"로 시작합니다. 다른 회사 키를 넣지 않았는지 확인하세요.';m.style.color=!v?'':G.pre.test(v)?'#1d7f47':'#a86a12';}
function onInput(e){if(e.target&&e.target.id==='kaiKey')fmtCheck();}
function saveKey(p,key,mdl){var c=raw();c.keys=c.keys||{};c.models=c.models||{};c.keys[p]=key;if(mdl!=null)c.models[p]=mdl;c.prov=p;c.mode='ai';saveRaw(c);}
function onClick(e){
  if(e.target===ov||e.target.classList&&e.target.classList.contains('kai-wrap')){close();return;}
  var o=e.target.closest('[data-kai-p]');if(o){sel=o.dataset.kaiP;draft='';render();return;}
  var b=e.target.closest('[data-kai]');if(!b)return;var a=b.dataset.kai;
  if(a==='opened')return;   /* 링크는 새 창으로 열린다 */
  if(a==='x'){close();return;}
  if(a==='next'){step=2;render();return;}
  if(a==='have'||a==='copied'){step=3;render();var ki=document.getElementById('kaiKey');if(ki&&!ki.value)ki.focus();return;}
  if(a==='prev'){step=step===3&&!GUIDE[sel]?1:step-1;render();return;}
  if(a==='eye'){var kk=document.getElementById('kaiKey');kk.type=kk.type==='password'?'text':'password';return;}
  if(a==='clip'){var km=document.getElementById('kaiMsg');if(!(navigator.clipboard&&navigator.clipboard.readText)){km.textContent='이 브라우저는 자동 붙여넣기를 막습니다. 칸을 누르고 Ctrl+V 하세요.';return;}
    navigator.clipboard.readText().then(function(t){var ki=document.getElementById('kaiKey');ki.value=String(t||'').trim();fmtCheck();km.textContent='';},function(){km.textContent='붙여넣기 허용이 필요합니다. 칸을 누르고 Ctrl+V 하세요.';});return;}
  if(a==='check'){
    var p=sel,key=document.getElementById('kaiKey').value.trim(),me=document.getElementById('kaiModel'),mdl=me?me.value.trim():null,m=document.getElementById('kaiMsg');
    if(!key){m.textContent='키를 먼저 붙여넣으세요.';return;}
    if(/[^\x21-\x7e]/.test(key)){m.textContent='✕ 키에 한글·빈칸 같은 다른 글자가 섞였습니다. 발급 페이지에서 복사 버튼으로 다시 복사하세요.';return;}
    m.textContent='연결 시험 중…';b.disabled=true;
    var c0=cfg();c0.models[p]=mdl||'';
    apiCall(p,key,model(c0,p),'연결 시험이다. JSON 하나로만 답하라: {"ok":true}',[]).then(pickJson).then(function(){saveKey(p,key,mdl);step=4;render();note('내 AI를 저장했습니다 ('+AIP[p].name+')');},
      function(er){m.innerHTML='✕ '+esc(er&&er.code==='bad_key'?'키가 맞지 않거나 아직 사용할 수 없는 키입니다. 발급 페이지에서 복사 버튼으로 다시 복사해 붙여넣으세요(결제 등록이 필요한 회사는 결제부터 확인).':err(er))+' <button type="button" class="kai-link" data-kai="force">시험 없이 저장</button>';b.disabled=false;});
    return;}
  if(a==='force'){var kf=document.getElementById('kaiKey').value.trim(),mf=document.getElementById('kaiModel');if(!kf)return;saveKey(sel,kf,mf?mf.value.trim():null);step=4;render();return;}
  if(a==='save'){var cd=document.getElementById('kaiCode'),c=raw();if(cd)c.code=cd.value.trim();c.prov=sel;c.mode='ai';saveRaw(c);step=4;render();note('내 AI를 저장했습니다 ('+AIP[sel].name+')');return;}
  if(a==='off'){var r0=raw();r0.mode='manual';saveRaw(r0);step=4;render();note('AI 없이 쓰기로 바꿨습니다');return;}
  if(a==='fd'){var fm=document.getElementById('kaiFdMsg');b.disabled=true;
    fdPick().then(function(l){render();note('저장 폴더를 정했습니다: '+l);},function(er){b.disabled=false;if(fm)fm.textContent=er&&er.name==='AbortError'?'폴더 고르기를 취소했습니다.':'✕ '+fdErr(er);});return;}
  if(a==='del'){var r=raw();if(r.keys)delete r.keys[sel];saveRaw(r);draft='';render();return;}
  if(a==='test'){var cd2=document.getElementById('kaiCode'),c2=raw();if(cd2)c2.code=cd2.value.trim();c2.prov=sel;c2.mode='ai';saveRaw(c2);var m2=document.getElementById('kaiMsg');m2.textContent='시험 중…';b.disabled=true;
    ask('연결 시험이다. JSON 하나로만 답하라: {"ok":true}').then(function(r){m2.textContent=r&&r.ok?'✓ 연결됐습니다.':'답은 왔지만 형식이 다릅니다.';},function(er){m2.textContent='✕ '+err(er);}).then(function(){b.disabled=false;});}
}
function note(t){addCss();var d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0f2240;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:10000;box-shadow:0 8px 20px rgba(0,0,0,.25)';document.body.appendChild(d);setTimeout(function(){d.remove();},2600);}
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-kai-open]')){e.preventDefault();open();}});

/* ---------- 파일 → 글자/사진 ---------- */
var LIBS={},PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',XLSXJS='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
function loadLib(src,g){if(window[g])return Promise.resolve();return LIBS[src]||(LIBS[src]=new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){delete LIBS[src];rej({code:'lib'});};document.head.appendChild(s);}));}
function hangul(t){var h=(t.match(/[가-힣]/g)||[]).length,c=(t.match(/[一-鿿]/g)||[]).length;return h/Math.max(1,h+c);}
function canvasBlob(cv){return new Promise(function(r){cv.toBlob(r,'image/jpeg',0.82);});}
async function shrink(f){
  try{var bmp=await createImageBitmap(f),m=Math.max(bmp.width,bmp.height),s=m>1800?1800/m:1;
    if(s===1&&f.size<3.5e6&&/jpe?g|png|webp/.test(f.type))return f;
    var cv=document.createElement('canvas');cv.width=Math.round(bmp.width*s);cv.height=Math.round(bmp.height*s);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);return await canvasBlob(cv);}catch(e){return f;}
}
var CMAPS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
/* 워드(.docx)·한글(.hwpx)·파워포인트(.pptx)·엑셀은 모두 zip 묶음이다. 확장자가 없거나 틀려도 안을 보고 글자를 꺼낸다 */
async function officeText(buf){
  await loadLib(XLSXJS,'XLSX');var u8=new Uint8Array(buf);if(!(u8[0]===0x50&&u8[1]===0x4B))return null;
  var z;try{z=XLSX.CFB.read(u8,{type:'array'});}catch(e){return null;}var P=z.FullPaths;
  var get=function(re){var L=[];P.forEach(function(p,i){var m=p.match(re);if(m)L.push([+(m[1]||0),z.FileIndex[i]]);});L.sort(function(a,b){return a[0]-b[0];});return L.map(function(x){return new TextDecoder().decode(x[1].content);});};
  var para=function(x,end,tRe){return x.split(end).map(function(q){return (q.match(tRe)||[]).map(function(t){return t.replace(/<[^>]+>/g,'');}).join('');}).filter(function(q){return q.trim();}).join('\n');};
  var un=function(t){return t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');};
  var d=get(/word\/document\.xml$/);if(d.length)return {type:'DOCX',text:un(para(d[0],/<\/w:p>/,/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g))};
  var h=get(/Contents\/section(\d+)\.xml$/i);if(h.length)return {type:'HWPX',text:un(h.map(function(x){return para(x,/<\/hp:p>/,/<hp:t(?:\s[^>]*)?>[\s\S]*?<\/hp:t>/g);}).join('\n'))};
  var sl=get(/ppt\/slides\/slide(\d+)\.xml$/);if(sl.length)return {type:'PPT',text:un(sl.map(function(x,i){return '[장 '+(i+1)+'] '+para(x,/<\/a:p>/,/<a:t>[^<]*<\/a:t>/g).replace(/\n/g,' / ');}).join('\n'))};
  if(P.some(function(p){return /xl\/workbook\.xml$/.test(p);})){var wb=XLSX.read(u8,{type:'array'});return {type:'XLSX',text:wb.SheetNames.map(function(n){return '[시트] '+n+'\n'+XLSX.utils.sheet_to_csv(wb.Sheets[n]);}).join('\n')};}
  return null;
}
/* 글자 정보 없이 모양만 저장된 PDF: AI 없이 이 브라우저에서 문자 인식(OCR)으로 글자를 읽는다 (한국어+영어, 처음 한 번 인식 데이터 내려받기) */
var TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
async function ocrPdf(buf,maxPages,prog){
  await loadLib(PDFJS,'pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  try{await loadLib(TESS,'Tesseract');}catch(e){throw {code:'ocr_lib',message:'문자 인식 도구를 불러오지 못했습니다(인터넷 연결 확인).'};}
  var doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise,n=Math.min(doc.numPages,maxPages||12),out=[];
  prog&&prog('문자 인식 준비 중… (처음 한 번은 인식 데이터를 내려받아 조금 걸립니다)');
  var w=await Tesseract.createWorker('kor+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'});
  try{
    for(var i=1;i<=n;i++){prog&&prog('문자 인식 중… '+i+'/'+n+'쪽');
      var pg=await doc.getPage(i),v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:Math.min(3,2000/v0.width)}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
      var g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:g,viewport:vp}).promise;
      var r=await w.recognize(cv),t=String(r.data.text||'');
      /* 한글 글자 사이에 끼는 띄어쓰기 정리 (OCR이 음절마다 띄우는 경우) */
      t=t.split('\n').map(function(l){var parts=l.trim().split(/\s+/),one=parts.filter(function(x){return /^[가-힣]$/.test(x);}).length;return parts.length>3&&one/parts.length>0.6?l.replace(/([가-힣])\s(?=[가-힣])/g,'$1'):l.trim();}).filter(Boolean).join('\n');
      out.push('[p.'+i+'] '+t);}
  }finally{try{await w.terminate();}catch(e){}}
  return {pages:out,numPages:doc.numPages};
}
async function read(files){
  var out={text:'',images:[],scanned:[]};
  for(var i=0;i<files.length;i++){
    var f=files[i],nm=f.name||'파일',low=nm.toLowerCase();
    if(/^image\//.test(f.type)){out.images.push(await shrink(f));out.scanned.push(nm);continue;}
    if(f.type==='application/pdf'||/\.pdf$/.test(low)){
      await loadLib(PDFJS,'pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var doc;try{doc=await pdfjsLib.getDocument({data:await f.arrayBuffer(),cMapUrl:CMAPS,cMapPacked:true}).promise;}catch(e){throw {code:'pdf',message:nm+' 파일을 열지 못했습니다'+(/password/i.test(e&&e.name||'')?' (비밀번호가 걸린 파일)':'')+'.'};}
      var all='',pages=[];
      for(var p=1;p<=Math.min(doc.numPages,30);p++){var tc=await (await doc.getPage(p)).getTextContent();var t=tc.items.map(function(x){return x.str;}).join(' ').replace(/\s+/g,' ');pages.push('[p'+p+'] '+t);all+=t;}
      if(all.replace(/\s/g,'').length>Math.min(300,60*doc.numPages)&&hangul(all)>0.6){out.text+='\n\n===== '+nm+' =====\n'+pages.join('\n');continue;}
      for(var q=1;q<=Math.min(doc.numPages,6);q++){var pg=await doc.getPage(q),vp=pg.getViewport({scale:1.5}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;out.images.push(await canvasBlob(cv));}
      out.scanned.push(nm);continue;
    }
    if(/\.(xlsx|xls|csv)$/.test(low)){
      await loadLib(XLSXJS,'XLSX');var wb=XLSX.read(await f.arrayBuffer(),{type:'array'});
      out.text+='\n\n===== '+nm+' =====\n'+wb.SheetNames.map(function(s){return '[시트 '+s+']\n'+XLSX.utils.sheet_to_csv(wb.Sheets[s]);}).join('\n');continue;
    }
    if(/\.hwp$/.test(low))throw {code:'hwp',message:nm+' — 한글(.hwp) 파일은 바로 읽지 못합니다. 한글에서 PDF나 .hwpx로 저장해 올려 주세요.'};
    var ab=await f.arrayBuffer(),of=await officeText(ab);
    out.text+='\n\n===== '+nm+' =====\n'+(of?of.text:new TextDecoder().decode(ab));
  }
  out.text=out.text.slice(0,80000);out.images=out.images.slice(0,8);
  return out;
}
function b64(b){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){var u=String(r.result);res({mime:b.type||'image/jpeg',data:u.slice(u.indexOf(',')+1)});};r.onerror=rej;r.readAsDataURL(b);});}
function pickJson(t){t=String(t||'').replace(/```(json)?/g,'');var i=t.indexOf('{'),j=t.lastIndexOf('}');if(i<0||j<i)throw {code:'bad_json'};try{return JSON.parse(t.slice(i,j+1));}catch(e){throw {code:'bad_json'};}}

/* ---------- AI 부르기 ---------- */
async function apiCall(p,key,mdl,prompt,imgs){
  var r;
  try{
    if(p==='claude'){
      var body={model:mdl,max_tokens:16000,messages:[{role:'user',content:imgs.map(function(i){return {type:'image',source:{type:'base64',media_type:i.mime,data:i.data}};}).concat([{type:'text',text:prompt}])}]};
      var hd={'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
      if(/^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(mdl)){hd['anthropic-beta']='server-side-fallback-2026-07-01';body.fallbacks='default';}
      r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:hd,body:JSON.stringify(body)});
    }else if(p==='openai'){
      r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model:mdl,response_format:{type:'json_object'},messages:[{role:'user',content:[{type:'text',text:prompt}].concat(imgs.map(function(i){return {type:'image_url',image_url:{url:'data:'+i.mime+';base64,'+i.data}};}))}]})});
    }else{
      r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(mdl)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}].concat(imgs.map(function(i){return {inline_data:{mime_type:i.mime,data:i.data}};}))}],generationConfig:{responseMimeType:'application/json'}})});
    }
  }catch(e){throw {code:'network'};}
  if(r.status===401||r.status===403)throw {code:'bad_key'};
  if(r.status===429)throw {code:'rate_limited'};
  if(r.status===404)throw {code:'bad_model'};
  if(!r.ok){var et='';try{et=(await r.json()).error;et=et&&(et.message||et);}catch(e){}throw {code:'api_error',message:String(et||r.status)};}
  var j=await r.json();
  if(p==='claude'){if(j.stop_reason==='refusal')throw {code:'refused'};return (j.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');}
  if(p==='openai')return (j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'';
  var cd=j.candidates&&j.candidates[0];return (cd&&cd.content&&(cd.content.parts||[]).map(function(x){return x.text||'';}).join(''))||'';
}
async function relayCall(c,prompt,imgs){
  var r,j={};
  try{r=await fetch(AI_PROXY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:prompt,images:imgs,code:c.code||'',token:(login()||{}).token||''})});}catch(e){throw {code:'relay_down'};}
  try{j=await r.json();}catch(e){}
  if(r.status===401&&j.error==='login')throw {code:'need_login'};
  if(r.status===403&&j.error==='role')throw {code:'admin_only'};
  if(r.status===401)throw {code:'need_code'};
  if(r.status===429)throw {code:'rate_limited'};
  if(!r.ok||j.error)throw {code:'api_error',message:String(j.error||r.status)};
  return j.text||'';
}
var PASTE_HEAD='[한국보험금융 FC 포털 요청] 아래 지시를 그대로 따르고, 설명 없이 JSON 하나만 답하세요.\n\n';
function pasteAsk(q,scanned){
  addCss();
  return new Promise(function(res,rej){
    var c=cfg(),w=document.createElement('div');
    w.className='kai-ov';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-label','AI에게 읽히기');
    w.innerHTML='<div class="kai-box"><div class="kai-hd"><h2>AI에게 읽히기</h2><button type="button" class="kai-btn g kai-x" data-q="cancel" aria-label="닫기">✕</button></div>'+
      '<div class="kai-big"><b>질문은 포털이 이미 만들어 두었습니다. 새로 쓰지 마세요.</b><br>① 아래 버튼을 누르면 질문이 복사되고 AI 창이 열립니다 → ② 열린 창의 입력칸을 한 번 누르고 <b>Ctrl+V</b>(붙여넣기, 휴대폰은 길게 눌러 「붙여넣기」) → ③ <b>보내기</b>(Enter) → ④ 답이 나오면 답 아래 <b>복사</b> 아이콘을 누르고 이 창으로 돌아오기</div>'+
      '<ol class="kai-steps">'+
      '<li><b>AI를 골라 질문 보내기</b><p class="kai-note">입력칸이 비어 있는 게 정상입니다. 거기에 붙여넣기만 하면 됩니다.'+
      (scanned.length?' 사진·스캔 자료는 <b>'+esc(scanned.join(', '))+'</b> 파일도 그 창에 함께 첨부해 주세요.':'')+'</p><div class="kai-row">'+
      PASTE_SITES.map(function(x){return '<button type="button" class="kai-btn'+(x[0]===c.site?' p':'')+'" data-q="go" data-v="'+x[0]+'">'+x[1]+'로 보내기 ↗</button>';}).join('')+
      '</div><p class="kai-cmsg" data-q="cmsg" role="status"></p><div class="kai-row" style="margin-top:6px"><button type="button" class="kai-btn g" data-q="dl">질문을 파일(.txt)로 받기</button><span class="kai-note">붙여넣기가 안 되거나 너무 길면, 이 파일을 AI 창에 첨부해 보내세요.</span></div><details data-q="det"><summary class="kai-note">질문 내용 보기</summary><textarea rows="4" readonly data-q="qtext"></textarea></details></li>'+
      '<li><b>AI 답을 복사한 뒤 가져오기</b><p class="kai-note">AI 답 아래의 <b>복사</b> 아이콘을 누르고 이 창으로 돌아오면 자동으로 반영됩니다. 안 되면 아래 버튼을 누르세요.</p>'+
      '<div class="kai-row"><button type="button" class="kai-btn p" data-q="grab">복사한 답 가져오기</button><button type="button" class="kai-btn g" data-q="cancel">취소</button></div><p class="kai-note" data-q="amsg" role="status"></p>'+
      '<details data-q="man"><summary class="kai-note">가져오기가 안 되면: 직접 붙여넣기</summary><textarea rows="4" data-q="ans" placeholder="AI 답 전체를 붙여넣기 ( { 로 시작 )"></textarea><div class="kai-row"><button type="button" class="kai-btn" data-q="ok">반영</button></div></details></li></ol></div>';
    document.body.appendChild(w);
    var g=function(k){return w.querySelector('[data-q="'+k+'"]');};g('qtext').value=q;
    var sent=false;
    var onF=function(){if(!sent||!(navigator.clipboard&&navigator.clipboard.readText))return;setTimeout(function(){navigator.clipboard.readText().then(function(t){if(t===q)return;var r;try{r=pickJson(t);}catch(e){return;}fin();res(r);},function(){});},400);};
    var esck=function(e){if(e.key==='Escape'){fin();rej({code:'paste_cancel'});}};
    var fin=function(){w.remove();window.removeEventListener('focus',onF);document.removeEventListener('keydown',esck);};
    var tryApply=function(t,clip){var r;try{r=pickJson(t);}catch(e){g('amsg').textContent=clip?'복사된 내용이 AI 답이 아닙니다. AI 답의 복사 아이콘을 누른 뒤 다시 가져오세요.':'JSON 형식의 답을 찾지 못했습니다. AI 답 전체를 복사했는지 확인하세요.';return;}fin();res(r);};
    window.addEventListener('focus',onF);document.addEventListener('keydown',esck);
    var copyNow=function(){var t=document.createElement('textarea');t.value=q;t.setAttribute('readonly','');t.style.cssText='position:fixed;left:-9999px;top:0';w.appendChild(t);t.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}t.remove();
      if(!ok&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(q).catch(function(){});ok=true;}return ok;};
    w.addEventListener('click',function(e){
      var b=e.target.closest('[data-q]');if(!b)return;var k=b.dataset.q;
      if(k==='go'){var x=PASTE_SITES.filter(function(y){return y[0]===b.dataset.v;})[0],ok=copyNow(),sv=raw();sv.site=x[0];try{localStorage.setItem(AIK,JSON.stringify(sv));}catch(er){}
        w.querySelectorAll('[data-q="go"]').forEach(function(y){y.classList.toggle('p',y===b);});
        g('cmsg').textContent=ok?'✓ 질문을 복사했습니다. 이제 열린 '+x[1]+' 창의 입력칸을 누르고 Ctrl+V → 보내기를 누르세요.':'자동 복사가 막혔습니다. "질문 내용 보기"를 열어 직접 복사하세요.';if(!ok)g('det').open=true;
        sent=true;window.open(x[2],'_blank','noopener');}
      else if(k==='dl'){var bl=new Blob([q],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(bl),a=document.createElement('a');a.href=u;a.download='KIF_question_'+Date.now()+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},4000);
        g('cmsg').textContent='✓ 질문 파일을 내려받았습니다. AI 창의 + (파일 첨부)로 올리고 "첨부한 지시대로 답해 주세요"라고 보내세요.';}
      else if(k==='grab'){if(!(navigator.clipboard&&navigator.clipboard.readText)){g('man').open=true;g('amsg').textContent='이 브라우저는 자동 가져오기를 막습니다. 아래 칸에 직접 붙여넣으세요.';return;}
        navigator.clipboard.readText().then(function(t){tryApply(t,true);},function(){g('man').open=true;g('amsg').textContent='붙여넣기 허용이 필요합니다. 브라우저가 물으면 "허용"을 누르거나, 아래 칸에 직접 붙여넣으세요.';});}
      else if(k==='ok')tryApply(g('ans').value,false);
      else if(k==='cancel'){fin();rej({code:'paste_cancel'});}
    });
  });
}
/* prompt + 읽은 자료 → JSON. 어떤 AI를 쓰든 같은 모양의 답 */
async function ask(prompt,mat){
  var c=cfg(),p=c.prov;mat=mat||{text:'',images:[],scanned:[]};
  if(c.mode!=='ai')throw {code:'ai_off'};
  var full=prompt+(mat.text?'\n\n자료:\n'+mat.text:'')+(mat.images.length?'\n\n(첨부한 사진·스캔 '+mat.images.length+'장도 함께 읽으세요)':'');
  if(p==='paste')return await pasteAsk(PASTE_HEAD+full,mat.scanned||[]);
  if(p==='claudeapp'){var h=claudeHost(),s=h&&await h.use('sample');if(!s)throw {code:'unavailable'};var o={};if(mat.images.length)o.images=mat.images;return await s.json(full,o);}
  var imgs=await Promise.all(mat.images.map(b64));
  if(p==='company'){if(!companyOk())throw {code:AI_PROXY?'admin_only':'no_proxy'};return pickJson(await relayCall(c,full,imgs));}
  if(!c.keys[p])throw {code:'no_key'};
  return pickJson(await apiCall(p,c.keys[p],model(c,p),full,imgs));
}
function err(e){
  var M={ai_off:'「AI 없이 쓰기」로 되어 있습니다. 「내 AI 등록」에서 AI를 고르세요.',no_key:'AI 키가 없습니다. 「내 AI 등록」에서 키를 넣어 주세요.',
    bad_key:'AI 키가 맞지 않거나 사용 권한이 없습니다. 「내 AI 등록」에서 키를 확인하세요.',bad_model:'모델 이름을 찾지 못했습니다. 「내 AI 등록」의 모델 이름을 확인하세요.',
    network:'AI 회사에 연결하지 못했습니다. 인터넷 연결을 확인하세요.',bad_json:'AI 답을 표로 바꾸지 못했습니다. 한 번 더 읽혀 보세요.',refused:'AI가 이 요청을 처리하지 않았습니다. 값을 직접 입력해 주세요.',
    rate_limited:'AI 사용량 한도에 걸렸습니다. 잠시 뒤 다시 해 보세요.',relay_down:'회사 AI 서버에 연결하지 못했습니다. 관리자에게 알려 주세요.',need_code:'회사 접속코드가 맞지 않습니다. 「내 AI 등록 › 회사 AI」에서 코드를 넣으세요.',
    need_login:'회사 AI는 포털에 로그인한 사람만 씁니다. 로그아웃 후 다시 로그인해 주세요.',admin_only:'회사 AI는 지금 관리자 전용입니다. 「내 AI 등록」에서 내 AI를 등록해 주세요.',no_proxy:'관리자가 아직 회사 AI를 켜지 않았습니다. 「내 AI 등록」에서 복사·붙여넣기를 고르세요.',paste_cancel:'AI 답을 가져오기 전에 창을 닫았습니다. 다시 눌러 주세요.',
    unavailable:'이 화면에서는 Claude 화면 연결을 쓸 수 없습니다. 「내 AI 등록」에서 다른 방식을 고르세요.',lib:'파일 읽기 도구를 불러오지 못했습니다(인터넷 연결 확인).'};
  var c=e&&e.code;return M[c]||(e&&e.message)||('AI 읽기 실패'+(c?' ('+c+')':''));
}

/* ---------- 고객 자료 저장 폴더 (PC 크롬·엣지) ----------
   처음 한 번 폴더를 고르면 그 안에 「한보금on_고객자료」 폴더를 만들고, 폴더 위치(핸들)를 이 기기 브라우저(IndexedDB)에 기억한다.
   이후 저장은 그 폴더에 날짜별 파일로 바로 쓴다. 폰·사파리·파이어폭스는 폴더 지정이 안 되므로 예전처럼 공유 창·다운로드로 저장한다. */
var FD_NAME='한보금on_고객자료',FD_LS='kif_bk_dir',fdH=null,fdLoaded=false;
function fdOk(){try{return !!window.showDirectoryPicker&&window.isSecureContext&&window.self===window.top&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);}catch(e){return false;}}
function idbDo(mode,f){return new Promise(function(res,rej){var r=indexedDB.open('kif_fs',1);r.onupgradeneeded=function(){r.result.createObjectStore('h');};r.onerror=function(){rej(r.error);};
  r.onsuccess=function(){var db=r.result,t=db.transaction('h',mode),q=f(t.objectStore('h'));t.oncomplete=function(){db.close();res(q&&q.result);};t.onerror=t.onabort=function(){db.close();rej(t.error);};};});}
function fdLabel(){try{return localStorage.getItem(FD_LS)||'';}catch(e){return '';}}
async function fdGet(){if(fdLoaded)return fdH;fdLoaded=true;if(!fdOk())return null;try{fdH=(await idbDo('readonly',function(s){return s.get('dir');}))||null;}catch(e){fdH=null;}if(!fdH){try{localStorage.removeItem(FD_LS);}catch(e){}}return fdH;}
async function fdPick(){
  if(!fdOk())throw {code:'fd_unsupported'};
  var base=await window.showDirectoryPicker({id:'kif-bk',mode:'readwrite',startIn:'documents'});
  var d=base.name===FD_NAME?base:await base.getDirectoryHandle(FD_NAME,{create:true});
  await idbDo('readwrite',function(s){return s.put(d,'dir');});fdH=d;fdLoaded=true;
  var lab=(base.name===FD_NAME?'':base.name+' › ')+FD_NAME;try{localStorage.setItem(FD_LS,lab);}catch(e){}
  fire();return lab;
}
async function fdClear(){fdH=null;fdLoaded=true;try{localStorage.removeItem(FD_LS);}catch(e){}try{await idbDo('readwrite',function(s){return s.delete('dir');});}catch(e){}fire();}
async function fdPerm(h,ask){var o={mode:'readwrite'};if((await h.queryPermission(o))==='granted')return true;return ask!==false&&(await h.requestPermission(o))==='granted';}
async function fdWrite(name,blob){
  var h=await fdGet();if(!h)return null;
  if(!(await fdPerm(h)))throw {code:'fd_denied'};
  var fh;try{fh=await h.getFileHandle(name,{create:true});}catch(e){if(e&&e.name==='NotFoundError'){await fdClear();throw {code:'fd_gone'};}throw e;}
  var w=await fh.createWritable();await w.write(blob);await w.close();return fdLabel()+' › '+name;
}
function fdErr(e){var M={fd_unsupported:'이 기기(브라우저)는 저장 폴더를 정할 수 없습니다. PC의 크롬이나 엣지에서 해 주세요.',fd_denied:'폴더에 저장하려면 브라우저 창에서 「허용」(파일 수정 허용)을 눌러야 합니다. 다시 눌러 주세요.',
  fd_gone:'정해 둔 저장 폴더를 찾을 수 없습니다(옮기거나 지웠을 수 있습니다). 저장 폴더를 다시 골라 주세요.'};
  if(e&&e.name==='SecurityError')return '이 폴더는 브라우저가 막는 곳입니다(바탕 화면·문서 자체 등). 그 안의 폴더를 고르거나 「새 폴더」로 만들어 고르세요.';
  return M[e&&e.code]||(e&&e.message)||String(e);}
function fdBox(){
  if(!fdOk())return '<div class="kai-tip"><b>이 기기는 저장 폴더를 미리 정할 수 없습니다</b><br>휴대폰·사파리·파이어폭스는 브라우저가 폴더 지정을 막습니다. 「내 정보 · 자료 보관」에서 저장을 누르면 그때 <b>드라이브·파일 앱</b>(폰)이나 <b>다운로드 폴더</b>(PC)에 저장됩니다. 폴더를 정하려면 PC의 <b>크롬</b>이나 <b>엣지</b>에서 열어 주세요.</div>';
  var l=fdLabel();
  return '<div class="kai-fd"><div class="kai-fdl">📁 저장 폴더: '+(l?'<b>'+esc(l)+'</b>':'<span>아직 정하지 않음</span>')+'</div>'+
    '<div class="kai-row"><button type="button" class="kai-btn'+(l?'':' p')+'" data-kai="fd">'+(l?'폴더 바꾸기':'저장 폴더 고르기')+'</button><span class="kai-note" id="kaiFdMsg" role="status"></span></div>'+
    '<p class="kai-note" style="margin:8px 0 0">창이 뜨면 <b>OneDrive</b>·<b>Google Drive</b>·<b>문서</b> 안에서 보관할 곳을 고르고 「폴더 선택」 → 「파일 수정 허용」을 누르세요. 고른 곳 안에 <b>'+FD_NAME+'</b> 폴더를 자동으로 만들어 줍니다. (바탕 화면·문서 자체는 크롬이 막으니, 그 안의 폴더를 고르거나 「새 폴더」를 만들어 고르세요.)</p></div>';
}
var folder={name:FD_NAME,ok:fdOk,get:fdGet,label:fdLabel,pick:fdPick,write:fdWrite,clear:fdClear,perm:fdPerm,err:fdErr};
if(document.readyState!=='loading')addCss();else document.addEventListener('DOMContentLoaded',addCss);
window.addEventListener('storage',function(e){if(e.key===AIK)fire();});
window.KIFAI={AIP:AIP,cfg:cfg,chosen:chosen,adminDefault:adminDefault,companyOk:companyOk,model:model,statusHTML:statusHTML,open:open,ask:ask,read:read,officeText:officeText,ocrPdf:ocrPdf,err:err,migrateClaudeKey:migrateClaudeKey,folder:folder,onChange:function(f){subs.push(f);}};
})();
