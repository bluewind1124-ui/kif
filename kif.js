/* 한국보험금융(주) 신채널 영업지원 — 공통 헤더 · 메뉴 · 테마 */
(function(){
  var KEY_THEME='kif_theme', KEY_SIDE='kif_side';
  function get(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function set(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  var root=document.documentElement;
  var theme=get(KEY_THEME)||((window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light');
  root.setAttribute('data-theme',theme);

  var NAV=[
    ['index.html','홈','<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'],
    ['onepick.html','이번 달의 원픽','<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'],
    ['life.html','생명보험 가이드북 비교','<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M9 7h6"/>'],
    ['nonlife.html','담보별 비교견적','<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'],
    ['wholelife.html','단기납 종신보험 비교','<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'],
    ['critical3.html','3대질병진단비 비교','<path d="M3 12h4l2-6 4 12 2-6h6"/>'],
    ['ceoterm.html','경영인 정기보험 비교','<path d="M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2"/>']
  ];
  var page=(location.pathname.split('/').pop()||'index.html');

  function logout(){
    try{sessionStorage.removeItem('kif_ok');localStorage.removeItem('kif_keep');}catch(e){}
    location.href='index.html';
  }
  function setTheme(t){theme=t;root.setAttribute('data-theme',t);set(KEY_THEME,t);sync();}
  function sync(){
    var a=document.querySelectorAll('.kif-seg button');
    for(var i=0;i<a.length;i++)a[i].setAttribute('aria-pressed',a[i].getAttribute('data-t')===theme?'true':'false');
  }

  function build(){
    document.body.classList.add('kif');
    if(get(KEY_SIDE)==='off')document.body.classList.add('side-off');

    var top=document.createElement('div');top.className='kif-top';
    top.innerHTML=
      '<a class="brand" href="index.html"><img src="emblem.png" alt="">'+
      '<span><span class="tt">한국보험금융(주) <em>신채널 영업지원</em></span><span class="sub">보험상품 비교 도구</span></span></a>'+
      '<span class="sp"></span><span class="who">전략채널본부 · <b>보험상품 비교 도구</b></span>'+
      '<div class="kif-seg"><button data-t="light">라이트</button><button data-t="dark">다크</button></div>'+
      '<button class="kif-out">로그아웃</button>'+
      '<button class="kif-moon" aria-label="화면 테마 전환">☾</button>';
    var side=document.createElement('nav');side.className='kif-side';
    var h='<button class="kif-fold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>메뉴 접기</button>';
    for(var i=0;i<NAV.length;i++){
      h+='<a class="nv'+(NAV[i][0]===page?' on':'')+'" href="'+NAV[i][0]+'"><svg viewBox="0 0 24 24">'+NAV[i][2]+'</svg>'+NAV[i][1]+'</a>';
      if(i===0)h+='<hr>';
    }
    side.innerHTML=h;
    var open=document.createElement('button');open.className='kif-open';open.textContent='» 메뉴';

    document.body.insertBefore(side,document.body.firstChild);
    document.body.insertBefore(top,document.body.firstChild);
    document.body.appendChild(open);

    top.querySelector('.kif-seg').addEventListener('click',function(e){var t=e.target.getAttribute&&e.target.getAttribute('data-t');if(t)setTheme(t);});
    top.querySelector('.kif-moon').addEventListener('click',function(){setTheme(theme==='dark'?'light':'dark');});
    top.querySelector('.kif-out').addEventListener('click',logout);
    function side_(off){document.body.classList.toggle('side-off',off);set(KEY_SIDE,off?'off':'on');}
    side.querySelector('.kif-fold').addEventListener('click',function(){side_(true);});
    open.addEventListener('click',function(){side_(false);});
    sync();
  }
  if(document.body)build();else document.addEventListener('DOMContentLoaded',build);
})();
