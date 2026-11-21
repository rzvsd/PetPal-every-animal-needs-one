import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bell, CheckSquare, Heart, Home, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { loadActivity, markActivityRead } from '../services/fosterApi';
import { Button, Card, Empty, Notice, Screen, listMotion } from './ui';

// Everything PetPal told me, for anyone without push (web, permission off,
// lost token). Chat messages are left out; they have their own badges.
// One icon per kind of notice, so the list can be scanned without reading it.
const ICONS = { MATCH_MUTUAL: Heart, FOSTER_UPDATE: Home, FOSTER_URGENT: AlertTriangle, FOSTER_TASKS_TODAY: CheckSquare,
  FOSTER_TEAM_INVITE: Users, FOSTER_TEAM_JOINED: Users, MODERATION_DECISION: ShieldCheck, ADMIN_ALERT: ShieldCheck };

// "5 min ago" for today and yesterday, a short date after that.
export function activityTime(value, lang, now = Date.now()) {
  const date = new Date(value);
  const locale = lang === 'ro' ? 'ro-RO' : 'en-GB';
  const seconds = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (seconds > -60) return rtf.format(0, 'minute');
  if (seconds > -3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (seconds > -86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (seconds > -2 * 86400) return rtf.format(-1, 'day');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

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

  // Notices are stored in both languages; show the one the app is using now.
  const text = (row, field) => row[`${field}_${lang === 'en' ? 'en' : 'ro'}`] || row[field];
  return <Screen title={t('fx.activity')} onBack={onBack}>
    {error && <Notice tone="error">{error} <button type="button" className="fx-notice-close" onClick={() => load()}>{t('fx.retry')}</button></Notice>}
    {!rows ? <div className="fx-stack">{[0, 1, 2].map(i => <div key={i} className="fx-skeleton" style={{ height: 72 }} />)}</div>
      : !rows.length ? <Empty art="paw" title={t('fx.activityEmpty')} text={t('fx.activityEmptyHint')} />
        : <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
          {rows.map(row => { const Icon = ICONS[row.event_type] || Bell; return <Card key={row.id} onClick={() => onOpen(row.payload || {})}
            className={`fx-activity ${row.read_at ? '' : 'is-unread'} ${row.event_type === 'FOSTER_URGENT' ? 'is-urgent' : ''}`}>
            <div className="fx-row" style={{ alignItems: 'flex-start' }}>
              <span className="fx-activity-icon" aria-hidden="true"><Icon size={18} /></span>
              <div className="fx-grow">
                <p className="fx-activity-head"><span className="fx-grow">{text(row, 'title')}</span>
                  <time dateTime={row.created_at} title={new Date(row.created_at).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB')}>{activityTime(row.created_at, lang)}</time></p>
                {text(row, 'body') && <p className="fx-muted" style={{ marginTop: 2 }}>{text(row, 'body')}</p>}
              </div>
              {!row.read_at && <span className="fx-activity-dot" role="img" aria-label={t('fx.activityNew')} />}
            </div>
          </Card>; })}
          {more && <Button variant="secondary" onClick={() => load(rows.length)}>{t('care.loadMore')}</Button>}
        </motion.div>}
  </Screen>;
}
