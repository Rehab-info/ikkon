/* 姉妹サイト「蔵旅」から来た人にだけ、画面の下に「蔵旅に戻る」の帯を出す。
   (上に差し込むと、kura.html#zao のように蔵の位置へ飛んできたときに位置がずれるため下に浮かべています)
   来たページはタブの中(sessionStorage)に覚えておくので、一献の中でページを移っても帯は残ります。
   × を押すか、タブを閉じると消えます。 */
(function () {
  var KURATABI = 'https://rehab-info.github.io/kuratabi/';
  var KEY = 'ikkon-kuratabi-back';
  var back = null;
  try {
    if (document.referrer.indexOf(KURATABI) === 0) sessionStorage.setItem(KEY, document.referrer);
    back = sessionStorage.getItem(KEY);
  } catch (err) {
    // 保存できない環境(プライベートモードなど)では、このページだけ帯を出す
    if (document.referrer.indexOf(KURATABI) === 0) back = document.referrer;
  }
  if (!back || back.indexOf(KURATABI) !== 0) return;

  function show() {
    var bar = document.createElement('div');
    bar.className = 'kt-back';
    bar.innerHTML = '<div class="wrap"><a></a><button type="button" aria-label="閉じる">×</button></div>';
    var a = bar.querySelector('a');
    a.href = back;
    a.textContent = '← 蔵旅に戻る';
    bar.querySelector('button').addEventListener('click', function () {
      try { sessionStorage.removeItem(KEY); } catch (err) {}
      bar.remove();
      document.body.classList.remove('has-kt-back');
    });
    document.body.appendChild(bar);
    document.body.classList.add('has-kt-back');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
