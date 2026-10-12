// Guest-facing wedding site. window.renderSite(event, token) fills #invite.
(() => {
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const enc = encodeURIComponent;
  const join = (...a) => a.filter(Boolean).join(', ');
  const dirUrl = q => `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}`;
  const clock = t => new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const initials = c => (c || '').split(/\s*(?:&|\band\b)\s*/i).map(s => s.trim()[0]).filter(Boolean).join(' & ').toUpperCase();
  const pad = n => String(n).padStart(2, '0');

  window.renderSite = function (e, token) {
    const when = e.date ? new Date(`${e.date}T${e.time || '12:00'}`) : null;
    const dateLine = when
      ? when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
        (e.time ? ` · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '')
      : '';
    const root = $('#invite');

    // ---- hero ----
    const title = el('h1', { 'aria-label': e.couple || 'Our wedding' });
    [...(e.couple || 'You are invited')].forEach((ch, i) => {
      const s = el('span', { textContent: ch === ' ' ? ' ' : ch, 'aria-hidden': 'true' });
      s.style.animationDelay = `${i * 45}ms`;
      title.append(s);
    });
    const hero = el('section', { className: 'hero' },
      title,
      el('div', { className: 'orn', 'aria-hidden': 'true' }, el('i')),
      el('p', { className: 'kicker', textContent: 'Are getting married' }),
      dateLine ? el('p', { className: 'lead', textContent: dateLine }) : '',
      e.venue ? el('p', { className: 'lead', textContent: e.venue }) : '');

    // ---- schedule ----
    const items = (e.schedule || []).filter(s => s.what);
    const expect = items.length ? el('section', { className: 'expect', id: 'schedule' },
      el('h2', { textContent: 'What to Expect' }),
      el('ul', { className: 'timeline' }, items.map(s => el('li', {},
        s.time ? el('span', { className: 'time', textContent: clock(s.time) }) : '',
        el('span', { className: 'what', textContent: s.what }))))) : '';

    // ---- countdown, venues, closing ----
    const units = [['Days', 86400, 1e9], ['Hours', 3600, 24], ['Min', 60, 60], ['Sec', 1, 60]];
    const nums = units.map(() => el('span', { className: 'num', textContent: '00' }));
    const tick = () => {
      if (!when) return;
      const diff = Math.max(0, Math.floor((when - Date.now()) / 1000));
      units.forEach(([, secs, mod], i) => { nums[i].textContent = pad(Math.floor(diff / secs) % mod); });
    };
    const places = [['Ceremony', e.venue, e.address], ['Reception', e.rVenue, e.rAddress]].filter(p => p[1] || p[2]);
    const find = places.length ? el('div', { className: 'find' }, places.map(([label, name, addr]) => el('div', {},
      el('p', { className: 'label', textContent: label }),
      el('p', { className: 'serif', textContent: name || addr }),
      name && addr ? el('p', { className: 'small', textContent: addr }) : '',
      el('a', { href: dirUrl(join(name, addr)), target: '_blank', rel: 'noopener', textContent: 'Get directions' })))) : '';
    const mapQ = e.venue || e.address ? enc(join(e.venue, e.address)) : '';
    const cream = el('section', { className: 'cream', id: 'details' },
      when ? el('div', { className: 'count', role: 'timer', 'aria-label': 'Countdown to the wedding' },
        units.map(([label], i) => el('div', {}, nums[i], el('span', { className: 'label', textContent: label })))) : '',
      el('p', { className: 'closing', textContent: e.welcome || "Can't wait to celebrate with you" }),
      e.dress ? el('p', { className: 'small' }, el('span', { className: 'label', textContent: 'Dress code ' }), e.dress) : '',
      e.notes ? el('p', { className: 'small', textContent: e.notes }) : '',
      find,
      mapQ ? el('iframe', { src: `https://www.google.com/maps?q=${mapQ}&output=embed`, title: 'Map', loading: 'lazy' }) : '',
      el('footer', {}, el('span', { textContent: `© ${when ? when.getFullYear() : new Date().getFullYear()} ${e.couple || ''}` })));

    // ---- nav and RSVP drawer ----
    const nav = el('nav', { className: 'sitenav' },
      el('span', { className: 'serif', textContent: initials(e.couple) }),
      el('div', {}, items.length ? el('a', { href: '#schedule', textContent: 'Schedule' }) : '',
        el('a', { href: '#rsvp-panel', textContent: 'RSVP', onclick: ev => { ev.preventDefault(); setOpen(true); } })));
    const label = el('span', { textContent: 'RSVP' });
    const pill = el('button', { type: 'button', className: 'pill', 'aria-expanded': 'false', 'aria-controls': 'rsvp-panel' }, label, el('i'));
    const panel = rsvpPanel(e, token, dateLine);
    const drawer = el('div', { className: 'drawer' }, pill, panel);
    function setOpen(o) {
      drawer.classList.toggle('open', o);
      pill.setAttribute('aria-expanded', String(o));
      panel.inert = !o;
    }
    setOpen(false);
    pill.onclick = () => setOpen(!drawer.classList.contains('open'));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') setOpen(false); });

    root.replaceChildren(el('div', { className: 'bg', 'aria-hidden': 'true' }), nav, hero, expect, el('div', { className: 'border-band', 'aria-hidden': 'true' }), cream, drawer);

    // nav turns dark over the cream section; the pill label follows scroll position
    const onScroll = () => {
      const c = cream.getBoundingClientRect().top;
      nav.classList.toggle('dark', c < 48);
      const f = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
      label.textContent = f < 0.3 ? 'RSVP' : f < 0.8 ? 'Join us' : 'Be there ♡';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll(); tick(); setInterval(tick, 1000);
  };

  // ---------- RSVP form ----------
  function rsvpPanel(e, token, dateLine) {
    const panel = el('div', { className: 'sheet', id: 'rsvp-panel' });
    const inner = el('div', { className: 'sheet-in' });
    panel.append(inner);
    const head = [
      el('h3', { textContent: 'Will you be there?' }),
      el('p', { className: 'small', textContent: join(e.couple && `${e.couple} are getting married`, dateLine) }),
      e.respondBy ? el('p', { className: 'small', textContent: `Please reply by ${new Date(`${e.respondBy}T12:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.` }) : ''];

    if (!e.scriptUrl) {
      // No online RSVP set up: fall back to the couple's contact.
      const c = e.contact || '';
      inner.append(...head, c ? el('a', { className: 'send', href: c.includes('@') ? `mailto:${c}?subject=RSVP` : `sms:${c}`, textContent: 'RSVP to the couple' }) : '');
      return panel;
    }

    inner.append(...head, el('p', { className: 'small', textContent: 'Loading...' }));
    const build = g => {
      let choice = g && (g.rsvp === 'yes' || g.rsvp === 'no') ? g.rsvp : '';
      const max = g ? Math.max(1, parseInt(g.size, 10) || 1) : 10;
      const name = el('input', { value: g ? g.name : '', readOnly: !!g, maxLength: 100, placeholder: 'Your name', autocomplete: 'name' });
      const count = el('select', {}, Array.from({ length: max }, (_, i) => el('option', { value: i + 1, textContent: i + 1 })));
      count.value = String(Math.min(max, Math.max(1, parseInt(g && g.count, 10) || (g ? max : 1))));
      const others = el('input', { value: g ? g.plusOne || '' : '', maxLength: 100, placeholder: 'Name(s) of your guest(s)' });
      const diet = el('input', { value: g ? g.diet || '' : '', maxLength: 100, placeholder: 'Dietary needs (optional)' });
      const hp = el('input', { className: 'hp', tabIndex: -1, autocomplete: 'off', 'aria-hidden': 'true' });
      const yes = el('button', { type: 'button', textContent: 'Joyfully accept' });
      const no = el('button', { type: 'button', textContent: 'Regretfully decline' });
      const send = el('button', { type: 'button', className: 'send', textContent: 'Send RSVP' });
      const msg = el('p', { className: 'small', role: 'status' });
      const field = (label, input) => el('label', {}, el('span', { className: 'label', textContent: label }), input);
      const countF = field('Number of guests', count), othersF = field('Guests', others), dietF = field('Notes', diet);
      const paint = () => {
        yes.classList.toggle('on', choice === 'yes'); no.classList.toggle('on', choice === 'no');
        countF.hidden = dietF.hidden = choice !== 'yes';
        othersF.hidden = !(choice === 'yes' && +count.value > 1);
        send.disabled = !choice || !name.value.trim();
      };
      yes.onclick = () => { choice = 'yes'; paint(); };
      no.onclick = () => { choice = 'no'; paint(); };
      count.onchange = name.oninput = paint;
      send.onclick = async () => {
        send.disabled = true; msg.textContent = 'Sending...';
        const body = { action: token ? 'respond' : 'open', token, name: name.value.trim(), rsvp: choice, count: +count.value,
          plusOne: choice === 'yes' ? others.value : '', diet: choice === 'yes' ? diet.value : '', hp: hp.value };
        try {
          const j = await (await fetch(e.scriptUrl, { method: 'POST', body: JSON.stringify(body) })).json();
          if (!j.ok) throw new Error(j.error);
          msg.textContent = choice === 'yes' ? 'Thank you! We cannot wait to celebrate with you.' : 'Thank you for letting us know. We will miss you.';
          if (token) msg.textContent += ' You can change your answer here until the deadline.';
        } catch { msg.textContent = 'Sorry, that did not go through. Please try again.'; }
        paint();
      };
      inner.replaceChildren(...head, field('Your name', name), el('div', { className: 'choice' }, yes, no),
        countF, othersF, dietF, hp, send, msg);
      paint();
    };

    if (!token) { build(null); return panel; }
    const u = new URL(e.scriptUrl); u.search = new URLSearchParams({ action: 'guest', token });
    fetch(u).then(r => r.json()).then(g => { if (g.error) throw new Error('nf'); build(g); })
      .catch(() => inner.replaceChildren(...head.slice(0, 1), el('p', { className: 'small', textContent: 'We could not find your personal invitation. Please check the link or contact the couple.' })));
    return panel;
  }

  function $(s) { return document.querySelector(s); }
})();
