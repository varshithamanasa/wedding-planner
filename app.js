(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = 'weddingPlanner.v1';
  const RSVP = { pending: 'Pending', yes: 'Attending', no: 'Declined' };

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const state = Object.assign({ guests: [], event: { schedule: [] } }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach(k => n.append(k));
    return n;
  };

  // ---------- helpers ----------
  const fmtDate = (d, t) => {
    if (!d) return '';
    const dt = new Date(`${d}T${t || '12:00'}`);
    const date = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return t ? `${date} at ${dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : date;
  };
  const dest = e => encodeURIComponent([e.venue, e.address].filter(Boolean).join(', '));
  const googleDirections = e => `https://www.google.com/maps/dir/?api=1&destination=${dest(e)}`;
  const appleDirections = e => `https://maps.apple.com/?daddr=${dest(e)}`;
  const mapEmbed = e => `https://www.google.com/maps?q=${dest(e)}&output=embed`;

  const encode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  const decode = s => JSON.parse(decodeURIComponent(escape(atob(s))));
  const inviteUrl = () => {
    const { couple, date, time, venue, address, notes, dress, contact, schedule } = state.event;
    const payload = { couple, date, time, venue, address, notes, dress, contact, schedule };
    return `${location.origin}${location.pathname}#invite=${encode(payload)}`;
  };

  // ---------- header ----------
  function renderHeader() {
    const e = state.event;
    $('#title').textContent = e.couple || 'Our Wedding';
    $('#subtitle').textContent = [fmtDate(e.date, e.time), e.venue].filter(Boolean).join(' · ');
  }

  // ---------- guests ----------
  function renderGuests() {
    const q = $('#search').value.trim().toLowerCase();
    const f = $('#filter').value;
    const all = state.guests;
    const sum = (arr) => arr.reduce((n, g) => n + (+g.size || 1), 0);
    $('#stats').replaceChildren(
      ...[['Invited', sum(all)], ['Attending', sum(all.filter(g => g.rsvp === 'yes'))],
          ['Declined', sum(all.filter(g => g.rsvp === 'no'))], ['Pending', sum(all.filter(g => g.rsvp === 'pending'))]]
        .map(([label, n]) => el('div', { className: 'stat' }, el('b', { textContent: n }), label))
    );
    const rows = all.filter(g => (f === 'all' || g.rsvp === f) &&
      (!q || [g.name, g.group, g.table, g.email].join(' ').toLowerCase().includes(q)));
    const ul = $('#guestList');
    if (!rows.length) {
      ul.replaceChildren(el('li', { textContent: all.length ? 'No matching guests.' : 'No guests yet. Add your first one.' }));
      return;
    }
    ul.replaceChildren(...rows.map(g => {
      const meta = [g.size > 1 ? `Party of ${g.size}` : '', g.group, g.table && `Table ${g.table}`, g.diet].filter(Boolean).join(' · ');
      const li = el('li', { className: 'clickable' },
        el('div', {}, el('strong', { textContent: g.name }), el('div', { className: 'meta', textContent: meta })),
        el('span', { className: `badge ${g.rsvp}`, textContent: RSVP[g.rsvp] }));
      li.onclick = () => openGuest(g.id);
      return li;
    }));
  }

  const dlg = $('#guestDialog'), gform = $('#guestForm');
  let editing = null;
  function openGuest(id) {
    editing = state.guests.find(g => g.id === id) || null;
    gform.reset();
    $('#dlgTitle').textContent = editing ? 'Edit guest' : 'Add guest';
    $('#deleteGuest').hidden = !editing;
    if (editing) for (const [k, v] of Object.entries(editing)) if (gform.elements[k]) gform.elements[k].value = v;
    dlg.showModal();
  }
  gform.addEventListener('submit', ev => {
    if (ev.submitter?.value !== 'save') return;
    const d = Object.fromEntries(new FormData(gform));
    d.size = Math.max(1, parseInt(d.size, 10) || 1);
    if (editing) Object.assign(editing, d); else state.guests.push({ id: uid(), ...d });
    save(); renderGuests(); renderShareList();
  });
  $('#deleteGuest').onclick = () => {
    if (editing && confirm(`Delete ${editing.name}?`)) {
      state.guests = state.guests.filter(g => g !== editing);
      save(); dlg.close(); renderGuests(); renderShareList();
    }
  };
  $('#addGuest').onclick = () => openGuest(null);
  $('#search').oninput = $('#filter').onchange = renderGuests;

  // CSV
  const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const COLS = ['name', 'size', 'rsvp', 'email', 'phone', 'group', 'table', 'diet'];
  $('#exportCsv').onclick = () => {
    const text = [COLS.join(','), ...state.guests.map(g => COLS.map(c => csvCell(g[c])).join(','))].join('\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: 'guests.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };
  const parseCsv = text => {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  };
  $('#importCsv').onclick = () => $('#csvFile').click();
  $('#csvFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const [head, ...rows] = parseCsv(await file.text());
    const idx = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), i]));
    if (idx.name === undefined) return alert('The CSV needs a "name" column.');
    for (const r of rows) {
      const g = { id: uid() };
      COLS.forEach(c => g[c] = idx[c] !== undefined ? (r[idx[c]] || '').trim() : '');
      g.size = Math.max(1, parseInt(g.size, 10) || 1);
      if (!RSVP[g.rsvp]) g.rsvp = 'pending';
      if (g.name) state.guests.push(g);
    }
    e.target.value = ''; save(); renderGuests(); renderShareList();
  };

  // ---------- event ----------
  const eform = $('#eventForm');
  function renderSchedule() {
    const box = $('#schedule');
    box.replaceChildren(...state.event.schedule.map((it, i) => {
      const t = el('input', { type: 'time', value: it.time || '' });
      const w = el('input', { value: it.what || '', placeholder: 'Ceremony' });
      const x = el('button', { type: 'button', textContent: 'Remove' });
      t.oninput = () => it.time = t.value;
      w.oninput = () => it.what = w.value;
      x.onclick = () => { state.event.schedule.splice(i, 1); renderSchedule(); };
      return el('div', { className: 'sched' }, t, w, x);
    }));
  }
  $('#addItem').onclick = () => { state.event.schedule.push({ time: '', what: '' }); renderSchedule(); };

  function renderEventForm() {
    for (const [k, v] of Object.entries(state.event)) if (eform.elements[k] && typeof v === 'string') eform.elements[k].value = v;
    renderSchedule(); renderMap();
  }
  function renderMap() {
    const e = state.event;
    $('#mapBox').replaceChildren(e.address || e.venue ? el('div', {},
      el('div', { className: 'btns' },
        el('a', { className: 'primary', href: googleDirections(e), target: '_blank', rel: 'noopener', textContent: 'Directions in Google Maps' }),
        el('a', { href: appleDirections(e), target: '_blank', rel: 'noopener', textContent: 'Apple Maps' })),
      el('iframe', { src: mapEmbed(e), title: 'Venue map', loading: 'lazy' })) : '');
  }
  eform.addEventListener('submit', ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(eform));
    state.event = { ...state.event, ...d, schedule: state.event.schedule.filter(s => s.what || s.time) };
    save(); renderHeader(); renderMap(); renderSchedule(); renderShare();
    $('#saved').textContent = 'Saved';
    setTimeout(() => $('#saved').textContent = '', 2000);
  });

  // ---------- share ----------
  const shareText = () => `You're invited${state.event.couple ? ' to ' + state.event.couple + "'s wedding" : ''}! Details and directions: ${inviteUrl()}`;
  function renderShare() { $('#shareLink').value = inviteUrl(); }
  function renderShareList() {
    const ul = $('#shareList');
    const text = encodeURIComponent(shareText());
    ul.replaceChildren(...state.guests.map(g => el('li', {},
      el('span', { textContent: g.name }),
      el('span', { className: 'row' },
        g.phone ? el('a', { href: `sms:${g.phone}?&body=${text}`, textContent: 'Text' }) : '',
        g.email ? el('a', { href: `mailto:${g.email}?subject=${encodeURIComponent('Wedding details')}&body=${text}`, textContent: 'Email' }) : ''))));
  }
  $('#copyLink').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteUrl()); $('#copyLink').textContent = 'Copied'; }
    catch { $('#shareLink').select(); }
    setTimeout(() => $('#copyLink').textContent = 'Copy link', 1500);
  };
  $('#nativeShare').onclick = () => navigator.share
    ? navigator.share({ title: 'Wedding details', text: shareText() }).catch(() => {})
    : $('#copyLink').click();
  $('#previewLink').onclick = () => window.open(inviteUrl(), '_blank');
  $('#emailAll').onclick = () => {
    const to = state.guests.map(g => g.email).filter(Boolean).join(',');
    if (!to) return alert('No guests have an email address yet.');
    location.href = `mailto:?bcc=${encodeURIComponent(to)}&subject=${encodeURIComponent('Wedding details')}&body=${encodeURIComponent(shareText())}`;
  };

  // ---------- tabs ----------
  $('#tabs').onclick = e => {
    const t = e.target.dataset.tab; if (!t) return;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === e.target));
    ['guests', 'event', 'share'].forEach(n => $(`#tab-${n}`).hidden = n !== t);
    if (t === 'share') { renderShare(); renderShareList(); }
  };

  // ---------- guest-facing invite ----------
  function showInvite(e) {
    document.title = e.couple ? `${e.couple}: Wedding details` : 'Wedding details';
    $('#tabs').hidden = true;
    document.querySelector('main').hidden = true;
    $('#title').textContent = e.couple || 'You are invited';
    $('#subtitle').textContent = fmtDate(e.date, e.time);
    const inv = $('#invite'); inv.hidden = false;
    const sched = (e.schedule || []).map(s => {
      const t = s.time ? new Date(`2000-01-01T${s.time}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
      return el('li', {}, el('strong', { textContent: t }), ` ${s.what || ''}`);
    });
    const reply = e.contact && (e.contact.includes('@')
      ? el('a', { className: 'primary', href: `mailto:${e.contact}?subject=${encodeURIComponent('RSVP')}`, textContent: 'RSVP by email' })
      : el('a', { className: 'primary', href: `sms:${e.contact}`, textContent: 'RSVP by text' }));
    inv.replaceChildren(el('div', { className: 'invite-card' },
      el('h2', { textContent: e.venue || 'Venue' }),
      el('p', { textContent: e.address || '' }),
      e.dress ? el('p', {}, el('strong', { textContent: 'Dress code: ' }), e.dress) : '',
      sched.length ? el('ul', {}, sched) : '',
      e.notes ? el('p', { textContent: e.notes }) : '',
      el('div', { className: 'btns' },
        e.venue || e.address ? el('a', { className: 'primary', href: googleDirections(e), target: '_blank', rel: 'noopener', textContent: 'Get directions' }) : '',
        e.venue || e.address ? el('a', { href: appleDirections(e), target: '_blank', rel: 'noopener', textContent: 'Apple Maps' }) : '',
        reply || ''),
      e.venue || e.address ? el('iframe', { src: mapEmbed(e), title: 'Venue map', loading: 'lazy' }) : ''));
  }

  // ---------- boot ----------
  const m = location.hash.match(/^#invite=(.+)$/);
  if (m) {
    try { showInvite(decode(m[1])); } catch { document.body.textContent = 'This invite link looks broken.'; }
  } else {
    renderHeader(); renderGuests(); renderEventForm();
  }
})();
