/**
 * 穿越清帝國大逃脫 — 教師後台（Google Apps Script）
 * 安裝：
 * 1. 新增一份 Google 試算表 → 擴充功能 → Apps Script，貼上本檔全部內容。
 * 2. 部署 → 新增部署作業 → 類型「網頁應用程式」；執行身分「我」；存取權「所有人」。
 * 3. 把部署後的網址（結尾是 /exec）貼到 index.html 和 teacher.html 最上方的 GAS_URL。
 * 4. 後台密碼不寫在程式裡：請填在試算表「設定」工作表的 B1 儲存格（沒填之前後台讀不到任何成績）。
 *
 * 同一個後台也收〈漢人文化成為主流〉三關探究（han-culture）的成績，
 * 存在「漢人文化-成績」「漢人文化-即時」兩張工作表，不會和清帝國大逃脫混在一起。
 * 也收〈讀懂選舉公報：南園里政見探究〉（nanyuan）的作答，存在「南園里-成績」「南園里-即時」。
 * 更新本檔後：部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署，網址不變。
 */
const SHEET = 'records';
const HEAD = ['時間','sid','班級','座號','解開機關','機關總數','所在關卡','逃脫','總分','通關分','時間分','精準分','用時秒','提示','錯誤','各題錯誤(JSON)','課別','同組座號'];

