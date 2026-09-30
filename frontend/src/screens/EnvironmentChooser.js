import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Home, MessageCircle, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { motionSpring, PetGreeting, useReducedPetMotion } from '../components/Motion';
import { FOSTER_ENVIRONMENT, MATCH_ENVIRONMENT } from '../navigation/environments';

function EnvironmentCard({ icon: Icon, title, description, action, tone, onClick, testId, reducedMotion, delay, unread, unreadLabel }) {
  const isMatch = tone === 'match';

  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={onClick}
      initial={reducedMotion ? false : { opacity: 0, y: 28, rotate: isMatch ? -2 : 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={reducedMotion ? { duration: 0 } : { ...motionSpring, delay }}
      className="w-full rounded-2xl border border-[#E4E2DC] bg-white p-5 text-left shadow-sm transition-all hover:border-[#9BAE96] hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${
          isMatch ? 'bg-[#E3ECE4]' : 'bg-[#F5DDD0]'
        }`}>
          <Icon size={25} className={isMatch ? 'text-[#2C402B]' : 'text-[#8B4C2F]'} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-bold text-[#1F2924]">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#57645C]">{description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 items-center rounded-xl bg-[#2C402B] px-4 py-2.5 text-sm font-semibold text-white">
              {action}
            </span>
            {unread > 0 && <span aria-label={`${unread} ${unreadLabel}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--pp-clay)] px-2.5 py-1 text-xs font-bold text-white"><MessageCircle size={13} aria-hidden="true" />{unread}</span>}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function EnvironmentChooser({ onSelect }) {
  const { t, messaging, dataSource } = useApp();
  const reducedMotion = useReducedPetMotion();
  const unread = dataSource === 'supabase' ? messaging.unreadTotals : {};

  return (
    <div data-testid="environment-chooser" className="min-h-0 flex-1 overflow-y-auto no-scrollbar bg-[var(--pp-bg)] px-5 py-7">
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center">
        <div className="mb-5 text-center">
          <PetGreeting />
          <motion.h1 initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { ...motionSpring, delay: 0.05 }} className="mt-2 font-heading text-3xl font-bold text-[#1F2924]">{t('environment.title')}</motion.h1>
          <motion.p initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { ...motionSpring, delay: 0.08 }} className="mx-auto mt-2 max-w-[310px] text-sm leading-relaxed text-[#57645C]">
            {t('environment.subtitle')}
          </motion.p>
        </div>

        <div className="space-y-3">
          <EnvironmentCard
            icon={Heart}
            title={t('environment.matchTitle')}
            description={t('environment.matchDescription')}
            action={t('environment.matchAction')}
            tone="match"
            testId="choose-match-environment"
            reducedMotion={reducedMotion}
            delay={0.1}
            unread={unread.MATCH}
            unreadLabel={t('messages.unreadMessages')}
            onClick={() => onSelect(MATCH_ENVIRONMENT)}
          />
          <EnvironmentCard
            icon={Home}
            title={t('environment.fosterTitle')}
            description={t('environment.fosterDescription')}
            action={t('environment.fosterAction')}
            tone="foster"
            testId="choose-foster-environment"
            reducedMotion={reducedMotion}
            delay={0.16}
            unread={unread.FOSTER}
            unreadLabel={t('messages.unreadMessages')}
            onClick={() => onSelect(FOSTER_ENVIRONMENT)}
          />
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#D8EAF0] bg-[#D8EAF0]/35 px-3 py-2.5">
          <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-[#3A7080]" />
          <p className="text-xs leading-relaxed text-[#3A7080]">{t('environment.switchNote')}</p>
        </div>
      </div>
    </div>
  );
}
