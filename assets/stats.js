/* 영어 튜토리얼 방문자 통계 — 구글 애널리틱스(GA4)
 *
 * 첫 화면과 각 튜토리얼 index.html이 catalog.js(튜토리얼은 site-bar.js) 다음, to-top.js 앞에서 불러옵니다.
 *   <script src="../assets/stats.js"></script>
 *
 * - catalog.js의 site.stats.ga에 측정 ID와 사이트 주소(hosts)를 적으면 켜집니다(비워 두면 아무것도 보내지 않음).
 * - hosts에 적은 주소(Vercel · GitHub Pages)에서 연 페이지만 셉니다. 내 컴퓨터에서 연 파일, 미리보기,
 *   영상 추출 화면(#export, ?render)은 세지 않습니다. 그래서 MP4 결과는 바뀌지 않습니다.
 * - 통계는 https://analytics.google.com 에서 봅니다. 김용수 사이트 · DH 튜토리얼과 같은 측정 ID를 쓰므로
 *   보고서에서 '호스트 이름'으로 사이트를 나눠 봅니다.
 */
(function () {
  'use strict';
  var cat = window.EN_CATALOG, st = cat && cat.site && cat.site.stats, ga = st && st.ga;
  if (!ga || !ga.id || (ga.hosts || []).indexOf(location.hostname) < 0) return;
  if (location.hash === '#export' || new URLSearchParams(location.search).has('render')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ga.id);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga.id);
  document.head.appendChild(s);
})();
