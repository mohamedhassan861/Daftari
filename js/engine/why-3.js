/* Where each number comes from: the breakdown shown when a number is tapped. (part 3 of 3; continues from why-2.js) */
      case 'cDue': {
        const r = cards()
          .map(a => {
            const c = cardInfo(a, PE);
            return L(a.name, toBase(c.due || 0, a.currency), {
              plain: 1,
              act: 'stmtAcc',
              id: a.id,
              s: c.dueDate
                ? t('nextPay') +
                  ' ' +
                  shortDate(c.dueDate) +
                  (c.close ? ' · ' + t('closeDay') + ' ' + shortDate(c.close) : '')
                : ''
            });
          })
          .filter(x => Math.abs(x.v) >= 0.5);
        return {
          title: t('cardDue'),
          sub: dmyOf(dsDate(PE)),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ]),
          note: t('cDueNote')
        };
      }
      case 'fx': {
        const g = fxGain(PA, P.proj ? TODAY : PE);
        return {
          title: t('fxTitle'),
          sub: perLabel(),
          lines: g.rows
            .map(r =>
              L(r.a.name + ' (' + r.a.currency + ')', r.g, {
                act: 'stmtAcc',
                id: r.a.id,
                s: t('fxRow')
                  .replace('%o', fmt(Math.round(r.open)))
                  .replace('%f', fmt(Math.round(r.flow)))
                  .replace('%c', fmt(Math.round(r.close)))
              })
            )
            .concat([L(t('total'), g.tot, {strong: 1, total: 1})]),
          note: t('fxNote')
        };
      }
      case 'due': {
        const DM = PE.slice(0, 7),
          r = [];
        dueFor(DM)
          .filter(d => d.k !== 'gamr')
          .forEach(d =>
            r.push(
              L(d.name, -toBase(d.amount, d.cur || BASE()), {
                plain: 1,
                act: d.k === 'inst' ? 'payInst' : 'payGam',
                id: d.id,
                s: (d.k === 'inst' ? t('installments') : t('gameyas')) + ' · ' + monthLbl(d.ym)
              })
            )
          );
        return {
          title: t('dueLbl'),
          sub: t('dueUntil') + ' ' + monthLbl(DM),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ]),
          note: t('dueWhyNote')
        };
      }
    }
    return null;
  }
