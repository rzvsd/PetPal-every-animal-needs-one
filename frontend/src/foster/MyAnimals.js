import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronRight, Plus, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Card, Empty, Photo, SectionTitle, fmt, listMotion } from './ui';
import { Art } from '../ui/kit';
import { durationLabel } from './Find';

const careBadge = {
  ISOLATION: ['is-sun', 'fx.stateQuiet'],
  MEDICAL: ['is-danger', 'fx.stateVet'],
};

function AnimalRow({ photo, name, species, subtitle, badges = [], onClick }) {
  return <Card onClick={onClick} className="fx-tile">
    <Photo src={photo} name={name} species={species} className="fx-tile-photo" />
    <div className="fx-tile-info">
      <h3>{name}</h3>
      {subtitle && <p>{subtitle}</p>}
      {badges.length > 0 && <div className="fx-tile-badges">{badges}</div>}
    </div>
  </Card>;
}

export default function MyAnimals({ data, onOpenPlacement, onOpenCase, onOpenHomeSettings, onSetUpHome, onPostAnimal }) {
  const { t } = useApp();
  const coming = data.placements.filter(p => p.status === 'RESERVED');
  const inCare = data.placements.filter(p => p.status === 'IN_CARE');
  const looking = data.myCases.filter(c => ['ACTIVE', 'PAUSED'].includes(c.status) && !c.placed);
  const hasAnything = coming.length || inCare.length || looking.length || data.placedElsewhere.length || data.finished.length;

  const placementRow = p => {
    const badges = [];
    if (p.status === 'RESERVED') badges.push(<span key="status" className="fx-badge is-clay">{t('fx.stepAgreed')}</span>);
    else if (careBadge[p.care_state]) badges.push(<span key="care" className={`fx-badge ${careBadge[p.care_state][0]}`}>{t(careBadge[p.care_state][1])}</span>);
    else badges.push(<span key="care" className="fx-badge">{t('fx.stateWell')}</span>);
    if (p.overdue_tasks > 0) badges.push(<span key="late" className="fx-badge is-danger"><AlertCircle size={12} />{p.overdue_tasks} {t('fx.overdue')}</span>);
    const place = [data.ownHomes.length > 1 && p.home_name, p.space_name].filter(Boolean).join(' · ');
    return <AnimalRow key={p.id} photo={p.photo} name={p.name} species={p.species} badges={badges}
      subtitle={place || null} onClick={() => onOpenPlacement(p.id)} />;
  };

  return <>
    <header className="fx-hello"><h1>{t('fx.tabMine')}</h1></header>

    <motion.div className="fx-stack" variants={listMotion} initial="hidden" animate="show" style={{ marginTop: 14 }}>
      {data.ownHomes.map(home => {
        const used = (home.occupied || 0) + (home.reserved || 0);
        const total = home.capacity || 0;
        return <Card key={home.id} onClick={() => onOpenHomeSettings(home)}>
          <div className="fx-row">
            <Art name="house" size={56} play={false} />
            <div className="fx-grow">
              <p className="fx-eyebrow">{t('fx.myHome')}</p>
              <h2>{home.name}</h2>
              <p className="fx-muted">{fmt(t('fx.placesUsed'), { used, total })}</p>
            </div>
            <Settings size={20} className="fx-chevron" />
          </div>
          <div className="fx-progress" style={{ marginTop: 12 }} aria-hidden="true">
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: total ? Math.min(1, used / total) : 0 }}
              style={{ background: used > total ? 'var(--pp-danger)' : undefined }} />
          </div>
        </Card>;
      })}
      {!data.ownHomes.length && <Card onClick={onSetUpHome}>
        <div className="fx-row"><Art name="house" size={56} play={false} />
          <div className="fx-grow"><h3>{t('fx.intentFosterTitle')}</h3><p className="fx-muted">{t('fx.needHomeFirst')}</p></div>
          <ChevronRight size={20} className="fx-chevron" /></div>
      </Card>}
    </motion.div>

    {!hasAnything && <div style={{ marginTop: 20 }}><Empty art="paw" title={t('fx.noAnimalsYet')} text={t('fx.intentHelpText')}>
      <Button icon={Plus} onClick={onPostAnimal} style={{ marginTop: 8 }}>{t('fx.postAnimal')}</Button></Empty></div>}

    {coming.length > 0 && <><SectionTitle count={coming.length}>{t('fx.comingToMe')}</SectionTitle>
      <motion.div className="fx-shelf" variants={listMotion} initial="hidden" animate="show">{coming.map(placementRow)}</motion.div></>}

    {inCare.length > 0 && <><SectionTitle>{t('fx.inMyCare')}</SectionTitle>
      <motion.div className="fx-shelf" variants={listMotion} initial="hidden" animate="show">{inCare.map(placementRow)}</motion.div></>}

    {data.placedElsewhere.length > 0 && <><SectionTitle>{t('fx.withFoster')}</SectionTitle>
      <motion.div className="fx-shelf" variants={listMotion} initial="hidden" animate="show">
        {data.placedElsewhere.map(r => <AnimalRow key={r.id} photo={r.photo} name={r.animal_name} species={r.species}
          subtitle={fmt(t('fx.atHome'), { home: r.home_name })}
          badges={[<span key="s" className="fx-badge">{t(r.placement_status === 'RESERVED' ? 'fx.stepAgreed' : 'fx.stepInCare')}</span>]}
          onClick={() => onOpenPlacement(r.placement_id)} />)}
      </motion.div></>}

    {(looking.length > 0 || hasAnything) && <SectionTitle action={<Button variant="soft" className="fx-button-small" icon={Plus} onClick={onPostAnimal}>{t('fx.postAnimal')}</Button>}>
      {t('fx.lookingForHome')}</SectionTitle>}
    {looking.length > 0 && <motion.div className="fx-shelf" variants={listMotion} initial="hidden" animate="show">
      {looking.map(c => {
        const offers = data.offersByCase[c.id] || 0;
        return <AnimalRow key={c.id} photo={c.photo} name={c.name} species={c.species} subtitle={durationLabel(c.duration, t)}
          badges={[offers ? <span key="o" className="fx-badge is-clay">{offers === 1 ? t('fx.offerOne') : fmt(t('fx.offersCount'), { count: offers })}</span>
            : <span key="o" className="fx-badge is-muted">{t('fx.noOffers')}</span>,
          ...(c.status === 'PAUSED' ? [<span key="h" className="fx-badge is-muted">{t('fx.hidden')}</span>] : [])]}
          onClick={() => onOpenCase(c)} />;
      })}
    </motion.div>}

    {data.finished.length > 0 && <><SectionTitle>{t('fx.finished')}</SectionTitle>
      <motion.div className="fx-shelf" variants={listMotion} initial="hidden" animate="show">
        {data.finished.map(p => <AnimalRow key={p.id} photo={p.photo} name={p.name} species={p.species} subtitle={p.home_name}
          onClick={() => onOpenPlacement(p.id)} />)}
      </motion.div></>}
  </>;
}
