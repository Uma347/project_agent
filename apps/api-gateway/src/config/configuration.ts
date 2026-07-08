export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
  },
  swagger: {
    title: process.env.SWAGGER_TITLE ?? 'Qhantuy API Gateway',
    description:
      process.env.SWAGGER_DESCRIPTION ??
      'HTTP REST API Gateway for Qhantuy microservices.',
    version: process.env.SWAGGER_VERSION ?? '1.0.0',
    path: process.env.SWAGGER_PATH ?? 'docs',
  },
  nats: {
    servers: (process.env.NATS_SERVERS ?? 'nats://localhost:4222')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean),
    timeoutMs: Number(process.env.NATS_REQUEST_TIMEOUT_MS ?? 5000),
  },
});
