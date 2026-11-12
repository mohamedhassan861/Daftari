/* Reading a statement file (Excel, CSV or PDF) into rows of cells, on the phone; the file is not sent anywhere. */
  /* the PDF reader is kept with the app's own files (not a public CDN) and loaded only when a PDF is chosen */
  function loadPDFJS() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (PDFJSP) return PDFJSP;
    PDFJSP = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/pdfjs-3.11.174/pdf.min.js';
      sc.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs-3.11.174/pdf.worker.min.js';
        res(window.pdfjsLib);
      };
      sc.onerror = () => {
        PDFJSP = null;
        rej(new Error('pdf'));
      };
      document.head.appendChild(sc);
    });
    return PDFJSP;
  }
  const hasAr = s => /[؀-ۿ]/.test(s);
  /* text pieces of each page → lines (same height on the page) → cells (pieces close together) */
  async function pdfLines(buf, password) {
    const L = await loadPDFJS(),
      doc = await L.getDocument({data: buf, isEvalSupported: false, password: password || undefined}).promise,
      out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const items = tc.items
        .filter(it => it.str && it.str.trim())
        .map(it => ({
          s: it.str.trim(),
          x: it.transform[4],
          y: it.transform[5],
          w: it.width || 0,
          h: Math.abs(it.transform[3]) || it.height || 8
        }));
      const lines = [];
      items
        .sort((a, b) => b.y - a.y)
        .forEach(it => {
          const ln = lines.find(l => Math.abs(l.y - it.y) <= Math.max(2, it.h * 0.4));
          if (ln) ln.items.push(it);
          else lines.push({y: it.y, items: [it]});
        });
      lines
        .sort((a, b) => b.y - a.y)
        .forEach(ln => {
          ln.items.sort((a, b) => a.x - b.x);
          const cells = [];
          ln.items.forEach(it => {
            const c = cells[cells.length - 1];
            /* a number never joins a word: in tight PDFs a long description can touch the amount next to it */
            if (
              c &&
              it.x - c.x1 < Math.max(4, it.h * 0.6) &&
              pdfKind(it.s) === pdfKind(c.parts[c.parts.length - 1].s)
            ) {
              c.parts.push(it);
              c.x1 = Math.max(c.x1, it.x + it.w);
            } else cells.push({parts: [it], x0: it.x, x1: it.x + it.w});
          });
          /* Arabic reads right to left, so its pieces are joined from the right */
          cells.forEach(c => {
            const ar = c.parts.filter(q => hasAr(q.s)).length > c.parts.length / 2;
            /* PDFs often store Arabic as presentation forms (ﺍﻟﺮﺻﻴﺪ); NFKC turns them back into plain letters */
            c.s = (ar ? [...c.parts].reverse() : c.parts).map(q => q.s.normalize('NFKC')).join(' ');
          });
          out.push(cells);
        });
    }
    return out;
  }
  /* lines of positioned cells → table rows lined up under the header's columns */
  /* some PDFs give Arabic text back to front; if no header is found as written, try it with Arabic turned round */
  function pdfTable(lines) {
    return (
      pdfTable1(lines) ||
      pdfTable1(
        lines.map(cells => cells.map(c => Object.assign({}, c, {s: hasAr(c.s) ? [...c.s].reverse().join('') : c.s})))
      )
    );
  }
  /* each piece goes to a column by what it is: a date to the date column, a number to the nearest amount column
     under its heading, words to the description; this survives tight layouts where pieces cross column lines */
  function pdfTable1(lines) {
    let best = null;
    lines.forEach((cells, i) => {
      const c = stmtGuessCols(cells.map(x => x.s)),
        n = Object.keys(c).length;
      if (stmtColsOk(c) && (!best || n > best.n)) best = {i, n, cols: c};
    });
    if (!best) return null;
    const H = lines[best.i],
      R = best.cols,
      sig = stmtNorm(H.map(h => h.s).join(' ')),
      mid = h => (h.x0 + h.x1) / 2;
    const numCols = ['debit', 'credit', 'amount', 'balance'].filter(k => R[k] != null).map(k => R[k]),
      dateCols = H.map((h, j) => j).filter(j => j === R.date || stmtRoleScore(H[j].s, 'date')),
      textCol = R.desc != null ? R.desc : -1;
    const nearest = (c, js) => {
      let bj = -1,
        bd = Infinity;
      js.forEach(j => {
        const h = H[j],
          over = Math.min(c.x1, h.x1) - Math.max(c.x0, h.x0),
          d = over > 0 ? 0 : Math.min(Math.abs(c.x0 - h.x1), Math.abs(c.x1 - h.x0), Math.abs(mid(c) - mid(h)));
        if (d < bd) {
          bd = d;
          bj = j;
        }
      });
      return {j: bj, d: bd};
    };
    const rows = [H.map(h => h.s)];
    lines.slice(best.i + 1).forEach(cells => {
      if (stmtNorm(cells.map(c => c.s).join(' ')) === sig) return;
      const row = H.map(() => ''),
        dist = H.map(() => Infinity),
        words = [];
      cells.forEach(c => {
        const kind = pdfKind(c.s);
        if (kind === 'n' && stmtDateParts(c.s) && /[/.-]/.test(c.s) && dateCols.length) {
          const {j} = nearest(c, dateCols);
          if (!row[j]) {
            row[j] = c.s;
            return;
          }
        }
        if (kind === 'n' && numCols.length) {
          const {j, d} = nearest(c, numCols);
          /* a number far from every amount heading is part of the description (e.g. a phone or card number) */
          if (d <= Math.max(40, H[j].x1 - H[j].x0) && d < dist[j]) {
            if (row[j]) words.push({c, s: row[j]});
            row[j] = c.s;
            dist[j] = d;
            return;
          }
        }
        words.push({c, s: c.s});
      });
      if (words.length) {
        const ar = words.filter(w => hasAr(w.s)).length > words.length / 2,
          ws = words.sort((p, q) => (ar ? q.c.x0 - p.c.x0 : p.c.x0 - q.c.x0)).map(w => w.s);
        if (textCol >= 0) row[textCol] = (row[textCol] ? row[textCol] + ' ' : '') + ws.join(' ');
        else
          words.forEach(
            w =>
              (row[
                nearest(
                  w.c,
                  H.map((h, j) => j)
                ).j
              ] += ' ' + w.s)
          );
      }
      rows.push(row);
    });
    return rows;
  }
  /* any file → {rows, hdr: {i, cols}} — headings first, then what the columns hold; password only for locked PDFs */
  async function readStmtFile(f, password) {
    const find = rows => stmtFindHeader(rows) || stmtGuessByContent(rows);
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      const rows = pdfTable(await pdfLines(await f.arrayBuffer(), password));
      if (!rows) throw new Error('pdfTable');
      return {rows, hdr: find(rows)};
    }
    let sheets;
    if (/\.(xlsx|xls|xlsm|ods)$/i.test(f.name)) {
      const X = await loadXLSX(),
        wb = X.read(await f.arrayBuffer(), {type: 'array', cellDates: true});
      sheets = wb.SheetNames.map(n => X.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: true, defval: ''}));
    } else sheets = [parseCSV(await f.text())];
    /* the sheet that holds the statement, else the first */
    for (const rows of sheets) {
      const hdr = find(rows);
      if (hdr) return {rows, hdr};
    }
    return {rows: sheets[0] || [], hdr: null};
  }
