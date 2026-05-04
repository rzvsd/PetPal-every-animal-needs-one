import { MainTab } from './navigation';

export type AppRoute =
  | { name: 'entry' }
  | { name: 'tabs'; tab: MainTab }
  | { name: 'animalEditor'; animalId?: string }
  | { name: 'matchDetail'; candidateId: string }
  | { name: 'matchSuccess'; candidateId: string; conversationId: string }
  | { name: 'fosterDetail'; fosterCaseId: string }
  | { name: 'fosterApplication'; fosterCaseId: string }
  | { name: 'conversation'; conversationId: string };
