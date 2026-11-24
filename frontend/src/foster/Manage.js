import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Cat, ChevronRight, Copy, Dog, DoorOpen, Edit3, MessageCircle, PawPrint, Plus, Share2, Trash2, UserPlus, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { fosterRpc } from '../services/fosterApi';
import { Button, Card, Choices, Empty, Field, Journey, Notice, Photo, Screen, SectionTitle, Sheet, fmt, listMotion } from './ui';
import { SUPPORT_EMAIL } from '../services/support';
import { durationLabel, freePlaces } from './Find';
import { PhotoPicker, Toggle, caseToData } from './Wizard';
import { person } from '../ui/kit';

export function CaseStory({ item, data, busy, onBack, onEdit, onAnswer, onOpenChat, onOpenPlacement, onChanged, onOpenHomeById, onWithdraw, onPostAnother }) {
  const { t } = useApp();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const requests = [...data.incoming, ...data.outgoing].filter(r => r.case_id === item.id);
  const offers = requests.filter(r => r.status === 'PENDING' && r.recipient_id !== r.home_owner_id);
  const invitesSent = requests.filter(r => r.status === 'PENDING' && r.kind === 'INVITE');
  const placed = requests.filter(r => r.placement_id && ['RESERVED', 'IN_CARE'].includes(r.placement_status));
  const visible = item.status === 'ACTIVE';
  const toggleVisible = async value => {
    setSaving(true); setError('');
    try { await fosterRpc('save_foster_case', { case_id_input: item.id, animal_id_input: item.animal_id,
      data_input: { ...caseToData(item), status: value ? 'ACTIVE' : 'PAUSED' } }); onChanged(); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setSaving(false); }
  };
  return <Screen title={item.name} onBack={onBack}
    action={<button type="button" className="fx-icon-button" aria-label={t('fx.edit')} onClick={onEdit}><Edit3 size={19} /></button>}>
    <div className="fx-hero"><Photo src={item.photo} name={item.name} species={item.species} className="fx-photo-hero" layoutId={`case-photo-${item.id}`} />
      <div className="fx-hero-overlay">{item.urgency === 'HIGH' && <span className="fx-badge is-clay"><Zap size={12} />{t('fx.urgent')}</span>}
        <span className="fx-badge">{durationLabel(item.duration, t)}</span></div></div>
    <Card className="fx-lift">
      <h2 className="fx-page-title" style={{ fontSize: 24 }}>{item.name}</h2>
      <p className="fx-muted">{t('fx.yours')}</p>
      <div style={{ marginTop: 18 }}><Journey current={placed.length ? (placed[0].placement_status === 'IN_CARE' ? 3 : 1) : 0}
        steps={[t('fx.stepOffered'), t('fx.stepAgreed'), t('fx.stepArrived'), t('fx.stepInCare'), t('fx.stepFinished')]} /></div>
    </Card>
    {error && <Notice tone="error">{error}</Notice>}

    {placed.map(r => <Card key={r.id} className="fx-next" style={{ marginTop: 14 }} onClick={() => onOpenPlacement(r.placement_id)}>
      <p className="fx-eyebrow">{t('fx.nextStep')}</p>
      <p style={{ marginTop: 6, fontSize: 16, fontWeight: 600 }}>{fmt(t('fx.atHome'), { home: r.home_name })}</p>
      <p style={{ marginTop: 4 }} className="fx-row">{t('fx.view')} <ChevronRight size={16} /></p>
    </Card>)}

    {(!placed.length || offers.length > 0) && <><SectionTitle count={offers.length || undefined}>{t('fx.offersFromHomes')}</SectionTitle>
    <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show">
      {offers.length ? offers.map(r => <Card key={r.id} className="fx-todo">
        <div className="fx-todo-head"><span className="fx-intent-icon is-green" aria-hidden="true">🏡</span>
          <div className="fx-grow"><h3>{r.home_name}</h3><p>{person(r.sender_name, t)}</p></div></div>
        {r.message && <p className="fx-quote">{r.message}</p>}
        {onOpenHomeById && <button type="button" className="fx-link-button" onClick={() => onOpenHomeById(r.home_id)}>{fmt(t('fx.seeHome'), { home: r.home_name || '' })}</button>}
        <div className="fx-actions">
          <Button disabled={busy} onClick={() => onAnswer(r, 'ACCEPT')}>{t('fx.accept')}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => onAnswer(r, 'DECLINE')}>{t('fx.decline')}</Button>
          {r.conversation_id && <Button variant="soft" icon={MessageCircle} aria-label={t('fx.chat')} onClick={() => onOpenChat(r.conversation_id)} style={{ flex: '0 0 50px', padding: 0 }} />}
        </div>
      </Card>) : <Empty art="house" title={t('fx.noOffers')} text={visible ? t('fx.noOffersHint') : t('fx.hidden')} />}
      {invitesSent.map(r => <Card key={r.id}><p style={{ fontSize: 14 }}>{fmt(t('fx.waitingFor'), { name: person(r.recipient_name, t), animal: item.name })}</p>
        {onWithdraw && r.status === 'PENDING' && <div className="fx-actions"><Button variant="secondary" disabled={busy} onClick={() => onWithdraw(r)}>{t('fx.withdrawOffer')}</Button></div>}</Card>)}
    </motion.div></>}

    <SectionTitle>{t('fx.settings')}</SectionTitle>
    <div className="fx-stack">
      <Toggle label={t('fx.visibleToHomes')} value={visible} onChange={value => { if (!saving) toggleVisible(value); }} />
      <Button variant="secondary" icon={Edit3} onClick={onEdit}>{t('fx.edit')}</Button>
      {onPostAnother && <Button variant="secondary" icon={Copy} onClick={onPostAnother}>{t('fx.postAnotherLikeThis')}</Button>}
    </div>
  </Screen>;
}

