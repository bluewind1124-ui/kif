/* 한국보험금융 포털 — 비교 도구 5종 「AI로 나눠 읽기」 (관리자 › 자료 관리 › 비교자료 업로드)
   비교 도구의 DATA는 커서(최대 약 320KB) AI가 한 번에 다시 쓸 수 없다(AI 답 한도 약 16,000토큰).
   그래서 DATA를 약 1만 글자 이하 「단위」로 나누고, 단위마다 「지난 달 단위 JSON + 새 자료의 해당 쪽 글자」를 AI에 주어
   같은 구조의 새 JSON을 받은 뒤 다시 합친다. 순위(1·2·3위)는 만들지 않는다 — 도구가 화면 옵션에 따라 자동으로 정렬한다.
   window.KIFCMPAI = { units, label, pick, mapPages, run, runUnit, merge, stat }
   이 파일은 화면을 그리지 않는다(관리자 화면은 index.html). AI 부르기는 밖에서 ask(prompt, text)로 넘겨 받는다. */
(function(root){
  var LIM=10000;
  function size(x){try{return JSON.stringify(x).length;}catch(e){return 0;}}
  function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  function isObj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
  function at(d,path){var v=d;for(var i=0;i<path.length;i++){if(v==null)return undefined;v=v[path[i]];}return v;}

  /* ---------- 1. 나누기 ---------- */
  function split(path,val,lim,out){
    if(!val||typeof val!=='object'||size(val)<=lim){out.push({path:path,whole:true});return;}
    var isA=Array.isArray(val),keys=isA?val.map(function(_,i){return i;}):Object.keys(val),grp=[],gs=0;
    var flush=function(){if(!grp.length)return;out.push(isA?{path:path,from:grp[0],to:grp[grp.length-1]+1}:{path:path,keys:grp});grp=[];gs=0;};
    keys.forEach(function(k){var v=val[k],s=size(v);
      if(s>lim&&v&&typeof v==='object'){flush();split(path.concat([k]),v,lim,out);return;}
      if(grp.length&&gs+s>lim)flush();grp.push(k);gs+=s;});
    flush();
  }
  function nameOf(v){if(!isObj(v))return '';return String(v.title||v.label||v.name||v.prod||v.co||v.id||'').slice(0,40);}
  /* 데이터 키 이름을 관리자에게 보이는 말로 */
  var KN={meta:'기준 정보',sets:'비교표',sections:'구분',details:'상품 상세',groups:'담보별 비교',totalGroups:'합계 비교',infoGroups:'보장·가입 안내',coverDetail:'주요치료비 안내',overview:'상품 개요',overviewCompanies:'개요 회사',rows:'줄',blocks:'묶음',silson:'실손',ref_bojong:'참고·보종',ref_hando:'참고·한도',catExtras:'구분 추가',desc:'설명',ages:'나이'};
  function kn(k){return KN[k]||k;}
  function label(base,u){
    var parts=[],v=base;
    u.path.forEach(function(k){v=v==null?undefined:v[k];var n=nameOf(v);parts.push(typeof k==='number'?(n||(k+1)+'번'):(n&&n!==k?kn(k)+' · '+n:kn(k)));});
    if(u.keys){var ks=u.keys.map(kn);parts.push(ks.length>3?ks.slice(0,3).join(', ')+' 외 '+(ks.length-3)+'개':ks.join(', '));}
    if(u.from!=null){var arr=at(base,u.path)||[],f=nameOf(arr[u.from]);parts.push('목록 '+(u.from+1)+'~'+u.to+'번'+(f?' ('+f+' …)':''));}
    return parts.join(' › ')||'전체';
  }
  function units(base,lim){
    var out=[];split([],base,lim||LIM,out);
    /* 같은 목록을 여러 묶음으로 나눴으면 묶음 번호를 적어 둔다(새 줄은 마지막 묶음에서만 넣게) */
    out.forEach(function(u,i){u.id='u'+i;u.label=label(base,u);u.size=size(pick(base,u));});
    out.forEach(function(u){if(u.from==null)return;var sib=out.filter(function(x){return x.from!=null&&JSON.stringify(x.path)===JSON.stringify(u.path);});
      if(sib.length>1){u.part=sib.indexOf(u)+1;u.parts=sib.length;}});
    return out;
  }
  function pick(base,u){
    var p=at(base,u.path);
    if(u.keys){var o={};u.keys.forEach(function(k){o[k]=p[k];});return o;}
    if(u.from!=null)return (p||[]).slice(u.from,u.to);
    return p;
  }

  /* ---------- 2. 쪽 찾기 ---------- */
  function head(t,n){return String(t||'').split('\n').map(function(x){return x.trim();}).filter(Boolean).slice(0,n||4).join(' / ').slice(0,180);}
  /* AI 없이: 단위 안의 이름(회사·상품·항목·제목)이 많이 나오는 쪽 */
  function words(v,acc){
    acc=acc||{};
    if(typeof v==='string'){String(v).split(/[\s\/·,()\[\]|:~]+/).forEach(function(w){w=w.trim();if(w.length>=2&&w.length<=20&&/[가-힣A-Za-z]/.test(w)&&!/^\d/.test(w))acc[w]=1;});}
    else if(Array.isArray(v))v.forEach(function(x){words(x,acc);});
    else if(isObj(v))Object.keys(v).forEach(function(k){if(/[가-힣]/.test(k))words(k,acc);words(v[k],acc);});
    return acc;
  }
  /* 단위 안의 제목(title·label) 글자 — 쪽 맨 위 제목 줄과 맞춰 볼 때 쓴다 */
  function titles(v,acc,d){
    acc=acc||[];d=d||0;if(d>3||v==null||typeof v!=='object')return acc;
    if(Array.isArray(v)){if(d<1)v.slice(0,3).forEach(function(x){titles(x,acc,d+1);});return acc;}
    if(typeof v.title==='string')acc.push(v.title);
    Object.keys(v).forEach(function(k){if(k!=='rows'&&k!=='vals')titles(v[k],acc,d+1);});
    return acc;
  }
  /* 여러 쪽에 다 나오는 말(회사 이름 등)은 가볍게, 몇 쪽에만 나오는 말은 무겁게 센다.
     쪽 맨 위 3줄(표 제목)에 단위 제목의 말이 나오면 더 크게 센다 — 예전에는 회사 이름이 많은 쪽을 모든 단위에 골랐다 */
  function guess(pages,val,max,extra){
    var W=Object.keys(words(val)).slice(0,600),T=Object.keys(words(titles(val).concat(extra||[])));
    if(!(W.length||T.length)||!pages.length)return [];
    var N=pages.length,heads=pages.map(function(p){return head(p.text,3);}),df={};
    W.concat(T).forEach(function(w){if(df[w]!=null)return;var c=0;pages.forEach(function(p){if(p.text.indexOf(w)>-1)c++;});df[w]=c;});
    var idf=function(w){return Math.log((N+1)/(df[w]+0.5));};
    var sc=pages.map(function(p,i){var t=p.text,s=0;
      W.forEach(function(w){if(df[w]&&df[w]<N*0.7&&t.indexOf(w)>-1)s+=idf(w);});
      T.forEach(function(w){if(df[w]&&heads[i].indexOf(w)>-1)s+=6*idf(w);});
      return {i:i,s:s};});
    var top=sc.slice().sort(function(a,b){return b.s-a.s;}),best=top[0].s;if(!(best>0))return [];
    return top.filter(function(x){return x.s>=best*0.6;}).slice(0,max||4).map(function(x){return x.i;}).sort(function(a,b){return a-b;});
  }
  /* 단위 위쪽(구분 등)의 제목 — 긴 목록을 나눈 묶음에는 제목이 없어서 */
  function upTitles(base,u){var v=base,t=[];u.path.forEach(function(k){v=v==null?undefined:v[k];if(isObj(v)&&typeof v.title==='string')t.push(v.title);});return t;}
  /* 단위에 구분(표)이 여러 개 묶여 있으면 구분마다 따로 찾아 합친다 */
  function guessUnit(P,base,u){
    var v=pick(base,u),up=upTitles(base,u),kids=isObj(v)?Object.keys(v).filter(function(k){return isObj(v[k])&&typeof v[k].title==='string';}):[],out=[];
    if(kids.length>1)kids.forEach(function(k){guess(P,v[k],2,[v[k].title].concat(up)).forEach(function(i){if(out.indexOf(i)<0)out.push(i);});});
    else out=guess(P,v,4,[u.label].concat(up));
    return out.sort(function(a,b){return a-b;}).slice(0,6).map(function(i){return P[i].n;});
  }
  function unitHint(base,u){var t=upTitles(base,u).concat(titles(pick(base,u))).filter(function(x,i,a){return x&&a.indexOf(x)===i;}).slice(0,4);return t.length?' (표 제목: '+t.join(' / ')+')':'';}
  async function mapPages(o){
    var U=o.units,P=o.pages,res={map:{},month:'',upd:'',by:'guess'};
    if(P.length>1&&o.ask){
      try{
        var q='너는 보험 비교 자료 편집자다. 「'+o.tool+'」 비교 도구에 쓸 새 자료(쪽마다 첫 몇 줄만 보여 줌)와, 도구 데이터의 단위 목록이 있다.\n'+
          '단위마다 그 내용(회사·상품별 보험료·환급률·조건 등)이 실린 쪽 번호를 골라라. 한 단위에 여러 쪽이어도 된다(최대 6쪽). 해당 쪽이 없으면 빈 배열.\n'+
          '답은 JSON 하나: {"month":"자료 기준월 YYYY.MM (모르면 빈 문자열)","upd":"자료에 적힌 기준일·U/W 기준일 YYYY.MM.DD (모르면 빈 문자열)","map":{"u0":[쪽 번호,…],…}}\n\n'+
          '단위 목록:\n'+U.map(function(u){return u.id+': '+u.label+unitHint(o.base,u);}).join('\n')+'\n\n쪽 목록:\n'+P.map(function(p){return '['+p.n+'쪽] '+head(p.text);}).join('\n');
        var r=await o.ask(q,'');
        if(r&&isObj(r.map)){Object.keys(r.map).forEach(function(k){var a=[].concat(r.map[k]||[]).map(function(x){return parseInt(x,10);}).filter(function(x){return x>0&&x<=P.length;});if(a.length){res.map[k]=a.slice(0,6);res.by='ai';}});}
        if(r&&/^20\d{2}\.\d{2}$/.test(r.month||''))res.month=r.month;
        if(r&&/^20\d{2}\.\d{2}\.\d{2}$/.test(r.upd||''))res.upd=r.upd;
      }catch(e){res.err=e;}
    }
    U.forEach(function(u){if(!res.map[u.id])res.map[u.id]=guessUnit(P,o.base,u);});
    return res;
  }

  /* ---------- 3. 단위마다 AI로 다시 쓰기 ---------- */
  function coerce(old,nw){
    if(typeof old==='number'&&typeof nw==='string'){var s=nw.replace(/[,\s]|원$|%$/g,'');if(/^-?\d+(\.\d+)?$/.test(s))return +s;return nw;}
    if(Array.isArray(old)&&Array.isArray(nw))return nw.map(function(x,i){return coerce(old[i]!==undefined?old[i]:old[0],x);});
    if(isObj(old)&&isObj(nw)){Object.keys(nw).forEach(function(k){if(old[k]!==undefined)nw[k]=coerce(old[k],nw[k]);});return nw;}
    return nw;
  }
  /* 객체는 빠진 키를 지난 값으로 채운다(배열 안은 줄이 빠진 것일 수 있어 건드리지 않음) */
  function fill(old,nw,path,miss){
    if(!isObj(old)||!isObj(nw))return nw;
    Object.keys(old).forEach(function(k){if(nw[k]===undefined){nw[k]=clone(old[k]);miss.push(path.concat([k]).join('.'));}else nw[k]=fill(old[k],nw[k],path.concat([k]),miss);});
    return nw;
  }
  /* 줄(배열 안 객체)은 같은 줄(id·key·회사+상품·항목 이름이 같은 줄)을 찾았을 때만 빠진 키를 채운다 */
  function rowKey(x){if(!isObj(x))return '';return x.id!=null?'id:'+x.id:x.key!=null?'key:'+x.key:(x.co!=null||x.prod!=null)?'cp:'+x.co+'|'+x.prod+'|'+(x.age||''):x.label!=null?'l:'+x.label:x.l!=null?'l:'+x.l:x.title!=null?'t:'+x.title:'';}
  function sameRow(oldA,x){var k=rowKey(x);if(!k)return null;for(var i=0;i<oldA.length;i++)if(rowKey(oldA[i])===k)return oldA[i];return null;}
  function shape(x){return Array.isArray(x)?'arr':isObj(x)?'obj':typeof x;}
  /* AI가 {"v":…}로 감싸지 않고 데이터만 보내거나 다른 이름으로 감싸 보내도 받아 준다.
     예전에는 이런 답을 모두 「새 자료에 이 부분이 없다」로 처리해 단위가 하나도 안 바뀌었다 */
  function unwrap(r,old){
    if(r==null)return {};
    if(Array.isArray(r))return Array.isArray(old)?{v:r}:{};
    if(!isObj(r))return {};
    if(r.v!=null)return {v:r.v};
    if(r.none===true||r.none==='true')return {none:true};
    var alt=['value','data','result','json','answer','fixed','new'];
    for(var i=0;i<alt.length;i++)if(r[alt[i]]!=null&&shape(r[alt[i]])===shape(old))return {v:r[alt[i]]};
    if(isObj(old)){var ok=Object.keys(old),hit=ok.filter(function(k){return k in r;}).length;if(ok.length&&hit>=Math.ceil(ok.length/2))return {v:r};}
    var ks=Object.keys(r).filter(function(k){return k!=='none';});
    if(ks.length===1&&shape(r[ks[0]])===shape(old))return {v:r[ks[0]]};
    return {};
  }
  function prompt(o,u,old,text){
    var many=u.parts>1;
    return '너는 보험 GA(한국보험금융) 상품 비교 자료 편집자다. FC 포털 「'+o.tool+'」 비교 도구 데이터의 한 부분('+u.label+')을 이번 달 새 자료로 고쳐라.\n'+
      '아래 「지난 달 데이터」는 이 부분의 지금 JSON이고, 「자료」는 새 자료에서 이 부분에 해당하는 쪽의 글자다([n쪽]은 쪽 번호, | 는 표의 칸 경계).\n'+
      '규칙:\n- 답은 JSON 하나: {"v": 고친 데이터}. v는 지난 달 데이터와 같은 모양이다('+(Array.isArray(old)?'배열':'객체')+'). 키 이름·순서·자료형을 그대로 지켜라.\n'+
      '- 숫자·금액·보험료·환급률·상품명·회사명은 자료에 적힌 그대로 옮겨라. 숫자 칸은 숫자로(쉼표·단위 없이), 비어 있던(null) 칸은 자료에도 없으면 null.\n'+
      '- 자료에서 찾을 수 없는 값은 지난 달 값을 그대로 둬라. 절대 지어내지 마라.\n'+
      '- 자료에서 사라진 회사·상품 줄은 빼고, 새로 생긴 회사·상품은 같은 모양으로 넣어라.'+(many?(u.part<u.parts?' 단, 이 부분은 긴 목록을 '+u.parts+'묶음으로 나눈 '+u.part+'번째 묶음이다. 새 줄은 넣지 말고(마지막 묶음에서 넣는다) 이 묶음의 줄만 고쳐라.':' 이 부분은 긴 목록을 '+u.parts+'묶음으로 나눈 마지막 묶음이다. 목록에 새로 생긴 줄은 이 묶음 끝에 넣어라.'):'')+'\n'+
      '- 기준일·기준월·U/W 날짜 글자가 있으면 새 자료의 날짜로 바꿔라.\n'+
      '- 순위·추천·선정 이유 같은 문구는 새로 만들지 마라(순위는 도구가 화면 옵션에 따라 자동으로 매긴다).\n'+
      '- 이 부분에 해당하는 내용이 자료에 전혀 없으면 {"v":null,"none":true}.\n\n'+
      '지난 달 데이터(구조 참고, 값은 새 자료로 바꿀 것):\n'+JSON.stringify(old);
  }
  function pagesText(P,nums,cap){
    var t='',seen={};(nums||[]).forEach(function(n){if(seen[n])return;seen[n]=1;var p=P.filter(function(x){return x.n===n;})[0];if(p)t+='['+n+'쪽]\n'+p.text+'\n\n';});
    return t.slice(0,cap||40000);
  }
  /* 단위를 반으로 나눈다(목록은 앞·뒤 줄, 객체는 앞·뒤 키). 나눌 수 없으면 null */
  function halves(base,u){
    var p=at(base,u.path),lastOk=!(u.parts>1&&u.part<u.parts),mk=function(x,i,n){x.id=u.id+'_'+i;x.label=u.label+' (나눠 읽기 '+i+'/'+n+')';
      if(x.from!=null){x.part=lastOk?i:1;x.parts=lastOk?n:2;}return x;};
    if(Array.isArray(p)&&(u.from!=null||u.whole)){var f=u.from!=null?u.from:0,t=u.from!=null?u.to:p.length;
      if(t-f===1&&p[f]&&typeof p[f]==='object'){var o1={path:u.path.concat([f]),whole:true,id:u.id+'_1',label:u.label};return {one:true,list:[o1]};}
      if(t-f<2)return null;var m=f+Math.ceil((t-f)/2);
      return {arr:true,list:[mk({path:u.path,from:f,to:m},1,2),mk({path:u.path,from:m,to:t},2,2)]};}
    if(isObj(p)&&(u.keys||u.whole)){var ks=u.keys||Object.keys(p);if(!ks.length)return null;
      /* 한 키(예: rows)가 대부분이면 그 키만 따로 떼어 안으로 들어가 나눈다 */
      var sz=ks.map(function(k){return size(p[k]);}),tot=sz.reduce(function(a,b){return a+b;},0),bi=sz.indexOf(Math.max.apply(null,sz)),bk=ks[bi];
      if(sz[bi]>=tot*0.5&&p[bk]&&typeof p[bk]==='object'){var rest=ks.filter(function(k){return k!==bk;}),inner={path:u.path.concat([bk]),whole:true,as:bk,id:u.id+'_k',label:u.label};
        return {list:rest.length?[{path:u.path,keys:rest,id:u.id+'_r',label:u.label+' (나눠 읽기 1/2)'},inner]:[inner]};}
      if(ks.length<2)return null;
      var acc=0,h=1;for(var j=0;j<ks.length-1;j++){acc+=sz[j];if(acc>=tot/2){h=j+1;break;}h=j+1;}
      return {list:[mk({path:u.path,keys:ks.slice(0,h)},1,2),mk({path:u.path,keys:ks.slice(h)},2,2)]};}
    return null;
  }
  /* AI 답이 너무 길어 중간에 끊기면(JSON이 닫히지 않음) 단위를 반으로 나눠 다시 읽고 합친다 */
  async function runSplit(o,u,map,depth){
    var H=halves(o.base,u);if(!H)return null;
    var m2={};H.list.forEach(function(x){m2[x.id]=(map&&map[u.id])||[];});
    var parts=[];for(var i=0;i<H.list.length;i++){var r=await runUnit(o,H.list[i],m2,(depth||0)+(H.list.length>1?1:0));if(!r.ok)return r;parts.push(r);}
    var v;if(H.one)v=[parts[0].v];else if(H.arr){v=[];parts.forEach(function(x){v=v.concat(x.v);});}else{v={};parts.forEach(function(x,i){if(H.list[i].as!=null)v[H.list[i].as]=x.v;else Object.keys(x.v).forEach(function(k){v[k]=x.v[k];});});}
    var old=pick(o.base,u),miss=[];parts.forEach(function(x){miss=miss.concat(x.miss||[]);});
    return {ok:true,v:v,miss:miss,pages:(map&&map[u.id])||[],stat:stat(old,v),split:true};
  }
  async function runUnit(o,u,map,depth){
    var old=pick(o.base,u),nums=(map&&map[u.id])||[],text=o.pages.length?pagesText(o.pages,nums):'';
    if(o.pages.length&&!text.trim())return {ok:false,none:true,err:'새 자료에서 이 부분의 쪽을 찾지 못했습니다'};
    var r,tries=0,q=prompt(o,u,old,text),w;
    for(;;){
      try{r=await o.ask(q,text);}
      catch(e){
        /* 답이 끊겼거나 JSON이 깨졌으면: 같은 질문을 다시 하기보다 반으로 나눠 짧게 다시 묻는다(최대 4번 나눔) */
        if(e&&e.code==='bad_json'&&(depth||0)<4&&halves(o.base,u)){var sp=await runSplit(o,u,map,depth);if(sp)return sp;}
        if(tries++<1&&e&&(e.code==='rate_limited'||e.code==='bad_json'||e.code==='network')){await new Promise(function(s){setTimeout(s,e.code==='rate_limited'?8000:1500);});continue;}
        return {ok:false,err:(o.err?o.err(e):(e&&e.message)||String(e))};}
      w=unwrap(r,old);
      if(w.v==null&&!w.none&&tries++<1){q=prompt(o,u,old,text)+'\n\n[다시 요청] 앞의 답에서 고친 데이터를 찾지 못했다. 반드시 {"v": 고친 데이터} 모양 JSON 하나로만 답하라.';continue;}
      break;
    }
    if(w.none)return {ok:false,none:true,err:'새 자료에 이 부분이 없다고 했습니다 (지난 값 유지)',pages:nums};
    if(w.v==null)return {ok:false,err:'AI 답에서 고친 데이터를 찾지 못했습니다 (지난 값 유지) — 「다시 읽기」를 눌러 주세요',pages:nums};
    r={v:w.v};
    var v=r.v;if(shape(v)!==shape(old))return {ok:false,err:'AI 답의 모양이 지난 데이터와 다릅니다',pages:nums};
    v=coerce(old,v);var miss=[];
    if(Array.isArray(v))v=v.map(function(x,i){return fill(sameRow(old,x),x,[String(i)],miss);});else v=fill(old,v,[],miss);
    var s=stat(old,v);
    return {ok:true,v:v,miss:miss,pages:nums,stat:s};
  }
  async function run(o){
    /* o = {tool, base(DATA), pages:[{n,text}], ask(prompt,text)→JSON, err(e)→글, step(글), conc, only:[unit id]} */
    var U=o.units||units(o.base),step=o.step||function(){};
    var M=o.map;
    if(!M){step('새 자료에서 단위별 쪽을 찾는 중…');M=await mapPages({tool:o.tool,units:U,pages:o.pages,base:o.base,ask:o.ask});}
    var res=o.res||{},todo=U.filter(function(u){return !o.only||o.only.indexOf(u.id)>-1;}),done=0,i=0,conc=Math.max(1,o.conc||3);
    step('단위 '+todo.length+'개를 읽는 중… (0/'+todo.length+')');
    async function worker(){while(i<todo.length){var u=todo[i++];res[u.id]=await runUnit(o,u,M.map);
      /* AI가 고른 쪽에서 「없다」고 하면, 표 제목·상품 이름으로 찾은 다른 쪽으로 한 번 더 읽는다 */
      if(res[u.id].none&&o.pages.length){var g=guessUnit(o.pages,o.base,u),was=(M.map[u.id]||[]).join(',');if(g.length&&g.join(',')!==was){var m2={};m2[u.id]=g;var r2=await runUnit(o,u,m2);if(r2.ok||!r2.none)res[u.id]=r2;}}
      done++;step('단위 '+todo.length+'개를 읽는 중… ('+done+'/'+todo.length+')');if(o.tick)o.tick(u,res[u.id]);}}
    var W=[];for(var k=0;k<Math.min(conc,todo.length);k++)W.push(worker());await Promise.all(W);
    return {units:U,map:M,res:res};
  }

  /* ---------- 4. 합치기 · 점검 ---------- */
  function merge(base,U,res){
    var d=clone(base),order=U.filter(function(u){return res[u.id]&&res[u.id].ok;}).slice();
    /* 깊은 곳부터, 같은 목록 안에서는 뒤 묶음부터 바꿔야 번호가 밀리지 않는다 */
    order.sort(function(a,b){return b.path.length-a.path.length||((b.from||0)-(a.from||0));});
    order.forEach(function(u){var v=clone(res[u.id].v);
      if(u.whole){if(!u.path.length){d=v;return;}var p=at(d,u.path.slice(0,-1));p[u.path[u.path.length-1]]=v;return;}
      var par=at(d,u.path);
      if(u.keys){Object.keys(v).forEach(function(k){par[k]=v[k];});return;}
      par.splice.apply(par,[u.from,u.to-u.from].concat(v));});
    if(isObj(base)&&isObj(d))Object.keys(base).forEach(function(k){if(d[k]===undefined)d[k]=clone(base[k]);});
    return d;
  }
  function leaves(v,p,out){
    if(Array.isArray(v)){out.__rows=(out.__rows||0)+v.length;v.forEach(function(x,i){leaves(x,p+'['+i+']',out);});}
    else if(isObj(v))Object.keys(v).forEach(function(k){leaves(v[k],p+'.'+k,out);});
    else out[p]=v;
    return out;
  }
  function stat(a,b){
    var A=leaves(a,'',{}),B=leaves(b,'',{}),ch=0,ad=0,rm=0;
    Object.keys(B).forEach(function(k){if(k==='__rows')return;if(!(k in A))ad++;else if(A[k]!==B[k])ch++;});
    Object.keys(A).forEach(function(k){if(k!=='__rows'&&!(k in B))rm++;});
    return {changed:ch,added:ad,removed:rm,rowsOld:A.__rows||0,rowsNew:B.__rows||0};
  }
  root.KIFCMPAI={LIM:LIM,halves:halves,units:units,label:label,pick:pick,mapPages:mapPages,guess:guess,guessUnit:guessUnit,unwrap:unwrap,run:run,runUnit:runUnit,merge:merge,stat:stat,size:size};
  if(typeof module!=='undefined')module.exports=root.KIFCMPAI;
})(typeof window!=='undefined'?window:globalThis);
