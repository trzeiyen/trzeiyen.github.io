/**
 * 十大建設：蓋出臺灣地圖｜平板連線中繼站 + 成績紀錄
 * 部署：部署 → 新增部署作業 → 網頁應用程式
 *       執行身分：我　／　誰可以存取：所有人
 * 第一次執行會自動建立試算表「十大建設大螢幕遊戲紀錄」。
 */
const ROOM_TTL = 21600; // 房間資料保留 6 小時
const HEAD_GAME = ['時間', '班級', '模式', '連線方式', '組數', '各組分數', '各組建設數', '冠軍', '用時(秒)', '全班答對題數', '全班作答題數'];
const HEAD_Q = ['時間', '班級', '類型', '建設', '題目', '正確答案', '作答組數', '答對組數', '最快答對', '最快秒數', '各組作答'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    return out_(handle_(p));
  } catch (err) {
    return out_({ ok: false, err: String(err) });
  }
}

function handle_(p) {
  const a = p.a;
  if (a === 'ping') return { ok: true, now: Date.now() };
  const r = String(p.r || '').replace(/\D/g, '').slice(0, 4);
  if (r.length !== 4) return { ok: false, err: 'room' };
  const K = 'room_' + r;

  if (a === 'open') {
    return withLock_(() => {
      put_(K, { cls: p.cls || '', teams: JSON.parse(p.teams || '[]'), st: { phase: 'lobby', seq: 0 } });
      put_(K + '_ans', { seq: 0, t0: 0, by: {} });
      put_(K + '_join', {});
      remove_(K + '_pick');
      return { ok: true, now: Date.now() };
    });
  }

  const room = get_(K);
  if (!room) return { ok: false, err: 'noroom' };

  // ---- 大螢幕 ----
  if (a === 'state') {
    return withLock_(() => {
      const st = JSON.parse(p.st || '{}');
      const now = Date.now();
      room.st = st;
      put_(K, room);
      if (p.reset === '1') {
        put_(K + '_ans', { seq: st.seq || 0, t0: now, by: {} });
        remove_(K + '_pick');
      }
      return { ok: true, now: now };
    });
  }
  if (a === 'hpoll') {
    return { ok: true, now: Date.now(), ans: get_(K + '_ans') || {}, join: get_(K + '_join') || {}, pick: get_(K + '_pick') };
  }
  if (a === 'log') {
    log_(p.kind, JSON.parse(p.d || '{}'));
    return { ok: true };
  }

  if (a === 'info') return { ok: true, cls: room.cls, teams: room.teams };

  // ---- 平板 ----
  const tm = parseInt(p.tm, 10);
  if (!(tm >= 0 && tm < room.teams.length)) return { ok: false, err: 'team' };

  if (a === 'join' || a === 'tpoll') {
    const now = Date.now();
    const j = get_(K + '_join') || {};
    if (a === 'join' || !j[tm] || now - j[tm] > 6000) {
      withLock_(() => { const jj = get_(K + '_join') || {}; jj[tm] = now; put_(K + '_join', jj); });
    }
    const ans = get_(K + '_ans') || {};
    const mine = ans.seq === room.st.seq && ans.by ? (ans.by[tm] || null) : null;
    return { ok: true, now: now, cls: room.cls, teams: room.teams, st: room.st, t0: ans.t0 || 0, mine: mine };
  }
  if (a === 'ans') {
    return withLock_(() => {
      const st = room.st, seq = parseInt(p.seq, 10), c = parseInt(p.c, 10);
      if (st.phase !== 'q' || st.seq !== seq) return { ok: false, err: 'closed' };
      if (st.only !== null && st.only !== undefined && st.only !== tm) return { ok: false, err: 'notyou' };
      const ans = get_(K + '_ans') || { seq: seq, t0: Date.now(), by: {} };
      if (ans.seq !== seq) return { ok: false, err: 'closed' };
      if (ans.by[tm]) return { ok: true, dup: true, mine: ans.by[tm] };
      ans.by[tm] = { c: c, t: Date.now() };
      put_(K + '_ans', ans);
      return { ok: true, mine: ans.by[tm] };
    });
  }
  if (a === 'pick') {
    return withLock_(() => {
      const st = room.st;
      if (st.phase !== 'pick' || st.turn !== tm) return { ok: false, err: 'notyou' };
      put_(K + '_pick', { seq: st.seq, site: String(p.site || '') });
      return { ok: true };
    });
  }
  return { ok: false, err: 'action' };
}

// ---- 試算表紀錄 ----
function book_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) ss = SpreadsheetApp.create('十大建設大螢幕遊戲紀錄');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheet_(name, head) {
  const ss = book_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function log_(kind, d) {
  const now = new Date();
  if (kind === 'game') {
    const sh = sheet_('場次紀錄', HEAD_GAME);
    const teams = d.teams || [];
    const top = teams.slice().sort((x, y) => y.score - x.score)[0] || {};
    sh.appendRow([now, "'" + (d.cls || ''), d.mode, d.link, teams.length,
      teams.map(t => t.name + ':' + t.score).join(' | '), teams.map(t => t.name + ':' + t.sites).join(' | '),
      top.name || '', d.used, d.right, d.tries]);
  } else if (kind === 'q') {
    const sh = sheet_('題目紀錄', HEAD_Q);
    sh.appendRow([now, "'" + (d.cls || ''), d.kind, d.site, d.q, d.correct, d.n, d.ok, d.fast || '', d.sec === undefined ? '' : d.sec, d.detail || '']);
  }
}

// ---- 共用 ----
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function get_(k) { const v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; }
function put_(k, o) { CacheService.getScriptCache().put(k, JSON.stringify(o), ROOM_TTL); }
function remove_(k) { CacheService.getScriptCache().remove(k); }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try { return fn(); } finally { lock.releaseLock(); }
}
/** 在編輯器按「執行」一次，授權並建立試算表 */
function setup() {
  const ss = book_();
  sheet_('場次紀錄', HEAD_GAME); sheet_('題目紀錄', HEAD_Q);
  const def = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log(ss.getUrl());
}