export function homeToData(home) {
  return { name: home.name, city: home.city, area: home.area || '', capacity: home.capacity ?? 1, dogCapacity: home.dog_capacity ?? '',
    catCapacity: home.cat_capacity ?? '', availability: home.availability, published: home.published, species: home.species || ['DOG', 'CAT'],
    bio: home.bio || '', housingType: home.housing_type || '', experience: home.experience || '', photos: home.photos || [],
    expectedUpdatedAt: home.updated_at };
}

export function HomeSettings({ home, data, onBack, onEdit, onChanged }) {
  const { t } = useApp();
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = home.my_role === 'OWNER';
  const members = data.team.filter(m => m.home_id === home.id);
  const spaces = data.spaces.filter(s => s.home_id === home.id);
  const used = (home.occupied || 0) + (home.reserved || 0);
  const run = async (action, success) => {
    setBusy(true); setError('');
    try { await action(); onChanged(); setSheet(null); if (success) setNotice(success); }
    catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  const open = (type, initial = {}) => { setForm(initial); setError(''); setSheet(type); };
  const sheetFooter = (label, onClick, disabled) => <><Button variant="secondary" onClick={() => setSheet(null)}>{t('common.cancel')}</Button>
    <Button disabled={busy || disabled} onClick={onClick}>{busy ? t('fx.loading') : label}</Button></>;

  return <Screen title={t('fx.myHome')} onBack={onBack}
    action={owner && <button type="button" className="fx-icon-button" aria-label={t('fx.edit')} onClick={onEdit}><Edit3 size={19} /></button>}>
    <div className="fx-hero"><Photo src={home.photos?.[0]} name={home.name} className="fx-photo-hero" /></div>
    <Card className="fx-lift">
      <h2 className="fx-page-title" style={{ fontSize: 24 }}>{home.name}</h2>
      <p className="fx-muted">{[home.area, home.city].filter(Boolean).join(', ')} · {fmt(t('fx.placesUsed'), { used, total: home.capacity })}</p>
      <div className="fx-row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="fx-badge">{fmt(t('fx.placesFree'), { count: freePlaces(home) })}</span>
        {!home.published && <span className="fx-badge is-muted">{t('fx.hidden')}</span>}
      </div>
    </Card>
    {home.moderation_hidden && <Notice tone="error">{SUPPORT_EMAIL ? fmt(t('fx.homeHiddenByModeration'), { email: SUPPORT_EMAIL }) : t('fx.homeHiddenByModerationInApp')}</Notice>}
    {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    {error && !sheet && <Notice tone="error">{error}</Notice>}

    {owner && <><SectionTitle>{t('fx.availability')}</SectionTitle>
      <Choices label={t('fx.availability')} value={home.availability} columns={3}
        onChange={value => run(() => fosterRpc('save_foster_home', { home_id_input: home.id, data_input: { ...homeToData(home), availability: value } }), t('fx.careUpdated'))}
        options={[['AVAILABLE', t('fx.availableYes')], ['LIMITED', t('fx.availableLimited')], ['UNAVAILABLE', t('fx.availableNo')]]} /></>}

    {owner && <Button variant="secondary" icon={PawPrint} className="fx-button-block" style={{ marginTop: 16 }}
      onClick={() => open('register', { name: '', species: 'DOG', photo: '', provenance: '', id: crypto.randomUUID() })}>{t('fx.registerAnimal')}</Button>}

    <SectionTitle action={owner && <Button variant="soft" className="fx-button-small" icon={Plus} onClick={() => open('space', { name: '', isolation: false })}>{t('fx.addSpace')}</Button>}>
      {t('fx.spaces')}</SectionTitle>
    {spaces.length ? <div className="fx-stack">{spaces.map(space => <Card key={space.id}><div className="fx-row"><DoorOpen size={20} />
      <span className="fx-grow" style={{ fontWeight: 600 }}>{space.name}</span>{space.isolation && <span className="fx-badge is-sun">{t('fx.stateQuiet')}</span>}</div></Card>)}</div>
      : <p className="fx-muted">{t('fx.noAnimalsYet')}</p>}

    <SectionTitle action={owner && <Button variant="soft" className="fx-button-small" icon={UserPlus} onClick={() => open('invite', { role: 'CARER' })}>{t('fx.inviteHelper')}</Button>}>
      {t('fx.team')}</SectionTitle>
    <div className="fx-stack">
      {members.map(member => <Card key={member.profile_id}><div className="fx-row">
        <span className="fx-grow"><h3>{person(member.display_name, t)}</h3><p className="fx-muted">{t(`care.${member.role}`)} · {member.status === 'ACTIVE' ? t('care.platformActive') : t(`care.${member.status}`)}</p></span>
        {owner && member.role !== 'OWNER' && ['ACTIVE', 'INVITED'].includes(member.status) && <Button variant="ghost" icon={Trash2} aria-label={t('fx.remove')}
          disabled={busy} onClick={() => run(() => fosterRpc('manage_foster_member', { home_id_input: home.id, profile_id_input: member.profile_id, action_input: 'REVOKE' }))} />}
      </div></Card>)}
    </div>

    <Sheet open={sheet === 'space'} onClose={() => setSheet(null)} title={t('fx.addSpace')}
      footer={sheetFooter(t('fx.add'), () => run(() => fosterRpc('save_foster_space', { home_id_input: home.id, name_input: form.name, isolation_input: form.isolation })), !form.name?.trim())}>
      <Field label={t('care.name')}><input className="fx-input" maxLength={80} value={form.name || ''} onChange={event => setForm(f => ({ ...f, name: event.target.value }))} /></Field>
      <Toggle label={t('care.isolation')} value={Boolean(form.isolation)} onChange={value => setForm(f => ({ ...f, isolation: value }))} />
      {error && <Notice tone="error">{error}</Notice>}
    </Sheet>

    <Sheet open={sheet === 'invite'} onClose={() => setSheet(null)} title={t('fx.inviteHelper')}
      footer={form.code ? <Button className="fx-button-block" onClick={() => setSheet(null)}>{t('fx.done')}</Button>
        : sheetFooter(t('fx.createCode'), async () => {
          setBusy(true); setError('');
          try { const created = await fosterRpc('create_foster_invite_code', { home_id_input: home.id, role_input: form.role }); setForm(f => ({ ...f, ...created })); }
          catch (failure) { setError(friendlyError(failure, t)); }
          finally { setBusy(false); }
        })}>
      {form.code ? <>
        <p className="fx-muted">{t('fx.codeReady')}</p>
        <div className="fx-code" aria-label={form.code.split('').join(' ')}>{form.code.slice(0, 4)}-{form.code.slice(4)}</div>
        <p className="fx-hint" style={{ textAlign: 'center' }}>{t('fx.codeRules')}</p>
        <div className="fx-actions">
          <Button variant="secondary" icon={Copy} onClick={async () => {
            try { await navigator.clipboard.writeText(`${form.code.slice(0, 4)}-${form.code.slice(4)}`); setForm(f => ({ ...f, copied: true })); } catch { /* The code stays on screen to read out. */ }
          }}>{form.copied ? t('fx.copied') : t('fx.copy')}</Button>
          {navigator.share && <Button variant="secondary" icon={Share2} onClick={() => navigator.share({
            text: fmt(t('fx.codeShareText'), { home: home.name, code: `${form.code.slice(0, 4)}-${form.code.slice(4)}` }) }).catch(() => {})}>{t('fx.share')}</Button>}
        </div>
      </> : <>
        <p className="fx-muted">{t('fx.inviteExplain')}</p>
        <Choices label={t('care.role')} value={form.role} columns={2} onChange={value => setForm(f => ({ ...f, role: value }))}
          options={[['CARER', t('care.CARER')], ['READER', t('care.READER')]]} />
      </>}
      {error && <Notice tone="error">{error}</Notice>}
    </Sheet>

    <Sheet open={sheet === 'register'} onClose={() => setSheet(null)} title={t('fx.registerAnimal')}
      footer={sheetFooter(t('fx.add'), () => run(() => fosterRpc('register_foster_animal', { placement_id_input: form.id, home_id_input: home.id,
        data_input: { ownerAnimalId: '', name: form.name, species: form.species, photo: form.photo, provenance: form.provenance } }), t('fx.careUpdated')),
        !form.name?.trim() || !form.provenance?.trim())}>
      <PhotoPicker value={form.photo} itemId={form.id} onChange={value => setForm(f => ({ ...f, photo: value }))} />
      <Field label={t('fx.animalName')}><input className="fx-input" maxLength={80} value={form.name || ''} onChange={event => setForm(f => ({ ...f, name: event.target.value }))} /></Field>
      <Choices label={t('care.species')} value={form.species} columns={2} onChange={value => setForm(f => ({ ...f, species: value }))}
        options={[['DOG', t('fx.dog'), Dog], ['CAT', t('fx.cat'), Cat]]} />
      <Field label={t('fx.whereFrom')} hint={t('care.originHint')}><textarea className="fx-input" maxLength={2000} value={form.provenance || ''}
        onChange={event => setForm(f => ({ ...f, provenance: event.target.value }))} /></Field>
      {error && <Notice tone="error">{error}</Notice>}
    </Sheet>
  </Screen>;
}

// A helper types the code a home owner gave them and joins that home.
export function JoinHomeSheet({ open, onClose, onJoined }) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const join = async () => {
    setBusy(true); setError('');
    try {
      const result = await fosterRpc('redeem_foster_invite_code', { code_input: clean });
      if (result.status === 'JOINED') { setCode(''); onJoined(result.homeName); return; }
      setError(t({ LIMIT: 'fx.codeLimit', OWN_HOME: 'fx.codeOwnHome' }[result.status] || 'fx.codeInvalid'));
    } catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onClose={onClose} title={t('fx.joinTitle')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button disabled={busy || clean.length !== 8} onClick={join}>{busy ? t('fx.loading') : t('fx.join')}</Button></>}>
    <Field label={t('fx.joinLabel')} hint={t('fx.joinHint')}>
      <input className="fx-input fx-code-input" value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false}
        placeholder="ABCD-2345" onChange={event => { setCode(event.target.value); setError(''); }} />
    </Field>
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}
