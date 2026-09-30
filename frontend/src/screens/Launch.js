import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from '../components/Motion';
import './launch.css';

const FILM = `${process.env.PUBLIC_URL}/film/launch.mp4`;
const LENGTH = 3800;

// The opening film: four shots of animals being happy, then the name.
// Real footage, muted, a few seconds, skippable. Plays once per app start.
export default function Launch({ onDone }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const video = useRef(null);
  const [named, setNamed] = useState(false);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };

  useEffect(() => {
    const element = video.current;
    // If the phone refuses to autoplay, the name comes in straight away.
    // Some phones allow video only after a touch; the first tap starts it.
    const retry = () => element?.play().catch(() => {});
    element?.play().catch(() => { setNamed(true); window.addEventListener('pointerdown', retry, { once: true }); });
    const name = setTimeout(() => setNamed(true), reduced ? 200 : 2500);
    const end = setTimeout(finish, reduced ? 1800 : LENGTH + 900);
    return () => { clearTimeout(name); clearTimeout(end); window.removeEventListener('pointerdown', retry); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <motion.div className="pp-launch" exit={{ opacity: 0, transition: { duration: 0.5 } }}>
    {!reduced && <video ref={video} className="pp-launch-film" src={FILM} muted playsInline preload="auto" onEnded={() => setNamed(true)} />}
    <div className="pp-launch-shade" />
    <motion.div className="pp-launch-name" initial={false} animate={named ? 'in' : 'out'}>
      <motion.h1 variants={{ out: { opacity: 0, y: 40, scale: 0.9 }, in: { opacity: 1, y: 0, scale: 1 } }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}>PetPal</motion.h1>
      <motion.p variants={{ out: { opacity: 0, y: 16 }, in: { opacity: 1, y: 0 } }} transition={{ delay: 0.25, duration: 0.5 }}>{t('intro.tagline')}</motion.p>
    </motion.div>
    <button type="button" className="pp-launch-skip" onClick={finish}>{t('intro.skip')}</button>
  </motion.div>;
}
