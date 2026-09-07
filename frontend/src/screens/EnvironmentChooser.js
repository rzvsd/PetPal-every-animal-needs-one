import React from 'react';
import { Heart, Home, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FOSTER_ENVIRONMENT, MATCH_ENVIRONMENT } from '../navigation/environments';

function EnvironmentCard({ icon: Icon, title, description, action, tone, onClick, testId }) {
  const isMatch = tone === 'match';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
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
          <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#2C402B] px-4 py-2.5 text-sm font-semibold text-white">
            {action}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function EnvironmentChooser({ onSelect }) {
  const { t } = useApp();

  return (
    <div data-testid="environment-chooser" className="min-h-0 flex-1 overflow-y-auto no-scrollbar bg-[#F8F7F4] px-5 py-7">
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#E3ECE4]">
            <Heart size={30} className="text-[#2C402B]" fill="#9BAE96" />
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold text-[#1F2924]">{t('environment.title')}</h1>
          <p className="mx-auto mt-2 max-w-[310px] text-sm leading-relaxed text-[#57645C]">
            {t('environment.subtitle')}
          </p>
        </div>

        <div className="space-y-3">
          <EnvironmentCard
            icon={Heart}
            title={t('environment.matchTitle')}
            description={t('environment.matchDescription')}
            action={t('environment.matchAction')}
            tone="match"
            testId="choose-match-environment"
            onClick={() => onSelect(MATCH_ENVIRONMENT)}
          />
          <EnvironmentCard
            icon={Home}
            title={t('environment.fosterTitle')}
            description={t('environment.fosterDescription')}
            action={t('environment.fosterAction')}
            tone="foster"
            testId="choose-foster-environment"
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
