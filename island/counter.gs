/**
 * 時光社會島・訪客計數器
 * 部署方式：部署 → 新增部署作業 → 類型選「網頁應用程式」
 *   執行身分：我　／　誰可以存取：所有人
 * 部署後複製網址（https://script.google.com/macros/s/.../exec），貼到島上的 COUNTER_URL。
 *
 * ?mode=hit  ：今天第一次上島，人數 +1
 * ?mode=read ：同一台裝置今天再來，只讀數字不加
 * 數字存在「專案屬性」，不需要試算表；每天（臺灣時間）自動歸零今日人數。
 */
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var total = Number(props.getProperty('total') || 0);
    var todayCount = Number(props.getProperty('today') || 0);
    if (props.getProperty('day') !== today) todayCount = 0;

    if (e && e.parameter && e.parameter.mode === 'hit') {
      total += 1;
      todayCount += 1;
    }
    props.setProperties({ total: String(total), today: String(todayCount), day: today });

    return ContentService
      .createTextOutput(JSON.stringify({ total: total, today: todayCount }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
