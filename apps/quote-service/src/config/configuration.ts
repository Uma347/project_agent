export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  nats: {
    servers: (process.env.NATS_SERVERS ?? 'nats://localhost:4222')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean),
    queue: process.env.NATS_QUEUE ?? 'quote-service',
    requestTimeoutMs: Number(process.env.NATS_REQUEST_TIMEOUT_MS ?? 5000),
  },
  quote: {
    expirationMinutes: Number(process.env.QUOTE_EXPIRATION_MINUTES ?? 10),
  },
});
