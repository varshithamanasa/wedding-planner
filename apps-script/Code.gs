// Wedding RSVP backend. Paste into Extensions > Apps Script in a Google Sheet.
// Guests can only read and answer their own row (by secret token).
// Everything else needs ADMIN_KEY. Set it to a long random string before deploying.
const ADMIN_KEY = 'CHANGE-ME-to-a-long-random-string';

const SHEET = 'Guests';
const COLS = ['token', 'name', 'size', 'rsvp', 'count', 'plusOne', 'diet', 'email', 'phone', 'group', 'table', 'respondedAt'];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) { s = ss.insertSheet(SHEET); s.appendRow(COLS); s.setFrozenRows(1); }
  return s;
}
function rows_() {
  const v = sheet_().getDataRange().getValues();
  const head = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; head.forEach((k, j) => o[k] = r[j]); return o; });
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
// Stops text from a public form being run as a spreadsheet formula.
function clean_(v) {
  v = String(v == null ? '' : v).slice(0, 200);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function set_(row, col, val) { sheet_().getRange(row, COLS.indexOf(col) + 1).setValue(val); }
function isAdmin_(k) { return ADMIN_KEY !== 'CHANGE-ME-to-a-long-random-string' && k === ADMIN_KEY; }

function doGet(e) {
  const p = e.parameter || {};
  if (p.action === 'guest' && p.token) {
    const g = rows_().find(r => r.token === p.token);
    if (!g) return json_({ error: 'not_found' });
    return json_({ name: g.name, size: g.size, rsvp: g.rsvp, count: g.count, plusOne: g.plusOne, diet: g.diet });
  }
  if (p.action === 'all' && isAdmin_(p.key)) {
    return json_({ guests: rows_().map(r => { delete r._row; return r; }) });
  }
  return json_({ error: 'bad_request' });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'bad_json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = rows_();
    if (b.action === 'respond') {
      const g = rows.find(r => r.token === b.token);
      if (!g) return json_({ error: 'not_found' });
      set_(g._row, 'rsvp', b.rsvp === 'yes' ? 'yes' : 'no');
      set_(g._row, 'count', b.rsvp === 'yes' ? Math.min(Math.max(1, parseInt(b.count, 10) || 1), Math.max(1, parseInt(g.size, 10) || 1)) : 0);
      set_(g._row, 'plusOne', clean_(b.plusOne));
      set_(g._row, 'diet', clean_(b.diet));
      set_(g._row, 'respondedAt', new Date());
      return json_({ ok: true });
    }
    if (b.action === 'open') {
      // Reply from the general link: always adds a new row, never edits an existing guest.
      const name = clean_(b.name).trim();
      if (b.hp || !name || rows.length >= 2000) return json_({ error: 'rejected' });
      const yes = b.rsvp === 'yes';
      const count = yes ? Math.min(Math.max(1, parseInt(b.count, 10) || 1), 10) : 0;
      sheet_().appendRow([Utilities.getUuid().replace(/-/g, '').slice(0, 24), name, count || 1, yes ? 'yes' : 'no', count,
        clean_(b.plusOne), clean_(b.diet), '', '', 'Website RSVP', '', new Date()]);
      return json_({ ok: true });
    }
    if (!isAdmin_(b.key)) return json_({ error: 'forbidden' });
    if (b.action === 'sync') {
      (b.guests || []).forEach(g => {
        const ex = rows.find(r => r.token === g.token);
        if (ex) {
          ['name', 'size', 'email', 'phone', 'group', 'table'].forEach(c => set_(ex._row, c, clean_(g[c])));
          if (g.override) ['rsvp', 'count', 'plusOne', 'diet'].forEach(c => set_(ex._row, c, clean_(g[c])));
        } else {
          sheet_().appendRow(COLS.map(c => c === 'respondedAt' ? '' : clean_(c === 'rsvp' ? (g.rsvp || 'pending') : g[c])));
        }
      });
      return json_({ ok: true });
    }
    if (b.action === 'remove') {
      const g = rows.find(r => r.token === b.token);
      if (g) sheet_().deleteRow(g._row);
      return json_({ ok: true });
    }
    return json_({ error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}
