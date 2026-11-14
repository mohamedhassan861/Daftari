/* Which Drive backup copies to keep. Takes the list of files and today's date; touches nothing itself. */
  const BK_NAME = /^daftari_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.json$/;
  /* only the app's own backup copies: not shared ledgers, receipts, summaries or the recovery file in the same folder */
  const isBackupFile = n => BK_NAME.test(n);
  /* kept: every copy from the last 7 days; the last copy of each day for the 90 days before that; the last copy of
     each month before that; and always the newest 20 whatever their dates. The rest is returned to be binned. */
  function backupsToTrash(files, today) {
    const days = new Set(),
      months = new Set(),
      out = [];
    files
      .map(f => {
        const m = BK_NAME.exec(f.name);
        return m ? {f, day: m[1], key: m[1] + '_' + m[2]} : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
      .forEach((x, i) => {
        const age = Math.round((dOf(today) - dOf(x.day)) / 864e5),
          month = x.day.slice(0, 7),
          firstOfDay = !days.has(x.day),
          firstOfMonth = !months.has(month);
        days.add(x.day);
        months.add(month);
        if (i < 20 || age <= 7) return;
        if (age <= 97 ? firstOfDay : firstOfMonth) return;
        out.push(x.f);
      });
    return out;
  }
