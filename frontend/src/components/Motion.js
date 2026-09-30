import React, { useEffect, useSyncExternalStore } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { useApp } from '../context/AppContext';

export const motionSpring = { type: 'spring', stiffness: 420, damping: 34, mass: 1 };

const motionQuery = '(prefers-reduced-motion: reduce)';
const readSystemMotion = () => window.matchMedia(motionQuery).matches;
const subscribeSystemMotion = changed => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};

export function useReducedPetMotion() {
  const systemReduced = useSyncExternalStore(subscribeSystemMotion, readSystemMotion, () => false);
  const { reduceMotion } = useApp();
  return Boolean(systemReduced || reduceMotion);
}

export function PetMotionProvider({ children }) {
  const reduced = useReducedPetMotion();
  useEffect(() => {
    document.documentElement.dataset.petpalReducedMotion = String(reduced);
    return () => { delete document.documentElement.dataset.petpalReducedMotion; };
  }, [reduced]);
  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'} transition={motionSpring}>{children}</MotionConfig>;
}

export function SavedCheck() {
  const reduced = useReducedPetMotion();
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#E3ECE4" />
    <motion.path d="m7 12 3 3 7-7" stroke="#2C402B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
  </svg>;
}
