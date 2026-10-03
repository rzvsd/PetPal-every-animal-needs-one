import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from '../components/Motion';
import { FOSTER_ENVIRONMENT, MATCH_ENVIRONMENT } from '../navigation/environments';
import './launch.css';

const film = name => `${process.env.PUBLIC_URL}/film/${name}`;
const WORLDS = {
  [MATCH_ENVIRONMENT]: { door: 'door-match', accent: '#ffb347', source: 'MATCH', bursts: ['burst-match-a', 'burst-match-b', 'burst-match-c', 'burst-match-d', 'burst-match-e'], words: ['intro.match', 'doors.matchWord2'] },
  [FOSTER_ENVIRONMENT]: { door: 'door-foster', accent: '#f7c948', source: 'FOSTER', bursts: ['burst-foster-a', 'burst-foster-b', 'burst-foster-c', 'burst-foster-d', 'burst-foster-e'], words: ['intro.foster', 'doors.fosterWord2'] },
};

// Picks two different clips, rotating with each visit so the burst changes.
function pickTwo(list, seed) {
  const first = seed % list.length;
  return [list[first], list[(first + 1 + (seed % (list.length - 1))) % list.length]];
}

function Door({ world, unread, chosen, onChoose, t }) {
  const reduced = useReducedPetMotion();
  const spec = WORLDS[world];
  const video = useRef(null);
  useEffect(() => { video.current?.play().catch(() => {}); }, []);
  return <motion.button type="button" data-testid={`choose-${world}-environment`} className="pp-door" style={{ '--door-accent': spec.accent }}
    layout={!reduced} onClick={() => onChoose(world)} whileTap={reduced ? undefined : { scale: 0.985 }}
    animate={chosen && chosen !== world ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
    {reduced ? <img src={film(`${spec.door}.jpg`)} alt="" /> : <video ref={video} src={film(`${spec.door}.mp4`)} poster={film(`${spec.door}.jpg`)} muted loop playsInline preload="auto" />}
    <div className="pp-door-shade" />
    {unread > 0 && <span className="pp-door-count" aria-label={`${unread} ${t('messages.unreadMessages')}`}>{unread}</span>}
    <div className="pp-door-text">
      <span className="pp-door-kicker">{t(world === MATCH_ENVIRONMENT ? 'doors.matchKicker' : 'doors.fosterKicker')}</span>
      <span className="pp-door-title">{t(world === MATCH_ENVIRONMENT ? 'environment.matchTitle' : 'environment.fosterTitle')}</span>
      <span className="pp-door-sub">{t(world === MATCH_ENVIRONMENT ? 'environment.matchDescription' : 'environment.fosterDescription')}</span>
    </div>
    <span className="pp-door-go" aria-hidden="true"><ArrowRight size={24} strokeWidth={2.5} /></span>
  </motion.button>;
}

// Two seconds of happy animals from the chosen world, then the world itself.
function Burst({ world, onDone }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const spec = WORLDS[world];
  const [clips] = useState(() => pickTwo(spec.bursts, Math.floor(Date.now() / 60000)));
  const [index, setIndex] = useState(0);
  // The timers run once; a fresh onDone per render must not restart them.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reduced) { const short = setTimeout(() => done.current(), 300); return () => clearTimeout(short); }
    const next = setTimeout(() => setIndex(1), 1000);
    const end = setTimeout(() => done.current(), 2100);
    return () => { clearTimeout(next); clearTimeout(end); };
  }, [reduced]);
  if (reduced) return null;
  return <motion.div className="pp-burst" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.45 } }} transition={{ duration: 0.2 }}>
    <AnimatePresence initial={false}>
      <motion.div key={clips[index]} className="pp-burst-shot" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
        <img src={film(`${clips[index]}.jpg`)} alt="" />
        <video src={film(`${clips[index]}.mp4`)} muted autoPlay playsInline />
      </motion.div>
    </AnimatePresence>
    <motion.p className="pp-burst-word" key={index} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}>
      {t(spec.words[index])}</motion.p>
  </motion.div>;
}

export default function Doors({ onSelect }) {
  const { t, user, messaging, dataSource } = useApp();
  const unread = dataSource === 'supabase' ? messaging.unreadTotals : {};
  const [chosen, setChosen] = useState(null);
  const [burst, setBurst] = useState(null);
  const choose = world => { setChosen(world); setTimeout(() => setBurst(world), 250); };
  return <>
    <motion.main data-testid="environment-chooser" className="pp-doors" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      <p className="pp-door-hello">{user?.displayName ? `${t('environment.hello')}, ${user.displayName}` : 'PetPal'}</p>
      {[MATCH_ENVIRONMENT, FOSTER_ENVIRONMENT].map(world => <Door key={world} world={world} t={t} chosen={chosen} onChoose={choose} unread={unread[WORLDS[world].source] || 0} />)}
    </motion.main>
    <AnimatePresence>{burst && <Burst key="burst" world={burst} onDone={() => onSelect(burst)} />}</AnimatePresence>
  </>;
}
