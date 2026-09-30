import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Home, MessageCircle, PawPrint, ShieldCheck, Sun, Star, Users, Dog } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from './Motion';
import './IntroReel.css';
import { isProductionBuild } from '../services/supabaseClient';

// Opening reel: six choreographed scenes that end on the app's own cream
// background, so the reel flows straight into the login screen. The full
// reel plays on first launch; later launches play only the closing lockup.
const FULL = [3200, 3800, 4000, 4500, 3000, 3500];
const SEEN_KEY = 'petpal:intro-seen';
const ink = '#f6f2ea';
const sun = '#f1c46a';
const clay = '#c46f4e';
const sage = '#9fc0a8';
const spring = { type: 'spring', stiffness: 260, damping: 20 };
const soft = { type: 'spring', stiffness: 140, damping: 18 };

function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* The reel simply plays again next time. */ }
}

// A Blender-rendered animated WebP (see scripts/reel). A fresh URL per mount
// restarts the animation when its scene begins.
function Art({ name, size, className = '' }) {
  const [src] = useState(() => `${process.env.PUBLIC_URL}/reel/${name}.webp?play=${Date.now()}`);
  return <img src={src} alt="" width={size} height={size} className={`reel-art ${className}`} draggable="false" />;
}

function SceneSpark() {
  const letters = 'PetPal'.split('');
  return <div className="reel-center">
    <motion.div className="reel-ring" initial={{ scale: 0, opacity: 0.9 }} animate={{ scale: [0, 0.2, 7], opacity: [1, 1, 0] }}
      transition={{ duration: 1.3, times: [0, 0.3, 1], ease: 'easeOut' }} />
    <motion.div initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.3, 1], opacity: 1, x: [0, 0, -92], y: [0, 0, -6] }}
      transition={{ duration: 2, times: [0, 0.35, 1], delay: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <Art name="paw" size={150} />
    </motion.div>
    <div className="reel-word" style={{ position: 'absolute', left: '50%', marginLeft: -30 }}>
      {letters.map((letter, index) => <motion.span key={index} initial={{ opacity: 0, y: 40, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...soft, delay: 1.5 + index * 0.07 }}>{letter}</motion.span>)}
    </div>
  </div>;
}

function SceneWords({ words }) {
  return <div className="reel-stack">
    <motion.div className="reel-sun" initial={{ x: -260, rotate: -90 }} animate={{ x: 260, rotate: 180 }} transition={{ duration: 3.8, ease: 'linear' }} />
    {words.map((word, index) => <div key={index} className="reel-line">
      <motion.span className={index === 1 ? 'reel-accent' : ''} initial={{ y: '110%' }} animate={{ y: '0%' }}
        transition={{ ...soft, delay: 0.15 + index * 0.55 }}>
        {index === 1 ? word.split('').map((letter, i) => <motion.span key={i} style={{ display: 'inline-block' }}
          animate={{ y: [0, -14, 0] }} transition={{ duration: 0.6, delay: 1.4 + i * 0.06, ease: 'easeInOut' }}>{letter}</motion.span>) : word}
      </motion.span>
    </div>)}
  </div>;
}

function SceneMatch({ caption }) {
  const burst = [...Array(12)];
  return <div className="reel-center">
    <motion.div style={{ position: 'absolute' }} initial={{ x: -260, y: 60, rotate: -30 }} animate={{ x: -86, y: 0, rotate: 0 }} transition={{ ...soft, delay: 0.2 }}>
      <Art name="dog" size={172} /></motion.div>
    <motion.div style={{ position: 'absolute' }} initial={{ x: 260, y: -60, rotate: 30 }} animate={{ x: 86, y: 0, rotate: 0 }} transition={{ ...soft, delay: 0.35 }}>
      <Art name="cat" size={172} /></motion.div>
    <motion.div style={{ position: 'absolute', y: -104 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.01, delay: 1.3 }}>
      <Art name="heart" size={96} /></motion.div>
    {burst.map((_, index) => <motion.span key={index} className="reel-dot" style={{ background: index % 2 ? sun : clay }}
      initial={{ x: 0, y: -86, scale: 0 }} animate={{ x: Math.cos(index / 12 * Math.PI * 2) * 90, y: -86 + Math.sin(index / 12 * Math.PI * 2) * 90, scale: [0, 1, 0] }}
      transition={{ duration: 0.9, delay: 1.35, ease: 'easeOut' }} />)}
    <svg className="reel-trail" width="300" height="80" viewBox="0 0 300 80" aria-hidden="true">
      <motion.path d="M10 60 Q 80 10 150 45 T 290 30" stroke={sun} strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 1.8, ease: 'easeInOut' }} />
      {[[40, 44], [100, 30], [160, 46], [220, 40], [270, 30]].map(([x, y], index) => <motion.g key={index} initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 2 + index * 0.25 }} style={{ originX: `${x}px`, originY: `${y}px` }}>
        <circle cx={x} cy={y} r="4" fill={ink} /><circle cx={x - 5} cy={y - 6} r="2" fill={ink} /><circle cx={x + 5} cy={y - 6} r="2" fill={ink} />
      </motion.g>)}
    </svg>
    <motion.p className="reel-caption" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 2.2 }}>{caption}</motion.p>
  </div>;
}

