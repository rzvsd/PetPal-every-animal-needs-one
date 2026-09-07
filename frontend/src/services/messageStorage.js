const prefix = 'petpal-chat:';
const key = accountId => `${prefix}${accountId}`;

export function readChatStorage(accountId) {
  if (!accountId) return { outbox: [], drafts: {} };
  const raw = window.localStorage.getItem(key(accountId));
  if (!raw) return { outbox: [], drafts: {} };
  const data = JSON.parse(raw);
  if (!Array.isArray(data.outbox) || !data.drafts || typeof data.drafts !== 'object') {
    throw new Error('Chat storage is invalid');
  }
  return {
    drafts: data.drafts,
    // Restarted sends have an uncertain outcome; retry must use the same ID.
    outbox: data.outbox.map(message => ({ ...message, status: 'failed' })),
  };
}

export function writeChatStorage(accountId, value) {
  if (accountId) window.localStorage.setItem(key(accountId), JSON.stringify(value));
}

export function clearChatStorage(accountId) {
  if (accountId) window.localStorage.removeItem(key(accountId));
}

export function mergeMessages(current, incoming) {
  const byId = new Map(current.map(message => [message.messageId, message]));
  incoming.forEach(message => byId.set(message.messageId, message));
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

export function reconcileOutbox(outbox, messages) {
  const accepted = new Set(messages.filter(message => message.isMine).map(message => message.clientMessageId).filter(Boolean));
  return outbox.filter(message => !accepted.has(message.clientMessageId));
}
