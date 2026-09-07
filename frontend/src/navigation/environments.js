export const MATCH_ENVIRONMENT = 'match';
export const FOSTER_ENVIRONMENT = 'foster';

export function getEnvironmentHomeTab(environment) {
  return environment === FOSTER_ENVIRONMENT ? 'foster' : 'matches';
}

export function getEnvironmentConversationSource(environment) {
  return environment === FOSTER_ENVIRONMENT ? 'FOSTER' : 'MATCH';
}

export function getEnvironmentConversations(conversations, environment) {
  const source = getEnvironmentConversationSource(environment);
  return conversations.filter((conversation) => conversation.source === source);
}
