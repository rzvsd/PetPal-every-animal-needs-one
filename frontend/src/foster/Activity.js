import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { loadActivity, markActivityRead } from '../services/fosterApi';
import { Button, Card, Empty, Notice, Screen, listMotion } from './ui';

// Everything PetPal told me, for anyone without push (web, permission off,
// lost token). Chat messages are left out; they have their own badges.
export default function Activity({ onBack, onOpen, onSeen }) {
  const { t, lang } = useApp();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState(true);

  const load = useCallback(async (offset = 0) => {
    try {
      const page = await loadActivity(offset);
      setRows(current => (offset ? [...(current || []), ...page] : page));
      setMore(page.length === 30);
      setError('');
      if (!offset && page.some(row => !row.read_at)) { await markActivityRead(page[0].created_at); onSeen(); }
    } catch (failure) { setError(friendlyError(failure, t)); }
  }, [t, onSeen]);
  useEffect(() => { load(); }, [load]);

  const when = value => new Date(value).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return <Screen title={t('fx.activity')} onBack={onBack}>
    {error && <Notice tone="error">{error} <button type="button" className="fx-notice-close" onClick={() => load()}>{t('fx.retry')}</button></Notice>}
    {!rows ? <div className="fx-stack">{[0, 1, 2].map(i => <div key={i} className="fx-skeleton" style={{ height: 72 }} />)}</div>
      : !rows.length ? <Empty art="paw" title={t('fx.activityEmpty')} text={t('fx.activityEmptyHint')} />
        : <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
          {rows.map(row => <Card key={row.id} onClick={() => onOpen(row.payload || {})} className={row.read_at ? '' : 'fx-unread'}>
            <div className="fx-row" style={{ alignItems: 'flex-start' }}>
              <Bell size={18} aria-hidden="true" style={{ marginTop: 3, flex: '0 0 auto' }} />
              <div className="fx-grow">
                <p style={{ fontWeight: 650 }}>{row.title}</p>
                {row.body && <p className="fx-muted" style={{ marginTop: 2 }}>{row.body}</p>}
                <p className="fx-hint" style={{ marginTop: 4 }}>{when(row.created_at)}</p>
              </div>
            </div>
          </Card>)}
          {more && <Button variant="secondary" onClick={() => load(rows.length)}>{t('care.loadMore')}</Button>}
        </motion.div>}
  </Screen>;
}
