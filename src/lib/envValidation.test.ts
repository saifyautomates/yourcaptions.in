import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getValidatedApiKey, getConfiguredApiKeys } from './envValidation';
import * as errorMonitor from './errorMonitor';

vi.mock('./errorMonitor', () => ({
  reportError: vi.fn(),
}));

describe('envValidation', () => {
  const originalProcessEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalProcessEnv };
  });

  afterEach(() => {
    process.env = originalProcessEnv;
  });

  it('should return the key if it exists in process.env', () => {
    process.env['OPENAI_API_KEY'] = 'test-key-123';
    const key = getValidatedApiKey('OpenAI', 'OPENAI_API_KEY');
    expect(key).toBe('test-key-123');
    expect(errorMonitor.reportError).not.toHaveBeenCalled();
  });

  it('should log an error to errorMonitor if the key is missing', () => {
    delete process.env['DEEPGRAM_API_KEY'];
    const key = getValidatedApiKey('Deepgram', 'DEEPGRAM_API_KEY');
    
    expect(key).toBe('');
    expect(errorMonitor.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        severity: 'critical',
        context: { service: 'Deepgram', envVarName: 'DEEPGRAM_API_KEY' },
        functionName: 'getValidatedApiKey'
      })
    );
  });
});
