/* 한보금on 「내 자료함」 — AI보장분석 기본형·고급형에서 만든 리포트·제안서를 이 기기에 날짜별로 보관한다.
   고객 자료는 회사 서버에 올리지 않는다. 이 기기 브라우저(IndexedDB, 안 되면 localStorage)에만 둔다.
   보관 단위: {id, src:'basic'|'adv', cid, cname, kind, title, at, html, wrap, css, sig}
   - css는 크기를 줄이려고 따로 한 번만 저장하고(css 저장소, 키 = 내용 서명) 항목에는 그 키만 둔다.
   - 같은 고객·같은 종류는 최근 KEEP개만 남긴다. 내용이 직전과 같으면 새로 만들지 않는다.
   window.KIFARC = { add, list, get, del, dump, load, open, mountBox, KEEP } */
(function(){
'use strict';
if(window.KIFARC) return;
var KEEP=5, DB='kif_archive', LS='kif_arc_ls', LSCSS='kif_arc_css';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function sig(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+'_'+s.length.toString(36);}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

/* ---- 저장소: IndexedDB 우선, 안 되면 localStorage ---- */
var dbP=null;
function idb(){
  if(dbP) return dbP;
  dbP=new Promise(function(res,rej){
    try{
      if(!window.indexedDB) return rej(new Error('no idb'));
      var r=indexedDB.open(DB,1);
      r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});if(!d.objectStoreNames.contains('css'))d.createObjectStore('css',{keyPath:'k'});};
      r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};r.onblocked=function(){rej(new Error('blocked'));};
    }catch(e){rej(e);}
  });
  dbP.catch(function(){});
  return dbP;
}
function tx(store,mode,fn){return idb().then(function(d){return new Promise(function(res,rej){var t=d.transaction(store,mode),s=t.objectStore(store),out=fn(s);t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out);};t.onerror=function(){rej(t.error);};t.onabort=function(){rej(t.error);};});});}
function lsGet(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
var B={
  all:function(){return tx('items','readonly',function(s){return s.getAll();}).catch(function(){return lsGet(LS,[]);});},
  put:function(it){return tx('items','readwrite',function(s){s.put(it);}).catch(function(){var L=lsGet(LS,[]).filter(function(x){return x.id!==it.id;});L.push(it);if(!lsSet(LS,L))throw new Error('이 기기의 저장 공간이 부족합니다.');});},
  del:function(id){return tx('items','readwrite',function(s){s.delete(id);}).catch(function(){lsSet(LS,lsGet(LS,[]).filter(function(x){return x.id!==id;}));});},
  cssGet:function(k){return tx('css','readonly',function(s){return s.get(k);}).then(function(r){return r&&r.v||'';}).catch(function(){return (lsGet(LSCSS,{})[k])||'';});},
  cssPut:function(k,v){return tx('css','readwrite',function(s){s.put({k:k,v:v});}).catch(function(){var o=lsGet(LSCSS,{});o[k]=v;lsSet(LSCSS,o);});},
  cssAll:function(){return tx('css','readonly',function(s){return s.getAll();}).then(function(L){var o={};(L||[]).forEach(function(x){o[x.k]=x.v;});return o;}).catch(function(){return lsGet(LSCSS,{});});}
};

function list(){return B.all().then(function(L){return (L||[]).map(function(x){return {id:x.id,src:x.src,cid:x.cid,cname:x.cname,kind:x.kind,title:x.title,at:x.at};}).sort(function(a,b){return b.at-a.at;});});}
function get(id){return B.all().then(function(L){return (L||[]).filter(function(x){return x.id===id;})[0]||null;});}

/* 보관: html=본문, wrap=감쌀 class, css=그 화면의 스타일 전체 */
function add(o){
  if(!o||!o.html||!o.cid) return Promise.resolve(null);
  var css=String(o.css||''),ck=css?sig(css):'',s=sig(o.html);
  return B.all().then(function(L){
    L=L||[];
    var same=L.filter(function(x){return x.src===o.src&&x.cid===o.cid&&x.kind===o.kind;}).sort(function(a,b){return b.at-a.at;});
    if(same[0]&&same[0].sig===s){var u=Object.assign({},same[0],{at:Date.now(),cname:o.cname||same[0].cname});return B.put(u).then(function(){return {item:u,dup:true};});}
    var it={id:uid(),src:o.src,cid:String(o.cid),cname:o.cname||'',kind:o.kind||'자료',title:o.title||o.kind||'자료',at:Date.now(),html:o.html,wrap:o.wrap||'',css:ck,sig:s,bg:o.bg||''};
    var p=css?B.cssPut(ck,css):Promise.resolve();
    return p.then(function(){return B.put(it);}).then(function(){
      var old=same.slice(KEEP-1);
      return Promise.all(old.map(function(x){return B.del(x.id);}));
    }).then(function(){return {item:it,dup:false};});
  });
}
function del(id){return B.del(id);}

/* 보관 파일(내 정보 · 자료 보관)에 함께 넣고 꺼낸다 */
function dump(){return Promise.all([B.all(),B.cssAll()]).then(function(r){var used={};(r[0]||[]).forEach(function(x){if(x.css)used[x.css]=1;});var css={};Object.keys(used).forEach(function(k){if(r[1][k])css[k]=r[1][k];});return {items:r[0]||[],css:css};}).catch(function(){return {items:[],css:{}};});}
function load(d){
  if(!d||!Array.isArray(d.items)) return Promise.resolve(0);
  var css=d.css||{};
  return Promise.all(Object.keys(css).map(function(k){return B.cssPut(k,css[k]);})).then(function(){
    return B.all();
  }).then(function(L){
    var have={};(L||[]).forEach(function(x){have[x.id]=1;});
    var add=d.items.filter(function(x){return x&&x.id&&!have[x.id];});
    return add.reduce(function(p,x){return p.then(function(){return B.put(x);});},Promise.resolve()).then(function(){return add.length;});
  });
}

/* 보관한 화면을 한 장짜리 HTML 문서로 */
function docOf(it){
  return B.cssGet(it.css).then(function(css){
    return '<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc((it.cname||'고객')+'님 '+it.title)+'</title>'+
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">'+
      '<style>'+css+'\nbody{background:'+(it.bg||'#eef1f6')+';padding:20px;margin:0}.arc-stamp{max-width:960px;margin:0 auto 12px;font:13px/1.5 sans-serif;color:#5c6b72}.no-print,.pp-notewrap button,.pp-range{pointer-events:none}@media print{.arc-stamp{display:none}body{padding:0;background:#fff}}</style></head><body>'+
      '<div class="arc-stamp">보관본 · '+esc(new Date(it.at).toLocaleString('ko-KR'))+' · '+esc(it.src==='adv'?'AI보장분석 고급형':'AI보장분석 기본형')+' — 숫자는 보관한 때 기준입니다</div>'+
      '<div class="'+esc(it.wrap)+'">'+it.html+'</div></body></html>';
  });
}

/* 보기 창: 화면 위에 띄우고 인쇄·닫기 */
function open(id,doc){
  doc=doc||document;
  return get(id).then(function(it){
    if(!it) throw new Error('보관본을 찾지 못했습니다.');
    return docOf(it).then(function(html){
      var old=doc.getElementById('arcView');if(old)old.remove();
      var w=doc.createElement('div');w.id='arcView';
      w.setAttribute('style','position:fixed;inset:0;z-index:9999;background:rgba(20,28,36,.55);display:flex;flex-direction:column;padding:12px');
      w.innerHTML='<div style="display:flex;gap:8px;align-items:center;background:#fff;border-radius:10px 10px 0 0;padding:8px 12px;flex-wrap:wrap"><b style="font-size:14px">'+esc((it.cname||'고객')+'님 · '+it.title)+'</b><span style="font-size:12px;color:#6b7780">'+esc(new Date(it.at).toLocaleString('ko-KR'))+'</span><span style="flex:1"></span>'+
        '<button type="button" class="btn sm" data-arcv="print">인쇄 · PDF 저장</button><button type="button" class="btn sm ghost" data-arcv="close">닫기</button></div>'+
        '<iframe title="보관본" style="flex:1;border:0;background:#fff;border-radius:0 0 10px 10px;width:100%"></iframe>';
      doc.body.appendChild(w);
      var f=w.querySelector('iframe');f.srcdoc=html;
      w.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-arcv]');if(!b)return;
        if(b.getAttribute('data-arcv')==='close')w.remove();
        else{try{f.contentWindow.focus();f.contentWindow.print();}catch(er){}}});
      doc.addEventListener('keydown',function k(e){if(e.key==='Escape'&&doc.getElementById('arcView')){w.remove();doc.removeEventListener('keydown',k);}});
      return it;
    });
  });
}

