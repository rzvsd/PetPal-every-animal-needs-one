import { useState } from 'react';

import { demoAnimals } from '../data/demoAnimals';
import {
  animalDraftFromProfile,
  createAnimalFromDraft,
  defaultAnimalDraft,
  updateAnimalFromDraft,
} from '../domain/animalFactory';
import { AnimalProfileDraft } from '../types/petpal';

export function useMyAnimals() {
  const [animals, setAnimals] = useState(demoAnimals);
  const [selectedAnimalId, setSelectedAnimalId] = useState(demoAnimals[0]?.id ?? '');
  const [animalDraft, setAnimalDraft] = useState<AnimalProfileDraft>(defaultAnimalDraft);

  const selectedAnimal = animals.find((animal) => animal.id === selectedAnimalId) ?? animals[0] ?? null;

  function prepareAnimalDraft(animalId?: string) {
    const animal = animalId ? animals.find((item) => item.id === animalId) ?? null : null;
    setAnimalDraft(animalDraftFromProfile(animal));
  }

  function saveAnimalDraft(animalId?: string) {
    if (animalId) {
      const existing = animals.find((animal) => animal.id === animalId);
      if (!existing) return null;

      const updated = updateAnimalFromDraft(existing, animalDraft);
      setAnimals((current) => current.map((animal) => (animal.id === animalId ? updated : animal)));
      setSelectedAnimalId(updated.id);
      return updated;
    }

    const nextAnimal = createAnimalFromDraft(animalDraft);
    setAnimals((current) => [...current, nextAnimal]);
    setSelectedAnimalId(nextAnimal.id);
    return nextAnimal;
  }

  return {
    animalDraft,
    animals,
    prepareAnimalDraft,
    saveAnimalDraft,
    selectAnimal: setSelectedAnimalId,
    selectedAnimal,
    selectedAnimalId,
    setAnimalDraft,
  };
}
