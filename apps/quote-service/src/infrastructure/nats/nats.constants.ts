export const NATS_CLIENT = Symbol('NATS_CLIENT');

export const NATS_SUBJECTS = {
  AI_INTENT_INTERPRET: 'ai.intent.interpret',
  CATALOG_PRODUCTS_SEARCH: 'catalog.products.search',
  PAYMENT_SIMULATE_EXECUTE: 'payment.simulate.execute',
  QUOTE_CREATE: 'agent.quote.create',
  QUOTE_APPROVE: 'agent.quote.approve',
  QUOTE_REJECT: 'agent.quote.reject',
  QUOTE_EXECUTE: 'agent.quote.execute',
} as const;