function SceneFoster({ caption, steps }) {
  return <div className="reel-center">
    <div style={{ marginTop: -110 }}><Art name="house" size={250} /></div>
    <div className="reel-journey">
      <div className="reel-journey-track"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.6, delay: 2.2, ease: 'easeInOut' }} /></div>
      {steps.map((step, index) => <div key={step} className="reel-journey-step">
        <motion.span initial={{ scale: 0.4, backgroundColor: 'rgba(246,242,234,0.2)' }} animate={{ scale: 1, backgroundColor: sun }}
          transition={{ ...spring, delay: 2.3 + index * 0.4 }} />
        <motion.small initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 + index * 0.4 }}>{step}</motion.small>
      </div>)}
    </div>
    <motion.p className="reel-caption" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 3.2 }}>{caption}</motion.p>
  </div>;
}

function SceneCommunity({ caption }) {
  const icons = [PawPrint, Heart, Home, MessageCircle, Sun, ShieldCheck, Users, Star, Dog];
  const colors = [sage, clay, sun, ink, sage, clay, sun, ink, sage];
  return <div className="reel-center">
    <motion.div className="reel-grid" animate={{ scale: [1, 1, 0.2], rotate: [0, 0, 45], opacity: [1, 1, 0] }} transition={{ duration: 3, times: [0, 0.78, 1], ease: 'easeIn' }}>
      {icons.map((Icon, index) => <motion.div key={index} className="reel-tile" style={{ background: colors[index] }}
        initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 + ((index % 3) + Math.floor(index / 3)) * 0.12 }}>
        <Icon size={30} color="#1e2a23" strokeWidth={2.2} />
      </motion.div>)}
    </motion.div>
    <motion.p className="reel-caption" style={{ bottom: '16%' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: [0, 1, 1, 0], y: 0 }}
      transition={{ duration: 3, times: [0, 0.2, 0.8, 1], delay: 0.2 }}>{caption}</motion.p>
  </div>;
}

function SceneLockup({ tagline }) {
  return <div className="reel-center">
    <motion.div className="reel-reveal" initial={{ clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
    <motion.div className="reel-logo" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.7 }}>
      <Art name="heart" size={70} />
      <motion.span className="reel-logo-paw" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 1.1 }}><PawPrint size={18} /></motion.span>
    </motion.div>
    <motion.h1 className="reel-wordmark" initial={{ opacity: 0, y: 24, letterSpacing: '0.3em' }} animate={{ opacity: 1, y: 0, letterSpacing: '-0.03em' }}
      transition={{ ...soft, delay: 1.1 }}>PetPal</motion.h1>
    <motion.p className="reel-tagline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 0.6 }}>{tagline}</motion.p>
  </div>;
}

export default function IntroReel({ onDone }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  // Development only: ?reel=N opens scene N and holds it, for design review.
  const [hold] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('reel');
    return !isProductionBuild && value !== null ? Math.min(5, Math.max(0, Number(value) || 0)) : null;
  });
  const [short] = useState(() => hold === null && readSeen());
  const durations = short ? [FULL[5]] : FULL;
  const [scene, setScene] = useState(hold ?? 0);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = useCallback(() => { markSeen(); done.current(); }, []);
  const sceneCount = durations.length;
  const sceneDuration = durations[scene];

  // Advance only when the scene changes, so background re-renders never restart the clock.
  useEffect(() => {
    if (reduced || hold !== null) return undefined;
    const timer = setTimeout(() => (scene < sceneCount - 1 ? setScene(scene + 1) : finish()), sceneDuration);
    return () => clearTimeout(timer);
  }, [scene, sceneCount, sceneDuration, reduced, finish, hold]);

  const index = short ? 5 : scene;
  const words = [t('intro.word1'), t('intro.word2'), t('intro.word3'), t('intro.word4')];
  const scenes = [<SceneSpark />, <SceneWords words={words} />, <SceneMatch caption={t('intro.match')} />,
    <SceneFoster caption={t('intro.foster')} steps={[t('fx.stepOffered'), t('fx.stepAgreed'), t('fx.stepArrived'), t('fx.stepInCare')]} />,
    <SceneCommunity caption={t('intro.community')} />, <SceneLockup tagline={t('intro.tagline')} />];

  if (reduced) {
    return <div className="petpal-reel is-light" role="dialog" aria-label="PetPal">
      <SceneLockup tagline={t('intro.tagline')} />
      <button type="button" className="reel-start" onClick={finish}>{t('intro.start')}</button>
    </div>;
  }

  return <motion.div className={`petpal-reel ${index === 5 ? 'is-light' : ''}`} role="dialog" aria-label="PetPal"
    exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
    <motion.div className="reel-glow" animate={{ x: [-60, 50, -30], y: [-40, 30, 60], scale: [1, 1.3, 1] }} transition={{ duration: 12, repeat: Infinity, repeatType: 'mirror' }} />
    <div className="reel-progress" aria-hidden="true">{durations.map((duration, i) => <span key={i}>
      <motion.i initial={{ scaleX: i < scene ? 1 : 0 }} animate={{ scaleX: i <= scene ? 1 : 0 }}
        transition={{ duration: i === scene ? duration / 1000 : 0, ease: 'linear' }} /></span>)}</div>
    <button type="button" className="reel-skip" onClick={finish}>{t('intro.skip')}</button>
    <AnimatePresence mode="wait">
      <motion.div key={index} className="reel-scene" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        {scenes[index]}
      </motion.div>
    </AnimatePresence>
  </motion.div>;
}
