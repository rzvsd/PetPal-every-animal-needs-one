import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from '../components/Motion';
import { Art, Count } from '../ui/kit';
import { list, listItem } from '../ui/motion';
import { FOSTER_ENVIRONMENT, MATCH_ENVIRONMENT } from '../navigation/environments';

const SPACES = [
  [MATCH_ENVIRONMENT, 'dog', 'environment.matchTitle', 'environment.matchDescription', 'MATCH'],
  [FOSTER_ENVIRONMENT, 'house', 'environment.fosterTitle', 'environment.fosterDescription', 'FOSTER'],
];

export default function EnvironmentChooser({ onSelect }) {
  const { t, messaging, dataSource, user } = useApp();
  const reduced = useReducedPetMotion();
  const unread = dataSource === 'supabase' ? messaging.unreadTotals : {};
  const name = user?.displayName;

  return <main data-testid="environment-chooser" className="pp-chooser ui-scroll">
    <motion.div className="pp-chooser-inner" variants={list} initial={reduced ? false : 'hidden'} animate="show">
      <motion.header variants={listItem} className="pp-chooser-head">
        <p className="ui-overline">{name ? `${t('environment.hello')}, ${name}` : 'PetPal'}</p>
        <h1 className="ui-title-xl">{t('environment.title')}</h1>
        <p className="ui-lede">{t('environment.subtitle')}</p>
      </motion.header>
      <div className="pp-chooser-options">
        {SPACES.map(([key, art, title, description, source]) => <motion.button type="button" key={key} variants={listItem}
          data-testid={`choose-${key}-environment`} className="pp-chooser-option" onClick={() => onSelect(key)}
          whileTap={reduced ? undefined : { scale: 0.98 }}>
          <Art name={art} size={88} />
          <span className="pp-chooser-text">
            <span className="ui-title-l">{t(title)}</span>
            <span className="ui-small">{t(description)}</span>
          </span>
          <span className="pp-chooser-go">
            <Count value={unread[source]} />
            <ArrowRight size={22} aria-hidden="true" />
          </span>
        </motion.button>)}
      </div>
      <motion.p variants={listItem} className="ui-small pp-chooser-note">{t('environment.switchNote')}</motion.p>
    </motion.div>
  </main>;
}
