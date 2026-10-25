/**
 * 開場小調查｜Apps Script 後台
 * 用法：在 Google 試算表 →「擴充功能」→「Apps Script」，把這整段貼上，
 *       再「部署」→「新增部署作業」→ 類型選「網頁應用程式」，
 *       執行身分：我；誰可以存取：所有人 → 部署，複製網址貼到 index.html 的 GAS_URL。
 */

// 允許的選項（要和 index.html 的題目一致；不在清單裡的值會被丟掉，避免亂填弄亂圖表）
const OPTIONS = {
  role:   ['導師','科任','行政','其他'],
  stage:  ['國小低年級','國小中年級','國小高年級','國中','其他'],
  tools:  ['Gemini','ChatGPT','Claude','其他','都沒在用'],
  paid:   ['有，自己付費','學校有提供','沒有'],
  wave:   ['衝浪板上','載浮載沉','岸邊觀浪'],
  made:   ['沒有','試過但沒成功','做過'],
  device: ['電腦','平板','手機'],
  gemini: ['可以','不確定','不行'],
  want:   ['做出一份自己的教材','看別人怎麼用','知道怎麼看見學習','了解 AI 怎麼用才對']
};
const FIELDS = Object.keys(OPTIONS);
const SHEET_NAME = '填答';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['時間'].concat(FIELDS));
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 收填答
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse(e.postData.contents || '{}');
    const row = [new Date()];
    FIELDS.forEach(f => {
      const vals = [].concat(d[f] || []).filter(v => OPTIONS[f].indexOf(v) !== -1);
      row.push(vals.join('|'));
    });
    if (row.slice(1).every(v => v === '')) return json_({ ok: false, error: 'empty' });
    getSheet_().appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// 回傳統計（快取 4 秒，很多人同時看結果也不會塞住）
function doGet(e) {
  const cache = CacheService.getScriptCache();
  let s = cache.get('stats');
  if (!s) {
    s = JSON.stringify(buildStats_());
    cache.put('stats', s, 4);
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function buildStats_() {
  const sh = getSheet_();
  const last = sh.getLastRow();
  const counts = {};
  FIELDS.forEach(f => { counts[f] = {}; OPTIONS[f].forEach(o => counts[f][o] = 0); });
  if (last < 2) return { total: 0, counts: counts };
  const rows = sh.getRange(2, 2, last - 1, FIELDS.length).getValues();
  rows.forEach(r => {
    FIELDS.forEach((f, i) => {
      String(r[i] || '').split('|').forEach(v => {
        if (v && counts[f][v] !== undefined) counts[f][v]++;
      });
    });
  });
  return { total: rows.length, counts: counts, updated: new Date().toISOString() };
}

// 研習結束後想清空重來：在編輯器選這個函式按「執行」
function resetAll() {
  const sh = getSheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  CacheService.getScriptCache().remove('stats');
}
