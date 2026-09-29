import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Heart, PawPrint } from 'lucide-react';
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

export function PetGreeting() {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const [greeting, setGreeting] = useState(0);
  return <button type="button" className="petpal-greeting" aria-label={t('motion.sayHello')} disabled={reduced}
    onClick={() => { if (!reduced) setGreeting(value => value + 1); }}>
    <svg key={greeting} viewBox="0 0 300 180" fill="none" aria-hidden="true" focusable="false">
      <path d="M30 133C9 101 38 33 99 32C137 0 188 14 207 37C263 26 292 85 267 137Z" fill="#E3ECE4" />
      <circle cx="236" cy="43" r="21" fill="#F2CD98" />
      <path className="greeting-trail" d="M34 129Q56 73 150 87T267 113" stroke="#92AD98" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 9" />
      <ellipse cx="151" cy="155" rx="111" ry="10" fill="#CBDCCB" />
      <g className="greeting-dog">
        <path className="greeting-tail" d="M78 136C44 130 47 106 55 102C62 99 62 124 84 122" fill="#B67650" />
        <path d="M84 104C69 124 75 144 76 151H141C145 130 142 115 130 105" fill="#CE986A" />
        <path d="M100 116Q111 135 109 153H133L127 119" fill="#F9E5C6" />
        <path d="M86 129V153M130 132V153" stroke="#8D583D" strokeWidth="4" strokeLinecap="round" />
        <g className="greeting-dog-head">
          <path d="M83 64C64 52 60 82 66 101C70 111 84 101 90 86M129 62C149 55 157 90 144 102L130 85" fill="#88583F" />
          <path d="M80 75C78 42 136 42 139 76L142 93C144 122 77 125 76 96Z" fill="#DCAA79" />
          <ellipse cx="109" cy="96" rx="22" ry="17" fill="#FFF0D8" />
          <g className="greeting-eyes" fill="#293C31"><circle cx="94" cy="81" r="3.5" /><circle cx="124" cy="81" r="3.5" /></g>
          <path d="M102 91Q109 87 117 91L110 99Z" fill="#293C31" />
          <path d="M110 99V105Q101 109 98 103M110 105Q118 109 122 103" stroke="#293C31" strokeWidth="2" strokeLinecap="round" />
          <path className="greeting-tongue" d="M106 108H116V115C116 123 106 123 106 115Z" fill="#CB7E74" />
        </g>
        <path d="M84 118Q109 126 135 115" stroke="#356A54" strokeWidth="7" strokeLinecap="round" />
        <circle cx="112" cy="124" r="5" fill="#F2CD98" />
      </g>
      <g className="greeting-cat">
        <path className="greeting-cat-tail" d="M210 145C247 157 245 112 231 119" stroke="#748E81" strokeWidth="12" strokeLinecap="round" />
        <path d="M172 106Q156 126 163 153H216Q222 125 205 106" fill="#91A99B" />
        <path d="M181 121L179 153M197 122L200 153" stroke="#5A7565" strokeWidth="4" strokeLinecap="round" />
        <path d="M160 83L160 50L180 64Q190 61 200 65L221 50L218 87C231 126 151 128 160 83Z" fill="#A8BCAE" />
        <path d="M165 61L167 80L178 70M215 61L213 80L202 70" fill="#E6B8A2" />
        <g className="greeting-eyes" fill="#293C31"><ellipse cx="175" cy="88" rx="3" ry="4" /><ellipse cx="203" cy="88" rx="3" ry="4" /></g>
        <path d="M185 97H194L189 102Z" fill="#A86759" />
        <path d="M189 102V107M183 107Q189 113 196 107M173 99L151 95M173 104L150 105M207 99L230 95M207 104L230 105" stroke="#466353" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <g className="greeting-spark" stroke="#B67650" strokeWidth="3" strokeLinecap="round"><path d="M143 31V41M138 36H148M51 60V68M47 64H55" /></g>
    </svg>
    <span><PawPrint size={12} />{t('motion.sayHello')}</span>
  </button>;
}

let entranceShown = false;

export function BrandEntrance({ skip = false }) {
  const reduced = useReducedPetMotion();
  const [visible, setVisible] = useState(() => !entranceShown);
  useEffect(() => {
    entranceShown = true;
    if (skip || reduced) { setVisible(false); return undefined; }
    const timer = setTimeout(() => setVisible(false), 800);
    return () => clearTimeout(timer);
  }, [skip, reduced]);
  if (!visible || reduced || skip) return null;
  return <motion.div aria-hidden="true" className="petpal-entrance"
    initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.48, duration: 0.28 }}>
    <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} transition={motionSpring}>
      <div className="petpal-entrance-mark"><Heart size={34} strokeWidth={1.7} />
        {[-1, 1].map((side, index) => <motion.span key={side} className="petpal-entrance-paw"
          initial={{ x: side * 28, y: 12, opacity: 0 }} animate={{ x: side * 38, y: -24, opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, delay: index * 0.08 }}><PawPrint size={14} /></motion.span>)}
      </div><span className="font-heading">PetPal</span>
    </motion.div>
  </motion.div>;
}
