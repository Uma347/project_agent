import { AgentQuoteService } from '../../application/agent-quote.service';
import { AgentQuoteController } from './agent-quote.controller';

describe('AgentQuoteController', () => {
  const create = jest.fn();
  const approve = jest.fn();
  const reject = jest.fn();
  const execute = jest.fn();
  const agentQuoteService = {
    create,
    approve,
    reject,
    execute,
  } as unknown as jest.Mocked<AgentQuoteService>;
  let controller: AgentQuoteController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AgentQuoteController(agentQuoteService);
  });

  it('delegates quote creation', () => {
    const payload = { prompt: 'quiero comprar dos hamburguesas' };
    create.mockReturnValue({ id: 'quote-id' });

    expect(controller.create(payload)).toEqual({ id: 'quote-id' });
    expect(create).toHaveBeenCalledWith(payload);
  });

  it('delegates quote approval', () => {
    const payload = { approvedBy: 'human-operator-1' };
    approve.mockReturnValue({ id: 'quote-id' });

    expect(controller.approve('quote-id', payload)).toEqual({ id: 'quote-id' });
    expect(approve).toHaveBeenCalledWith('quote-id', payload);
  });

  it('delegates quote rejection', () => {
    const payload = { rejectedBy: 'human-operator-1' };
    reject.mockReturnValue({ id: 'quote-id' });

    expect(controller.reject('quote-id', payload)).toEqual({ id: 'quote-id' });
    expect(reject).toHaveBeenCalledWith('quote-id', payload);
  });

  it('delegates quote execution', () => {
    const payload = { executedBy: 'human-operator-1' };
    execute.mockReturnValue({ id: 'quote-id' });

    expect(controller.execute('quote-id', payload)).toEqual({ id: 'quote-id' });
    expect(execute).toHaveBeenCalledWith('quote-id', payload);
  });
});
