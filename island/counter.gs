/**
 * 時光社會島・訪客計數器＋給島主的留言
 * ?mode=hit  ：今天第一次上島，人數 +1
 * ?mode=read ：只讀人數
 * ?mode=msg&name=&role=&text= ：寫一則留言到「時光社會島・給島主的留言」試算表
 * 第一次使用：在編輯器選 setup 按「執行」，授權後記錄裡會出現試算表網址。
 * 有新留言會寄信到 NOTIFY_EMAIL；不想收信就把它改成 ''。
 */
var NOTIFY_EMAIL = 'zeiyenst@apps.ntpc.edu.tw';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.mode === 'msg') return json_(saveMsg_(p));
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var total = Number(props.getProperty('total') || 0);
    var todayCount = Number(props.getProperty('today') || 0);
    if (props.getProperty('day') !== today) todayCount = 0;
    if (p.mode === 'hit') { total += 1; todayCount += 1; }
    props.setProperties({ total: String(total), today: String(todayCount), day: today });
    return json_({ total: total, today: todayCount });
  } finally {
    lock.releaseLock();
  }
}

function saveMsg_(p) {
  var text = clean_(p.text, 300);
  if (!text) return { ok: false, why: '先寫一句話再送出喔！' };
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var n = props.getProperty('msgDay') === today ? Number(props.getProperty('msgCount') || 0) : 0;
    if (n >= 200) return { ok: false, why: '今天的留言信箱滿了，明天再來留言吧！' };
    var name = clean_(p.name, 20), role = clean_(p.role, 10);
    var sh = getSheet_();
    sh.appendRow([new Date(), name, role, text]);
    props.setProperties({ msgDay: today, msgCount: String(n + 1) });
    notify_(name, role, text, sh.getParent().getUrl());
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function clean_(v, max) {
  var s = String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('sheetId');
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  var ss = SpreadsheetApp.create('時光社會島・給島主的留言');
  var sh = ss.getSheets()[0];
  sh.appendRow(['時間', '暱稱', '身分', '留言']);
  sh.setFrozenRows(1);
  sh.setColumnWidth(4, 420);
  props.setProperty('sheetId', ss.getId());
  return sh;
}

function notify_(name, role, text, url) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: '時光社會島：' + (name || '一位旅客') + '（' + (role || '旅客') + '）留言給你',
      body: text + '\n\n——\n暱稱：' + (name || '（沒填）') + '\n身分：' + (role || '（沒選）') + '\n所有留言：' + url,
      name: '時光社會島'
    });
  } catch (err) {}
}

function testMail() {
  notify_('測試', '其他', '這是時光社會島留言通知的測試信，收到就代表通知開好了！', getSheet_().getParent().getUrl());
}

function setup() {
  Logger.log('留言試算表：' + getSheet_().getParent().getUrl());
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
