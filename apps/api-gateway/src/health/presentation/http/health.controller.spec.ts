import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns the gateway health status', () => {
    const response = controller.check();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('api-gateway');
    expect(response.timestamp).toBeDefined();
    expect(response.uptime).toEqual(expect.any(Number));
  });
});