const LIVE = '即時';   // 學生一進入遊戲就會出現在這裡，每次挑戰一列、持續更新
const LIVE_HEAD = ['sid','最後更新','班級','座號','同組座號','課別','解開機關','機關總數','所在關卡','狀態'];
function live_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LIVE);
  if (!sh) { sh = ss.insertSheet(LIVE); sh.appendRow(LIVE_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function liveUpsert_(d, cls, seat, mates, status) {
  const sid = String(d.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  if (!sid) return;
  const sh = live_(), n = sh.getLastRow();
  const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  let row = -1;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === sid) { row = i + 2; break; }
  const v = [sid, new Date(), cls, seat, mates, Number(d.ch) === 2 ? 2 : 1,
    Number(d.solved) || 0, Number(d.total) || 0, Number(d.room) || 1, status];
  if (row > 0) sh.getRange(row, 1, 1, v.length).setValues([v]); else sh.appendRow(v);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function key_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('設定');
  if (!sh) { sh = ss.insertSheet('設定'); sh.getRange('A1').setValue('後台密碼（請填在右邊 B1）'); sh.setColumnWidth(1, 220); }
  return String(sh.getRange('B1').getValue()).trim();
}
function setup() { sheet_(); key_(); }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 學生端：每過一關與逃脫成功時上傳一筆
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse(e.postData.contents);
    if (d.game === 'han-culture') return hanPost_(d);
    if (d.game === 'nanyuan') return nyPost_(d);
    if (d.game !== 'qing-escape') return json_({ ok: false });
    const cls = String(d.cls || '').replace(/\D/g, '').slice(0, 3);
    const seat = Math.max(0, Math.min(99, parseInt(d.seat, 10) || 0));
    const mates = (Array.isArray(d.mates) ? d.mates : []).slice(0, 2).map(n => Math.max(0, Math.min(99, parseInt(n, 10) || 0))).filter(n => n).join(',');
    // 即時回報（進入遊戲、每解一個機關、每 90 秒）
    if (d.type === 'live') { liveUpsert_(d, cls, seat, mates, '作答中'); return json_({ ok: true }); }
    sheet_().appendRow([new Date(), String(d.sid || '').slice(0, 20), cls, seat,
      Number(d.solved) || 0, Number(d.total) || 0, Number(d.room) || 0, d.done ? 'Y' : '',
      Number(d.score) || 0, Number(d.pass) || 0, Number(d.time) || 0, Number(d.acc) || 0,
      Number(d.secs) || 0, Number(d.hints) || 0, Number(d.errors) || 0,
      JSON.stringify(d.wrongBy || {}).slice(0, 2000), Number(d.ch) === 2 ? 2 : 1,
      mates]);
    liveUpsert_(d, cls, seat, mates, d.done ? '逃脫成功' : '作答中');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// 教師端：?key=密碼&cls=501&ch=1（cls、ch 可省略）
function doGet(e) {
  const q = e.parameter || {};
  const k = key_();
  if (!k || q.key !== k) return json_({ ok: false, error: 'key' });
  if (q.game === 'han-culture') return hanGet_(q);
  if (q.game === 'nanyuan') return nyGet_(q);
  const rows = sheet_().getDataRange().getValues().slice(1);
  const out = rows
    .filter(r => (!q.cls || String(r[2]) === String(q.cls)) && (!q.ch || String(r[16]) === String(q.ch)))
    .map(r => ({ ts: new Date(r[0]).getTime(), sid: r[1], cls: String(r[2]), seat: Number(r[3]),
      solved: r[4], total: r[5], room: r[6], done: r[7] === 'Y', score: r[8], pass: r[9], time: r[10],
      acc: r[11], secs: r[12], hints: r[13], errors: r[14], wrongBy: safe_(r[15]), ch: Number(r[16]) || 1,
      mates: String(r[17] || '').split(',').map(Number).filter(n => n) }));
  // 即時作答名單（12 小時內有更新的）
  const lsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIVE), since = Date.now() - 12 * 3600 * 1000;
  const live = (lsh && lsh.getLastRow() > 1 ? lsh.getRange(2, 1, lsh.getLastRow() - 1, 10).getValues() : [])
    .filter(r => r[1] instanceof Date && r[1].getTime() > since)
    .filter(r => (!q.cls || String(r[2]) === String(q.cls)) && (!q.ch || String(r[5]) === String(q.ch)))
    .map(r => ({ sid: String(r[0]), t: r[1].getTime(), cls: String(r[2]), seat: Number(r[3]),
      mates: String(r[4] || '').split(',').map(Number).filter(n => n), ch: Number(r[5]) || 1,
      solved: Number(r[6]) || 0, total: Number(r[7]) || 0, room: Number(r[8]) || 1, status: String(r[9]) }));
  return json_({ ok: true, rows: out, live: live });
}
function safe_(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

/* ===================== 漢人文化成為主流（han-culture） ===================== */
const HAN = '漢人文化-成績';
const HAN_HEAD = ['時間','sid','班級','座號','同組座號','完成關卡','全部完成','總分','第1關','第2關','第3關','用時秒','錯誤','各題錯誤(JSON)','第1關一句話','第2關結局','第2關線索數','第3關比較題作答','思考題作答(JSON)'];
const HAN_LIVE = '漢人文化-即時';
const HAN_LIVE_HEAD = ['sid','最後更新','班級','座號','同組座號','所在關卡','狀態'];
function hanSheet_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < head.length) sh.getRange(1, 1, 1, head.length).setValues([head]);  // 舊表補上新欄位標題
  return sh;
}
// 學生寫的文字：限長度，開頭是 = + - @ 的加上 ' 避免被當成公式
function txt_(s, n) { s = String(s || '').replace(/[\r\n\t]+/g, ' ').slice(0, n || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function hanPost_(d) {
  const cls = String(d.cls || '').replace(/\D/g, '').slice(0, 3);
  const seat = Math.max(0, Math.min(99, parseInt(d.seat, 10) || 0));
  const mates = (Array.isArray(d.mates) ? d.mates : []).slice(0, 2).map(n => Math.max(0, Math.min(99, parseInt(n, 10) || 0))).filter(n => n).join(',');
  const sid = String(d.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const lv = Math.max(1, Math.min(4, Number(d.lv) || 1));
  const status = d.done ? '全部完成' : '作答中';
  // 即時名單
  if (sid) {
    const sh = hanSheet_(HAN_LIVE, HAN_LIVE_HEAD), n = sh.getLastRow();
    const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
    let row = -1;
    for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === sid) { row = i + 2; break; }
    const v = [sid, new Date(), cls, seat, mates, lv, status];
    if (row > 0) sh.getRange(row, 1, 1, v.length).setValues([v]); else sh.appendRow(v);
  }
  if (d.type === 'live') return json_({ ok: true });
  hanSheet_(HAN, HAN_HEAD).appendRow([new Date(), sid, cls, seat, mates,
    Math.max(0, Math.min(3, Number(d.cleared) || 0)), d.done ? 'Y' : '',
    Number(d.score) || 0, Number(d.s1) || 0, Number(d.s2) || 0, Number(d.s3) || 0,
    Number(d.secs) || 0, Number(d.errors) || 0, JSON.stringify(d.wrongBy || {}).slice(0, 2000),
    txt_(d.sentence, 200), txt_(d.ending, 40), Number(d.clues) || 0, txt_(d.cmp, 80), thinkJson_(d.think)]);
  return json_({ ok: true });
}
// 思考題：{題號: 作答}，每題限 200 字
function thinkJson_(t) {
  const o = {};
  if (t && typeof t === 'object') Object.keys(t).slice(0, 20).forEach(k => { o[String(k).slice(0, 12)] = String(t[k] || '').replace(/[\r\n\t]+/g, ' ').slice(0, 200); });
  const s = JSON.stringify(o);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function hanGet_(q) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(HAN);
  const rows = (sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HAN_HEAD.length).getValues() : [])
    .filter(r => !q.cls || String(r[2]) === String(q.cls))
    .map(r => ({ ts: new Date(r[0]).getTime(), sid: String(r[1]), cls: String(r[2]), seat: Number(r[3]),
      mates: String(r[4] || '').split(',').map(Number).filter(n => n), cleared: Number(r[5]) || 0, done: r[6] === 'Y',
      score: Number(r[7]) || 0, s1: Number(r[8]) || 0, s2: Number(r[9]) || 0, s3: Number(r[10]) || 0,
      secs: Number(r[11]) || 0, errors: Number(r[12]) || 0, wrongBy: safe_(r[13]),
      sentence: String(r[14] || '').replace(/^'/, ''), ending: String(r[15] || ''), clues: Number(r[16]) || 0, cmp: String(r[17] || ''), think: safe_(String(r[18] || '{}').replace(/^'/, '')) }));
  const lsh = ss.getSheetByName(HAN_LIVE), since = Date.now() - 12 * 3600 * 1000;
  const live = (lsh && lsh.getLastRow() > 1 ? lsh.getRange(2, 1, lsh.getLastRow() - 1, HAN_LIVE_HEAD.length).getValues() : [])
    .filter(r => r[1] instanceof Date && r[1].getTime() > since)
    .filter(r => !q.cls || String(r[2]) === String(q.cls))
    .map(r => ({ sid: String(r[0]), t: r[1].getTime(), cls: String(r[2]), seat: Number(r[3]),
      mates: String(r[4] || '').split(',').map(Number).filter(n => n), lv: Number(r[5]) || 1, status: String(r[6]) }));
  return json_({ ok: true, rows: rows, live: live });
}