/* 「내 자료함」 화면 */
function mountBox(el,toast){
  if(!el) return;
  toast=toast||function(){};
  var q='',src='';
  function draw(){
    list().then(function(L){
      var F=L.filter(function(x){return (!src||x.src===src)&&(!q||(x.cname||'').indexOf(q)>-1);});
      var G={},order=[];
      F.forEach(function(x){var k=x.src+'|'+x.cid;if(!G[k]){G[k]={src:x.src,cname:x.cname,items:[]};order.push(k);}G[k].items.push(x);});
      var nB=0,nA=0,cs={};L.forEach(function(x){cs[x.src+'|'+x.cid]=x.src;});Object.keys(cs).forEach(function(k){if(cs[k]==='adv')nA++;else nB++;});
      var h='<div class="panel"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">'+
        '<input class="in" id="arcQ" placeholder="고객 이름 검색" value="'+esc(q)+'" style="max-width:220px" aria-label="고객 이름 검색">'+
        '<button class="btn sm '+(src===''?'':'ghost')+'" data-arcsrc="">전체</button><button class="btn sm '+(src==='basic'?'':'ghost')+'" data-arcsrc="basic">기본형</button><button class="btn sm '+(src==='adv'?'':'ghost')+'" data-arcsrc="adv">고급형</button>'+
        '<span class="sp" style="flex:1"></span><span class="note">기본형 고객 '+nB+'명 · 고급형 고객 '+nA+'명 · 보관본 '+L.length+'개</span></div>'+
        '<p class="note" style="margin:8px 0 0">리포트·제안서를 <b>인쇄·PDF 저장</b>하거나, AI 분석 결과가 나오거나, <b>「자료함에 보관」</b>을 누르면 그때 모습이 여기에 남습니다. 고객·종류마다 최근 '+KEEP+'개까지 보관하고, 이 기기에만 있습니다(다른 PC로 옮기려면 「내 정보 · 자료 보관」의 저장 파일에 함께 들어갑니다).</p></div>';
      if(!order.length){
        h+='<div class="panel"><p class="note">'+(L.length?'찾는 고객의 보관본이 없습니다.':'아직 보관한 자료가 없습니다. AI보장분석 기본형·고급형에서 리포트나 제안서를 만들고 「자료함에 보관」 또는 인쇄를 누르면 여기에 쌓입니다.')+'</p>'+
          '<div class="row" style="gap:6px"><button class="btn sm" data-go="ai">AI보장분석 기본형</button><button class="btn sm ghost" data-go="ai2">AI보장분석 고급형</button></div></div>';
      }
      order.forEach(function(k){var g=G[k];
        h+='<div class="panel"><h3>'+esc(g.cname||'(이름 없음)')+'님 <span class="pill '+(g.src==='adv'?'new':'')+'">'+(g.src==='adv'?'고급형':'기본형')+'</span><span class="note">보관본 '+g.items.length+'개</span></h3>'+
          '<div class="tbl"><table><thead><tr><th>보관한 때</th><th>자료</th><th class="r">열기</th></tr></thead><tbody>'+
          g.items.map(function(x,i){var latest=!g.items.slice(0,i).some(function(y){return y.kind===x.kind;});
            return '<tr><td>'+esc(new Date(x.at).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}))+'</td><td><b>'+esc(x.title)+'</b>'+(latest?' <span class="pill ok">최신</span>':' <span class="note">이전</span>')+'</td>'+
              '<td class="r" style="white-space:nowrap"><button class="btn sm" data-arcopen="'+esc(x.id)+'">보기·인쇄</button> <button class="btn sm ghost" data-arcdel="'+esc(x.id)+'" title="이 보관본 지우기">삭제</button></td></tr>';}).join('')+
          '</tbody></table></div></div>';
      });
      el.innerHTML=h;
      var qi=el.querySelector('#arcQ');if(qi){qi.oninput=function(){q=qi.value.trim();var pos=qi.selectionStart;draw();setTimeout(function(){var n=el.querySelector('#arcQ');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}},0);};}
    });
  }
  var armed='';
  el.onclick=function(e){
    var b=e.target.closest&&e.target.closest('[data-arcopen],[data-arcdel],[data-arcsrc]');if(!b)return;
    if(b.hasAttribute('data-arcsrc')){src=b.getAttribute('data-arcsrc');draw();return;}
    if(b.hasAttribute('data-arcopen')){open(b.getAttribute('data-arcopen')).catch(function(er){toast(er.message||'열지 못했습니다');});return;}
    var id=b.getAttribute('data-arcdel');
    if(armed!==id){armed=id;b.textContent='한 번 더 누르면 삭제';setTimeout(function(){if(armed===id){armed='';if(b.isConnected)b.textContent='삭제';}},3000);return;}
    armed='';del(id).then(function(){toast('보관본을 지웠습니다');draw();});
  };
  draw();
}

/* 화면 안의 <style>을 모두 모은다 (보관본이 같은 모양으로 보이게) */
function pageCss(doc){var s='';(doc||document).querySelectorAll('style').forEach(function(x){s+=x.textContent+'\n';});return s;}

window.KIFARC={add:add,list:list,get:get,del:del,dump:dump,load:load,open:open,mountBox:mountBox,pageCss:pageCss,KEEP:KEEP};
})();
