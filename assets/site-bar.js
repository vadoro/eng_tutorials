/* 영어 튜토리얼 공통 상단 바
 *
 * 각 튜토리얼 index.html의 <body> 바로 다음에 넣습니다.
 *   <script src="../assets/catalog.js"></script>
 *   <script src="../assets/site-bar.js" data-slug="폴더이름"></script>
 *
 * - 섀도 DOM 안에 그려서 튜토리얼마다 다른 CSS와 서로 섞이지 않습니다.
 * - 영상 추출 화면(#export)에는 넣지 않으므로 MP4 결과는 바뀌지 않습니다.
 */
(function () {
  'use strict';
  if (location.hash === '#export') return;

  var me = document.currentScript;
  var root = me && me.src ? me.src.replace(/assets\/site-bar\.js(\?.*)?$/, '') : '../';
  var slug = (me && me.dataset.slug) || '';
  var cat = window.EN_CATALOG || { site: { title: '영어 튜토리얼' }, tracks: [], tutorials: [] };
  var cur = cat.tutorials.filter(function (t) { return t.slug === slug; })[0];
  var trackOf = function (id) { return cat.tracks.filter(function (k) { return k.id === id; })[0] || { title: '' }; };

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  // 폴더 주소 대신 index.html까지 적어야 더블클릭으로 연 파일에서도 이동이 됩니다
  var href = function (t) { return root + t.slug + '/index.html'; };

  var menu = cat.tracks.map(function (k) {
    var list = cat.tutorials.filter(function (t) { return t.track === k.id; });
    return '<li class="grp">' + esc(k.title) + (list.length ? '' : ' <em>준비 중</em>') + '</li>' + list.map(function (t) {
      return '<li><a href="' + esc(href(t)) + '"' + (t.slug === slug ? ' aria-current="page"' : '') + '>' + esc(t.title) + '<small>' + esc(t.length) + ' · 장면 ' + esc(t.scenes) + '개</small></a></li>';
    }).join('');
  }).join('');

  var host = document.createElement('div');
  host.id = 'en-site-bar';
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>' +
    ':host{--bg:#FFFFFF;--ink:#1A1D21;--muted:#5B6168;--line:#DAD8D0;--hover:#EFEEE8;--accent:#1B6B5F;--shadow:0 14px 34px -18px rgba(10,20,26,.45);' +
    'display:block;position:relative;z-index:50;font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;color-scheme:light}' +
    '@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){--bg:#0B1012;--ink:#E7ECEC;--muted:#9AA6AA;--line:#263034;--hover:#152024;--accent:#6FD3C1;color-scheme:dark}}' +
    ':host([data-theme=dark]){--bg:#0B1012;--ink:#E7ECEC;--muted:#9AA6AA;--line:#263034;--hover:#152024;--accent:#6FD3C1;color-scheme:dark}' +
    '.bar{display:flex;align-items:center;gap:10px;min-height:46px;padding:6px max(16px,env(safe-area-inset-left,0px));background:var(--bg);color:var(--ink);border-bottom:1px solid var(--line);font-size:14px;line-height:1.3;box-sizing:border-box}' +
    'a{color:inherit;text-decoration:none}' +
    '.home{display:inline-flex;align-items:center;gap:8px;font-weight:700;white-space:nowrap;padding:4px 6px;border-radius:8px}' +
    '.home:hover{background:var(--hover)}' +
    '.mark{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;background:var(--accent);color:var(--bg);font-size:11px;font-weight:800;letter-spacing:-.02em}' +
    '.sep{color:var(--muted)}' +
    '.here{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.here b{font-weight:600}' +
    '.here span{color:var(--muted);margin-left:6px}' +
    '.sp{flex:1}' +
    'details{position:relative}' +
    'summary{list-style:none;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;cursor:pointer;white-space:nowrap;font-weight:600;font-size:13px}' +
    'summary::-webkit-details-marker{display:none}' +
    'summary:hover{background:var(--hover)}' +
    'summary svg{width:12px;height:12px;transition:transform .15s}' +
    'details[open] summary svg{transform:rotate(180deg)}' +
    '.menu{position:absolute;right:0;top:calc(100% + 6px);width:min(320px,calc(100vw - 32px));margin:0;padding:6px;list-style:none;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);box-sizing:border-box;max-height:calc(100vh - 80px);max-height:calc(100dvh - 80px);overflow-y:auto;overscroll-behavior:contain}' +
    '.menu .grp{padding:8px 10px 2px;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--accent)}' +
    '.menu .grp em{font-style:normal;font-weight:500;color:var(--muted);margin-left:4px}' +
    '.menu a{display:block;padding:8px 10px;border-radius:8px}' +
    '.menu a:hover{background:var(--hover)}' +
    '.menu a[aria-current=page]{background:var(--hover);box-shadow:inset 3px 0 0 var(--accent)}' +
    '.menu small{display:block;color:var(--muted);font-size:12px;margin-top:1px}' +
    '.menu .all{border-top:1px solid var(--line);margin-top:4px;padding-top:4px}' +
    'a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
    '@media (max-width:560px){.here span,.sep,.here{display:none}}' +
    '@media (prefers-reduced-motion:reduce){summary svg{transition:none}}' +
    '</style>' +
    '<nav class="bar" aria-label="영어 튜토리얼 사이트">' +
    '<a class="home" href="' + esc(root + 'index.html') + '"><span class="mark" aria-hidden="true">EN</span>' + esc(cat.site.title) + '</a>' +
    (cur ? '<span class="sep" aria-hidden="true">/</span><span class="here"><b>' + esc(cur.title) + '</b><span>' + esc(trackOf(cur.track).title) + '</span></span>' : '') +
    '<span class="sp"></span>' +
    '<details><summary>다른 튜토리얼 <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></summary>' +
    '<ul class="menu">' + menu +
    '<li class="all"><a href="' + esc(root + 'index.html') + '">전체 목록 보기</a></li>' +
    '</ul></details>' +
    '</nav>';

  // 페이지가 밝은/어두운 테마를 직접 정했다면 그대로 따름
  var syncTheme = function () {
    var th = document.documentElement.getAttribute('data-theme');
    if (th) host.setAttribute('data-theme', th); else host.removeAttribute('data-theme');
  };
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // 메뉴 밖을 누르거나 Esc를 누르면 닫기
  var det = shadow.querySelector('details');
  document.addEventListener('click', function (e) { if (det.open && !e.composedPath().includes(host)) det.open = false; });
  // 튜토리얼이 많아 메뉴가 화면보다 길면 메뉴 안에서 스크롤하고, 열 때 지금 튜토리얼이 보이게
  det.addEventListener('toggle', function () {
    if (!det.open) return;
    var m = shadow.querySelector('.menu'), c = shadow.querySelector('[aria-current=page]');
    if (c && m.scrollHeight > m.clientHeight) m.scrollTop = Math.max(0, c.offsetTop - m.clientHeight / 2 + c.offsetHeight / 2);
  });
  shadow.addEventListener('keydown', function (e) {
    // 바 안에서 누른 키가 튜토리얼의 단축키(스페이스 = 재생 등)로 넘어가지 않게
    e.stopPropagation();
    if (e.key === 'Escape' && det.open) { det.open = false; shadow.querySelector('summary').focus(); }
  });

  var put = function () { document.body.insertBefore(host, document.body.firstChild); };
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
})();
