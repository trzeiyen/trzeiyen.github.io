/**
 * 穿越清帝國大逃脫 — 教師後台（Google Apps Script）
 * 安裝：
 * 1. 新增一份 Google 試算表 → 擴充功能 → Apps Script，貼上本檔全部內容。
 * 2. 部署 → 新增部署作業 → 類型「網頁應用程式」；執行身分「我」；存取權「所有人」。
 * 3. 把部署後的網址（結尾是 /exec）貼到 index.html 和 teacher.html 最上方的 GAS_URL。
 * 4. 後台密碼不寫在程式裡：請填在試算表「設定」工作表的 B1 儲存格（沒填之前後台讀不到任何成績）。
 */
const SHEET = 'records';
const HEAD = ['時間','sid','班級','座號','解開機關','機關總數','所在關卡','逃脫','總分','通關分','時間分','精準分','用時秒','提示','錯誤','各題錯誤(JSON)','課別','同組座號'];

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
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.game !== 'qing-escape') return json_({ ok: false });
    const cls = String(d.cls || '').replace(/\D/g, '').slice(0, 3);
    const seat = Math.max(0, Math.min(99, parseInt(d.seat, 10) || 0));
    sheet_().appendRow([new Date(), String(d.sid || '').slice(0, 20), cls, seat,
      Number(d.solved) || 0, Number(d.total) || 0, Number(d.room) || 0, d.done ? 'Y' : '',
      Number(d.score) || 0, Number(d.pass) || 0, Number(d.time) || 0, Number(d.acc) || 0,
      Number(d.secs) || 0, Number(d.hints) || 0, Number(d.errors) || 0,
      JSON.stringify(d.wrongBy || {}).slice(0, 2000), Number(d.ch) === 2 ? 2 : 1,
      (Array.isArray(d.mates) ? d.mates : []).slice(0, 2).map(n => Math.max(0, Math.min(99, parseInt(n, 10) || 0))).filter(n => n).join(',')]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  }
}

// 教師端：?key=密碼&cls=501&ch=1（cls、ch 可省略）
function doGet(e) {
  const q = e.parameter || {};
  const k = key_();
  if (!k || q.key !== k) return json_({ ok: false, error: 'key' });
  const rows = sheet_().getDataRange().getValues().slice(1);
  const out = rows
    .filter(r => (!q.cls || String(r[2]) === String(q.cls)) && (!q.ch || String(r[16]) === String(q.ch)))
    .map(r => ({ ts: new Date(r[0]).getTime(), sid: r[1], cls: String(r[2]), seat: Number(r[3]),
      solved: r[4], total: r[5], room: r[6], done: r[7] === 'Y', score: r[8], pass: r[9], time: r[10],
      acc: r[11], secs: r[12], hints: r[13], errors: r[14], wrongBy: safe_(r[15]), ch: Number(r[16]) || 1,
      mates: String(r[17] || '').split(',').map(Number).filter(n => n) }));
  return json_({ ok: true, rows: out });
}
function safe_(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
