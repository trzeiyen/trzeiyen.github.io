/**
 * 經濟時光機大逃脫｜Apps Script 後台
 *
 * 用法：
 * 1. 新增一份 Google 試算表 →「擴充功能」→「Apps Script」，把這整段貼上（取代原本內容）。
 * 2. 把下面的 TEACHER_KEY 改成你自己的後台密碼。
 * 3. 「部署」→「新增部署作業」→ 類型選「網頁應用程式」，
 *    執行身分：我；誰可以存取：所有人 → 部署（第一次會要求授權，按允許）。
 * 4. 複製網址（…/exec），貼到 index.html 和 teacher.html 的 GAS_URL。
 */

const TEACHER_KEY = '請改成你的後台密碼';
const SHEET_NAME = '成績';
const ROOM_COUNT = 9;
const HEADER = ['時間', '班級', '座號', '第幾次挑戰', '用時(秒)', '用時', '提示次數', '答錯次數',
  '稱號', '立場', '理由', '各關答錯', '各關提示', '各關用時(秒)', '狀態', '完成關數', '完成題數', '同組座號'];
const STATUS = ['逃脫成功', '提早交卷', '老師收卷'];
const COLLECT_TTL = 15 * 60 * 1000; // 收卷指令 15 分鐘內有效
const LIVE_SHEET = '即時';           // 學生一開始作答就會出現在這裡
const LIVE_HEADER = ['sid', '最後更新', '班級', '座號', '同組座號', '完成題數', '目前關卡', '狀態'];

function liveSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LIVE_SHEET);
  if (!sh) { sh = ss.insertSheet(LIVE_SHEET); sh.appendRow(LIVE_HEADER); sh.setFrozenRows(1); }
  return sh;
}
// 依 sid（每次挑戰一個）更新或新增一列
function liveUpsert_(d, cls, seat, mates, status) {
  const sid = String(d.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (!sid) return;
  const sh = liveSheet_(), n = sh.getLastRow();
  const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  let row = -1;
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === sid) { row = i + 2; break; }
  const vals = [sid, new Date(), cls, seat, mates, int_(d.solved, 0, 999) || 0, int_(d.room, 1, ROOM_COUNT) || 1, status];
  if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  // 舊版試算表補上新的欄位標題
  if (sh.getLastColumn() < HEADER.length) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 避免學生輸入的文字被試算表當成公式
function safeText_(v, max) {
  let t = String(v == null ? '' : v).slice(0, max || 300);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}
function int_(v, lo, hi) {
  const n = Math.round(Number(v));
  if (!isFinite(n) || n < lo || n > hi) return null;
  return n;
}
function list_(v) {
  const a = String(v || '').split(',').map(x => int_(x, 0, 99999));
  if (a.length !== ROOM_COUNT || a.some(x => x === null)) return '';
  return a.join('|'); // 用 | 分隔，避免試算表把 100,120 當成千分位數字
}
function fmt_(sec) {
  return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
}

// 學生送成績
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
    const cls = String(d.cls || '');
    const seat = int_(d.seat, 1, 40);
    // 多人共用一台平板：第 2、3 位座號（用 | 分隔，避免被當成數字）
    const mates = (Array.isArray(d.mates) ? d.mates : []).slice(0, 2).map(n => int_(n, 1, 40))
      .filter((n, i, a) => n !== null && n !== seat && a.indexOf(n) === i).join('|');
    // 即時回報：學生按「出發」後每解一題、或每隔一段時間送一次
    if (d.type === 'live') {
      if (!/^[1-6]\d{2}$/.test(cls) || seat === null) return json_({ ok: false, error: 'invalid' });
      liveUpsert_(d, cls, seat, mates, '作答中');
      return json_({ ok: true });
    }
    const sec = int_(d.seconds, 0, 6 * 3600);
    if (!/^[1-6]\d{2}$/.test(cls) || seat === null || sec === null) {
      return json_({ ok: false, error: 'invalid' });
    }
    getSheet_().appendRow([
      new Date(), cls, seat, int_(d.attempt, 1, 999) || 1, sec, fmt_(sec),
      int_(d.hints, 0, 999) || 0, int_(d.errors, 0, 9999) || 0,
      safeText_(d.title, 20), safeText_(d.stance, 20), safeText_(d.reason, 300),
      list_(d.roomErr), list_(d.roomHint), list_(d.roomTime),
      STATUS.indexOf(d.status) >= 0 ? d.status : '逃脫成功',
      int_(d.reached, 0, ROOM_COUNT) === null ? ROOM_COUNT : int_(d.reached, 0, ROOM_COUNT),
      int_(d.solved, 0, 999) === null ? '' : int_(d.solved, 0, 999),
      mates
    ]);
    liveUpsert_(d, cls, seat, mates, STATUS.indexOf(d.status) >= 0 ? d.status : '逃脫成功');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// 老師後台讀成績（需要密碼）
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true });
  const props = PropertiesService.getScriptProperties();
  // 學生平板詢問：老師有沒有對這班按「全班收卷」
  if (p.action === 'status') {
    if (!/^[1-6]\d{2}$/.test(String(p.cls || ''))) return json_({ ok: false });
    const t = Number(props.getProperty('collect_' + p.cls) || 0);
    return json_({ ok: true, collect: (Date.now() - t < COLLECT_TTL) ? t : 0 });
  }
  if (p.key !== TEACHER_KEY) return json_({ ok: false, error: 'key' });
  // 老師按「全班收卷」
  if (p.action === 'collect') {
    if (!/^[1-6]\d{2}$/.test(String(p.cls || ''))) return json_({ ok: false, error: 'cls' });
    const now = Date.now();
    props.setProperty('collect_' + p.cls, String(now));
    return json_({ ok: true, collect: now });
  }
  const sh = getSheet_();
  const values = sh.getDataRange().getValues().slice(1);
  const rows = values.map(r => ({
    time: r[0] instanceof Date ? r[0].getTime() : r[0],
    cls: String(r[1]), seat: Number(r[2]), attempt: Number(r[3]),
    seconds: Number(r[4]), hints: Number(r[6]), errors: Number(r[7]),
    title: String(r[8]), stance: String(r[9]), reason: String(r[10]).replace(/^'/, ''),
    roomErr: String(r[11]).replace(/\|/g, ','), roomHint: String(r[12]).replace(/\|/g, ','),
    roomTime: String(r[13]).replace(/\|/g, ','),
    status: String(r[14] || '逃脫成功'),
    reached: r[15] === '' || r[15] == null ? ROOM_COUNT : Number(r[15]),
    solved: r[16] === '' || r[16] == null ? null : Number(r[16]),
    mates: String(r[17] == null ? '' : r[17]).split('|').map(Number).filter(n => n)
  }));
  // 即時作答名單（只回傳 12 小時內有更新的）
  const lsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIVE_SHEET);
  const since = Date.now() - 12 * 3600 * 1000;
  const live = (lsh && lsh.getLastRow() > 1 ? lsh.getRange(2, 1, lsh.getLastRow() - 1, 8).getValues() : [])
    .filter(r => r[1] instanceof Date && r[1].getTime() > since)
    .map(r => ({ sid: String(r[0]), t: r[1].getTime(), cls: String(r[2]), seat: Number(r[3]),
      mates: String(r[4] == null ? '' : r[4]).split('|').map(Number).filter(n => n),
      solved: Number(r[5]) || 0, room: Number(r[6]) || 1, status: String(r[7]) }));
  return json_({ ok: true, rows: rows, live: live });
}
