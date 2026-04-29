import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';
import { demoAnimals, demoMatchCandidates, demoFosterCases, demoConversations, demoFosterApplications, demoUser } from '../data/mockData';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [activeTab, setActiveTab] = useState('matches');
  const [user, setUser] = useState(demoUser);
  const [myAnimals, setMyAnimals] = useState(demoAnimals);
  const [selectedAnimalId, setSelectedAnimalId] = useState(demoAnimals[0]?.id || null);
  const [matchMode, setMatchMode] = useState('PLAY');
  const [candidates, setCandidates] = useState(demoMatchCandidates);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [matchSuccess, setMatchSuccess] = useState(null);
  const [savedAnimals, setSavedAnimals] = useState([]);
  const [fosterCases] = useState(demoFosterCases);
  const [fosterApplications, setFosterApplications] = useState(demoFosterApplications);
  const [conversations, setConversations] = useState(demoConversations);
  const [rescuerAccessState, setRescuerAccessState] = useState('not_requested');
  const [activeScreen, setActiveScreen] = useState(null);
  const [screenParams, setScreenParams] = useState(null);

  const t = useCallback((path) => {
    const keys = path.split('.');
    let result = translations[lang];
    for (const key of keys) {
      result = result?.[key];
    }
    return result || path;
  }, [lang]);

  const toggleLang = () => setLang(l => l === 'en' ? 'ro' : 'en');

  const selectedAnimal = myAnimals.find(a => a.id === selectedAnimalId);

  const handleLike = (candidate) => {
    if (candidate.hasLikedBack) {
      setMatchSuccess({
        myAnimal: selectedAnimal,
        theirAnimal: candidate.animal,
        mode: candidate.mode,
      });
      const newConv = {
        id: `conv-match-${candidate.animal.id}`,
        source: 'MATCH',
        title: `${selectedAnimal.name} + ${candidate.animal.name}`,
        subtitle: candidate.mode === 'VERIFIED_MATE' ? t('matches.verifiedMate') : candidate.mode === 'PLAY' ? t('matches.play') : t('matches.social'),
        contextLabel: 'This chat opened after a mutual match.',
        privacyLabel: 'Exact location stays private.',
        animalName: selectedAnimal.name,
        relatedAnimalName: candidate.animal.name,
        mode: candidate.mode,
        ownerVerified: candidate.ownerVerificationStatus === 'VERIFIED',
        city: candidate.animal.city,
        coarseArea: candidate.animal.coarseArea,
        lastMessage: 'Say hello!',
        lastMessageAt: new Date().toISOString(),
        unread: 0,
        messages: [],
      };
      setConversations(prev => {
        if (prev.find(c => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });
    }
    setCurrentCardIndex(i => i + 1);
  };

  const handlePass = () => setCurrentCardIndex(i => i + 1);

  const handleSave = (candidate) => {
    setSavedAnimals(prev => [...prev, candidate.animal.id]);
  };

  const submitFosterApplication = (caseId, formData) => {
    const fcase = fosterCases.find(c => c.id === caseId);
    const newApp = {
      id: `app-${Date.now()}`,
      fosterCaseId: caseId,
      animalName: fcase?.animalName || 'Animal',
      rescuerName: fcase?.rescuerName || 'Rescuer',
      applicantId: 'user-demo',
      status: 'SUBMITTED',
      ...formData,
      createdAt: new Date().toISOString(),
    };
    setFosterApplications(prev => [...prev, newApp]);
    return newApp;
  };

  const sendMessage = (convId, body) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const msg = {
        messageId: `m-${Date.now()}`,
        senderDisplayName: 'You',
        body,
        createdAt: new Date().toISOString(),
        isMine: true,
      };
      return { ...c, messages: [...c.messages, msg], lastMessage: body, lastMessageAt: msg.createdAt };
    }));
  };

  const navigate = (screen, params = null) => {
    setActiveScreen(screen);
    setScreenParams(params);
  };

  const goBack = () => {
    setActiveScreen(null);
    setScreenParams(null);
  };

  return (
    <AppContext.Provider value={{
      lang, t, toggleLang,
      activeTab, setActiveTab,
      user, setUser,
      myAnimals, setMyAnimals, selectedAnimalId, setSelectedAnimalId, selectedAnimal,
      matchMode, setMatchMode,
      candidates, setCandidates, currentCardIndex, setCurrentCardIndex,
      matchSuccess, setMatchSuccess,
      savedAnimals, handleLike, handlePass, handleSave,
      fosterCases, fosterApplications, submitFosterApplication,
      conversations, sendMessage,
      rescuerAccessState, setRescuerAccessState,
      activeScreen, screenParams, navigate, goBack,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
