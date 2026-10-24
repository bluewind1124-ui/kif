/* 한국보험금융 비교 도구 — 관리자가 올린 이번 달 비교 데이터 불러오기
   관리자 › 자료 관리 › 「비교자료 업로드」에서 원본 자료를 올리고 AI로 읽어 저장하면
   content.json의 cmpdata[도구]에 {month, upd, title, file(원본), data(classic/data/도구.json), ver}가 들어간다.
   각 도구는 DATA를 만든 바로 뒤에서 KIFCMP_LOAD('도구', DATA)를 불러, 올린 데이터가 있으면 그것으로 바꾼다.
   순위(1·2·3위)는 지금처럼 도구가 화면에서 고른 옵션에 따라 데이터를 정렬해 자동으로 매긴다.
   관리자의 「미리 보기」는 이 브라우저의 localStorage(kif_cmpprev_도구)에 잠시(2시간) 넣어 둔 데이터를 먼저 쓴다. */
(function(){
  function get(u){
    try{var x=new XMLHttpRequest();x.open('GET',u,false);x.send(null);
      if(x.status!==200)return null;return JSON.parse(x.responseText);}catch(e){return null;}
  }
  function fill(d,base){
    if(!d||typeof d!=='object'||Array.isArray(d))return null;
    Object.keys(base).forEach(function(k){if(d[k]===undefined)d[k]=base[k];});
    return d;
  }
  window.KIFCMP_LOAD=function(id,base){
    try{
      var pk='kif_cmpprev_'+id,pv=null;
      try{pv=JSON.parse(localStorage.getItem(pk)||'null');}catch(e){pv=null;}
      if(pv&&pv.exp>Date.now()&&pv.data){var pd=fill(pv.data,base);
        if(pd){window.KIFCMP={id:id,preview:true,month:pv.month||'',upd:pv.upd||'',file:pv.file||'',title:pv.title||''};return pd;}}
      else if(pv){try{localStorage.removeItem(pk);}catch(e){}}
      var c=get('../content.json?_='+Date.now()),r=c&&c.cmpdata&&c.cmpdata[id];
      if(!r)return base;
      window.KIFCMP={id:id,month:r.month||'',upd:r.upd||'',file:r.file||'',title:r.title||''};
      if(!r.data)return base;
      var d=fill(get('../'+r.data+'?v='+encodeURIComponent(r.ver||Date.now())),base);
      if(d)return d;
      window.KIFCMP.err=1;return base;
    }catch(e){return base;}
  };

  /* 화면 위쪽(header.app)에 「○○○○.○○ 자료 기준 · 원본 자료 보기」 표시 */
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function openSrc(K){
    var f=K.file;if(!f)return;
    if(/^(blob:|data:)/.test(f)){window.open(f,'_blank','noopener');return;}
    try{if(window.parent!==window&&window.parent.location.origin===location.origin){
      window.parent.postMessage({kif:'mat',file:f,title:K.title||'이번 달 원본 자료'},location.origin);return;}}catch(e){}
    window.open('../'+f,'_blank','noopener');
  }
  function badge(){
    var K=window.KIFCMP,hdr=document.querySelector('header.app');if(!K||!hdr||hdr.querySelector('.kif-cmp'))return;
    var st=document.createElement('style');
    st.textContent='.kif-cmp{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:10px;font-size:12.5px;color:var(--muted)}'+
      '.kif-cmp .m{display:inline-block;border:1px solid var(--gold,#CD9B34);color:var(--gold,#CD9B34);border-radius:20px;padding:2px 10px;font-weight:700}'+
      '.kif-cmp .pv{background:#CD9B34;color:#0F2340;border-radius:20px;padding:2px 10px;font-weight:700}'+
      '.kif-cmp button{font:inherit;font-size:12.5px;border:1px solid var(--line-strong,#c9cfdb);background:var(--surface,#fff);color:inherit;border-radius:8px;padding:3px 10px;cursor:pointer}'+
      '.kif-cmp button:hover{border-color:var(--gold,#CD9B34)}';
    document.head.appendChild(st);
    var b=document.createElement('div');b.className='kif-cmp';
    b.innerHTML=(K.preview?'<span class="pv">미리 보기 · 아직 저장 전 (관리자 화면에서만 보임)</span>':'')+
      (K.month?'<span class="m">'+esc(K.month)+' 자료 기준</span>':'')+
      (K.upd?'<span>업데이트 '+esc(K.upd)+'</span>':'')+
      (K.file?'<button type="button" class="kif-cmp-src">📎 이번 달 원본 자료 보기</button>':'')+
      (K.err?'<span>새 데이터를 불러오지 못해 지난 데이터로 보여 줍니다. 새로고침해 보세요.</span>':'');
    hdr.appendChild(b);
    var sb=b.querySelector('.kif-cmp-src');if(sb)sb.onclick=function(){openSrc(K);};
    /* 머리말의 지난 기준월·U/W 기준일 글자를 새 자료 기준으로 */
    if(K.month){var kk=hdr.querySelector('.kicker');if(kk){var ym=K.month.replace(/^20(\d{2})\.(\d{2})$/,'$1.$2');kk.innerHTML=kk.innerHTML.replace(/\(\d{2}\.\d{2}\)/,'('+esc(ym)+')');}}
    if(K.upd){var p=hdr.querySelector('p');if(p)p.innerHTML=p.innerHTML.replace(/(U\/W(?: 기준일?)?\s*)\d{4}\.\d{2}\.\d{2}/,'$1'+esc(K.upd));}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();
})();
