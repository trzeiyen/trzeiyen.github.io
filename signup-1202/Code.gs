/**
 * 校內研習報名｜Apps Script 後台
 * 用法：
 *   1. 開一份新的 Google 試算表 →「擴充功能」→「Apps Script」，把這整段貼上、存檔。
 *   2.「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *      執行身分：我；誰可以存取：所有人 → 部署（第一次會要求授權，按允許）。
 *   3. 複製網址（https://script.google.com/macros/s/…/exec），貼到 index.html 的 GAS_URL。
 * 報名名單就在試算表的「報名」分頁；狀態欄會寫「已報名」或「已取消」。
 */

const CAP = 30;                 // 名額
const SHEET_NAME = '報名';
const HEAD = ['報名時間', '姓名', '身分', '班級或處室', '備註', '狀態', '取消時間', '代碼'];
const ROLES = ['導師', '科任', '行政', '其他'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEAD.length).getValues()
    .map((r, i) => ({ row: i + 2, name: String(r[1]).trim(), status: r[5], token: r[7] }));
}

function active_() { return rows_().filter(r => r.status === '已報名'); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) { return String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }

// 查名額（可帶 ?token= 查自己的報名狀態；不回傳任何人的名字）
function doGet(e) {
  const act = active_();
  const out = { cap: CAP, count: act.length };
  const t = e && e.parameter && e.parameter.token;
  if (t) out.mine = act.some(r => r.token === t) ? 'active' : 'none';
  return json_(out);
}

// 報名 / 取消
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
    const sh = sheet_();

    if (d.action === 'cancel') {
      const r = rows_().find(x => x.token && x.token === d.token && x.status === '已報名');
      if (!r) return json_({ ok: false, error: 'notfound', count: active_().length, cap: CAP });
      sh.getRange(r.row, 6, 1, 2).setValues([['已取消', new Date()]]);
      return json_({ ok: true, count: active_().length, cap: CAP });
    }

    // 報名
    const name = clean_(d.name, 20);
    const role = ROLES.indexOf(d.role) !== -1 ? d.role : '';
    const unit = clean_(d.unit, 30);
    const note = clean_(d.note, 100);
    if (!name || !role || !unit) return json_({ ok: false, error: 'missing' });

    const act = active_();
    if (act.some(r => r.name === name)) return json_({ ok: false, error: 'dup', count: act.length, cap: CAP });
    if (act.length >= CAP) return json_({ ok: false, error: 'full', count: act.length, cap: CAP });

    const token = Utilities.getUuid();
    sh.appendRow([new Date(), name, role, unit, note, '已報名', '', token]);
    return json_({ ok: true, token: token, count: act.length + 1, cap: CAP });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
