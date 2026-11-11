/* The list of upcoming reminders. */
  function upcomingReminders(D) {
    if (!D) return [];
    const out = [],
      end = iso(new Date(dOf(TODAY).getTime() + 14 * 864e5)),
      sym = c => curSym(c || BASE());
    [
      ['inst', D.inst || []],
      ['gam', D.gam || []]
    ].forEach(([k, l]) =>
      l.forEach(o => {
        oblMonths(k, o)
          .filter(m => !o.paid.includes(m) && m <= end.slice(0, 7))
          .forEach(m => {
            let d = m + '-' + pad(Math.min(28, o.dueDay || 1));
            if (d < TODAY) d = TODAY;
            if (d > end) return;
            out.push({
              id: k + o.id + m,
              date: d,
              title: (k === 'inst' ? t('installments') : t('gameyas')) + ' · ' + o.name,
              body: fmt(oblPer(k, o) - partOf(o, m)) + ' ' + sym(o.currency) + ' · ' + monthLbl(m)
            });
          });
        if (k === 'gam' && !o.received) {
          const d = gamPayout(o) + '-' + pad(Math.min(28, o.dueDay || 1));
          if (d >= TODAY && d <= end)
            out.push({
              id: 'gr' + o.id,
              date: d,
              title: t('payout') + ' · ' + o.name,
              body: fmt(o.share * o.members) + ' ' + sym(o.currency)
            });
        }
      })
    );
    (D.recur || []).forEach(r => {
      let d = r.next,
        g = 0;
      const ttl = '↻ ' + (r.tpl.note || catPath(r.tpl.cat)),
        gl = remTime().lead,
        ld = r.lead != null ? +r.lead : gl,
        from = x => {
          const f = iso(new Date(dOf(x).getTime() - ld * 864e5));
          return f < TODAY ? TODAY : f;
        };
      while (g++ < 60) {
        if (r.end && d > r.end) break;
        const de = (r.snooze && r.snooze[d]) || d;
        if (de > end && d > end) break;
        if (de <= end)
          out.push({
            id: 'r' + r.id + d + '_' + de,
            date: de < TODAY ? TODAY : de,
            from: de < TODAY ? TODAY : from(de),
            title: ttl,
            body: fmt(r.tpl.amount) + ' · ' + (de <= TODAY ? t('recNotifToday') : shortDate(de))
          });
        d = advance(d, r.freq, r.day);
      }
    });
    try {
      if (D === S) {
        [TODAY_YM, ymAdd(TODAY_YM, 1)].forEach(m =>
          remainingPlan(m).forEach(e => {
            if (e.date > end || !['loan', 'card'].includes(e.kind)) return;
            out.push({
              id: e.kind + e.date + e.label,
              date: e.date,
              title: (e.kind === 'card' ? '💳 ' : '🤝 ') + e.label,
              body: (e.dir === 'in' ? '+' : '') + fmt(e.amt) + ' ' + sym() + ' · ' + shortDate(e.date)
            });
          })
        );
      }
    } catch (e) {}
    try {
      if (D === S) {
        const sa = cashTimeline().first;
        if (sa) {
          const d = iso(new Date(Math.max(dOf(TODAY).getTime(), dOf(sa.date).getTime() - shortDays() * 864e5)));
          out.push({
            id: 'short' + sa.date,
            date: d,
            title: '⚠️ ' + t('notEnough'),
            body: t('shortMsg')
              .replace('%d', shortDate(sa.date))
              .replace('%l', sa.label)
              .replace('%n', fmt(-cashTimeline().low.bal))
          });
        }
      }
    } catch (e) {}
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60);
  }