/* ===================== 讀懂選舉公報：南園里政見探究（nanyuan） ===================== */
const NY = '南園里-成績';
const NY_HEAD = ['時間','sid','班級','座號','角色','完成關卡','全部完成','提早交卷','總分','第1關','第2關','第3關','用時秒','錯誤','各題錯誤(JSON)','三把尺(JSON)','最在意(代碼)','最在意政見','最在意理由','我的政見','測驗類型','測驗作答','同組座號','篇'];
const NY_LIVE = '南園里-即時';
const NY_LIVE_HEAD = ['sid','最後更新','班級','座號','角色','所在關卡','狀態','同組座號','篇'];
const NY_ROLES = ['kid','learn','sport','elder','dog','bus','rain','new'];
function nyRulers_(o) {
  const out = {}, okv = /^[\u4e00-\u9fffA-Za-z]{0,8}$/;
  if (o && typeof o === 'object') Object.keys(o).slice(0, 8).forEach(k => {
    const id = String(k).replace(/[^A-Za-z0-9]/g, '').slice(0, 4), r = o[k] || {};
    if (!id) return;
    out[id] = { c: okv.test(r.c || '') ? r.c : '', f: okv.test(r.f || '') ? r.f : '', v: okv.test(r.v || '') ? r.v : '',
      why: String(r.why || '').replace(/[\r\n\t]+/g, ' ').slice(0, 200) };
  });
  const s = JSON.stringify(out);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function nyPost_(d) {
  const cls = String(d.cls || '').replace(/\D/g, '').slice(0, 3);
  const seat = Math.max(0, Math.min(99, parseInt(d.seat, 10) || 0));
  const mates = (Array.isArray(d.mates) ? d.mates : []).slice(0, 2).map(n => Math.max(0, Math.min(99, parseInt(n, 10) || 0))).filter(n => n).join(',');
  const sid = String(d.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const role = NY_ROLES.indexOf(d.role) >= 0 ? d.role : '';
  const ed = d.ed === 'council' || d.ed === 'mayor' ? d.ed : 'li';
  const lv = Math.max(1, Math.min(4, Number(d.lv) || 1));
  const status = d.done ? (d.early ? '提早交卷' : '全部完成') : '作答中';
  if (sid) {
    const sh = hanSheet_(NY_LIVE, NY_LIVE_HEAD), n = sh.getLastRow();
    const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
    let row = -1;
    for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === sid) { row = i + 2; break; }
    const v = [sid, new Date(), cls, seat, role, lv, status, mates, ed];
    if (row > 0) sh.getRange(row, 1, 1, v.length).setValues([v]); else sh.appendRow(v);
  }
  if (d.type === 'live') return json_({ ok: true });
  hanSheet_(NY, NY_HEAD).appendRow([new Date(), sid, cls, seat, role,
    Math.max(0, Math.min(3, Number(d.cleared) || 0)), d.done ? 'Y' : '', d.early ? 'Y' : '',
    Number(d.score) || 0, Number(d.s1) || 0, Number(d.s2) || 0, Number(d.s3) || 0,
    Number(d.secs) || 0, Number(d.errors) || 0, JSON.stringify(d.wrongBy || {}).slice(0, 2000),
    nyRulers_(d.rulers), String(d.top || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4),
    txt_(d.topText, 120), txt_(d.topWhy, 200), txt_(d.mine, 200),
    NY_ROLES.indexOf(d.qtype) >= 0 ? d.qtype : '',
    (Array.isArray(d.qans) ? d.qans : []).slice(0, 6).map(t => NY_ROLES.indexOf(t) >= 0 ? t : '').join(','), mates, ed]);
  return json_({ ok: true });
}
function nyGet_(q) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const un = v => String(v || '').replace(/^'/, '');
  const sh = ss.getSheetByName(NY);
  const rows = (sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, NY_HEAD.length).getValues() : [])
    .filter(r => !q.cls || String(r[2]) === String(q.cls))
    .map(r => ({ ts: new Date(r[0]).getTime(), sid: String(r[1]), cls: String(r[2]), seat: Number(r[3]) || 0, role: String(r[4] || ''),
      cleared: Number(r[5]) || 0, done: r[6] === 'Y', early: r[7] === 'Y', score: Number(r[8]) || 0,
      s1: Number(r[9]) || 0, s2: Number(r[10]) || 0, s3: Number(r[11]) || 0, secs: Number(r[12]) || 0, errors: Number(r[13]) || 0,
      wrongBy: safe_(r[14]), rulers: safe_(un(r[15])), top: String(r[16] || ''), topText: un(r[17]), topWhy: un(r[18]), mine: un(r[19]), qtype: String(r[20] || ''), qans: String(r[21] || '').split(',').filter(x => x), mates: String(r[22] || '').split(',').map(Number).filter(n => n), ed: String(r[23] || 'li') }));
  const lsh = ss.getSheetByName(NY_LIVE), since = Date.now() - 12 * 3600 * 1000;
  const live = (lsh && lsh.getLastRow() > 1 ? lsh.getRange(2, 1, lsh.getLastRow() - 1, NY_LIVE_HEAD.length).getValues() : [])
    .filter(r => r[1] instanceof Date && r[1].getTime() > since)
    .filter(r => !q.cls || String(r[2]) === String(q.cls))
    .map(r => ({ sid: String(r[0]), t: r[1].getTime(), cls: String(r[2]), seat: Number(r[3]) || 0, role: String(r[4] || ''), lv: Number(r[5]) || 1, status: String(r[6]),
      mates: String(r[7] || '').split(',').map(Number).filter(n => n), ed: String(r[8] || 'li') }));
  return json_({ ok: true, rows: rows, live: live });
}
