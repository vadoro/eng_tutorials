/* 영어 튜토리얼 공통 ‘맨 위로’ 단추
 *
 * 첫 화면과 각 튜토리얼 index.html에서 불러옵니다(튜토리얼은 site-bar.js 바로 다음 줄).
 *   <script src="../assets/to-top.js"></script>
 *
 * - 한 화면쯤 내려가면 오른쪽 아래에 나타나고, 누르면 페이지 맨 위로 올라갑니다.
 *   넓은 화면에서는 화살표 + ‘맨 위로’, 휴대폰 너비에서는 화살표만 있는 동그란 단추.
 * - 섀도 DOM 안에 그려서 튜토리얼마다 다른 CSS와 섞이지 않습니다. 밝은/어두운 테마를 따릅니다.
 * - 단추 위에서 누른 키(스페이스 등)는 튜토리얼 단축키(재생 등)로 넘기지 않습니다.
 * - 키보드로 누르면 맨 위의 제목(h1)으로 초점도 옮겨, 이어서 Tab으로 위에서부터 움직일 수 있습니다.
 * - 영상 추출 화면(#export)에는 넣지 않으므로 MP4 결과는 바뀌지 않습니다.
 */
(function () {
  'use strict';
  if (location.hash === '#export') return;

  var host = document.createElement('div');
  host.id = 'en-to-top';
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>' +
    ':host{--bg:#FFFFFF;--ink:#1A1D21;--line:#DAD8D0;--accent:#1B6B5F;--shadow:0 10px 26px -12px rgba(10,20,26,.45);' +
    'position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:45;' +
    'font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;color-scheme:light}' +
    '@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){--bg:#161B1E;--ink:#E7ECEC;--line:#33403F;--accent:#6FD3C1;--shadow:0 10px 26px -12px rgba(0,0,0,.8);color-scheme:dark}}' +
    ':host([data-theme=dark]){--bg:#161B1E;--ink:#E7ECEC;--line:#33403F;--accent:#6FD3C1;--shadow:0 10px 26px -12px rgba(0,0,0,.8);color-scheme:dark}' +
    'button{display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 16px 0 13px;border:1px solid var(--line);border-radius:999px;' +
    'background:var(--bg);color:var(--ink);box-shadow:var(--shadow);font:inherit;font-size:14px;font-weight:700;cursor:pointer;' +
    'opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .2s,transform .2s,visibility 0s linear .2s,border-color .15s,color .15s}' +
    ':host(.on) button{opacity:1;visibility:visible;transform:none;transition:opacity .2s,transform .2s,visibility 0s,border-color .15s,color .15s}' +
    'button:hover{border-color:var(--accent);color:var(--accent)}' +
    'button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}' +
    'svg{width:18px;height:18px;flex:none}' +
    '@media (max-width:560px){button{width:44px;padding:0;justify-content:center}.t{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}' +
    '@media (prefers-reduced-motion:reduce){button,:host(.on) button{transition:none;transform:none}}' +
    '@media print{button{display:none}}' +
    '</style>' +
    '<button type="button" aria-label="맨 위로" title="맨 위로">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<span class="t">맨 위로</span></button>';

  var btn = shadow.querySelector('button');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  // 한 화면쯤 내려가면 보이기
  var queued = false;
  var sync = function () {
    queued = false;
    var on = window.scrollY > Math.max(400, window.innerHeight * 0.9);
    host.classList.toggle('on', on);
    btn.tabIndex = on ? 0 : -1;
    if (!on && shadow.activeElement === btn) btn.blur();
  };
  window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(sync); } }, { passive: true });
  window.addEventListener('resize', sync);

  btn.addEventListener('click', function (e) {
    window.scrollTo({ top: 0, behavior: reduce && reduce.matches ? 'auto' : 'smooth' });
    // 키보드로 눌렀으면(e.detail === 0) 맨 위 제목으로 초점을 옮김 — 사라지는 단추에 초점이 남지 않게
    if (e.detail === 0) {
      var h = document.querySelector('h1');
      if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  });
  // 단추 위에서 누른 키가 튜토리얼 단축키(스페이스 = 재생 등)로 넘어가지 않게
  ['keydown', 'keyup', 'keypress'].forEach(function (ev) { shadow.addEventListener(ev, function (e) { e.stopPropagation(); }); });

  // 페이지가 밝은/어두운 테마를 직접 정했다면 그대로 따름
  var syncTheme = function () {
    var th = document.documentElement.getAttribute('data-theme');
    if (th) host.setAttribute('data-theme', th); else host.removeAttribute('data-theme');
  };
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var put = function () { document.body.appendChild(host); sync(); };
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
})();
