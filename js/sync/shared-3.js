/* Shared ledgers: encryption key, merge and upload. (part 3 of 3; continues from shared-2.js) */
  function leaveLedger() {
    const m = SHM;
    if (!m) return;
    confirmSheet(
      m.owner ? t('deleteLedgerQ') : t('leaveLedgerQ'),
      m.owner ? t('deleteLedger') : t('leaveLedger'),
      async () => {
        if (m.owner) {
          try {
            await gfetch('/drive/v3/files/' + m.fileId, {
              method: 'PATCH',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({trashed: true})
            });
          } catch (e) {}
        }
        PS.ledgers = PS.ledgers.filter(l => l.id !== m.id);
        try {
          localStorage.removeItem('daftari-led-' + m.id);
        } catch (e) {}
        shDirty = false;
        await switchLedger('me');
        vaultSave(PS);
      }
    );
  }
