import {
  FOSTER_ENVIRONMENT,
  MATCH_ENVIRONMENT,
  getEnvironmentConversationSource,
  getEnvironmentConversations,
  getEnvironmentHomeTab,
} from './environments';

const conversations = [
  { id: 'match-1', source: 'MATCH' },
  { id: 'foster-1', source: 'FOSTER' },
  { id: 'match-2', source: 'MATCH' },
];

test('maps each environment to its own home and conversation source', () => {
  expect(getEnvironmentHomeTab(MATCH_ENVIRONMENT)).toBe('matches');
  expect(getEnvironmentConversationSource(MATCH_ENVIRONMENT)).toBe('MATCH');
  expect(getEnvironmentHomeTab(FOSTER_ENVIRONMENT)).toBe('foster');
  expect(getEnvironmentConversationSource(FOSTER_ENVIRONMENT)).toBe('FOSTER');
});

test('keeps match and foster conversations in separate inboxes', () => {
  expect(getEnvironmentConversations(conversations, MATCH_ENVIRONMENT).map(({ id }) => id))
    .toEqual(['match-1', 'match-2']);
  expect(getEnvironmentConversations(conversations, FOSTER_ENVIRONMENT).map(({ id }) => id))
    .toEqual(['foster-1']);
});
