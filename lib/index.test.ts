import test from 'node:test';
import assert from 'node:assert';
import retry from './index.js';

class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError';
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

test('should execute function successfully without retries', async () => {
  const mockFn = async (value: string) => `success: ${value}`;
  const retryFn = retry(mockFn);
  
  const result = await retryFn('test');
  assert.strictEqual(result, 'success: test');
});

test('should pass arguments correctly to wrapped function', async () => {
  const mockFn = async (a: number, b: string, c: boolean) => ({ a, b, c });
  const retryFn = retry(mockFn);
  
  const result = await retryFn(42, 'hello', true);
  assert.deepStrictEqual(result, { a: 42, b: 'hello', c: true });
});

test('should retry on failure and eventually succeed', async () => {
  let attempts = 0;
  const mockFn = async (value: string) => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return `success: ${value}`;
  };
  
  const retryFn = retry(mockFn);
  const result = await retryFn('test');
  
  assert.strictEqual(result, 'success: test');
  assert.strictEqual(attempts, 3);
});

test('should respect maxAttempts option', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    throw new Error('Always fails');
  };
  
  const retryFn = retry(mockFn, { maxAttempts: 2 });
  
  await assert.rejects(retryFn(), /Always fails/);
  assert.strictEqual(attempts, 2);
});

test('should use custom interval', async () => {
  let attempts = 0;
  const startTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { intervals: 100 });
  await retryFn();
  
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed >= 200, `Expected at least 200ms, got ${elapsed}ms`);
  assert.strictEqual(attempts, 3);
});

test('should apply backoff correctly', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 4) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { intervals: 100, backoff: 2, maxAttempts: 4 });
  await retryFn();
  
  assert.strictEqual(attempts, 4);
  assert.strictEqual(delays.length, 3);
  assert.ok(delays[0] >= 90 && delays[0] < 150, `First delay: ${delays[0]}ms`);
  assert.ok(delays[1] >= 190 && delays[1] < 250, `Second delay: ${delays[1]}ms`);
  assert.ok(delays[2] >= 390 && delays[2] < 450, `Third delay: ${delays[2]}ms`);
});

test('should only retry specific error types when specified', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    if (attempts === 1) {
      throw new CustomError('Custom error');
    }
    if (attempts === 2) {
      throw new NetworkError('Network error');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { errors: ['CustomError'] });
  
  await assert.rejects(retryFn(), /Network error/);
  assert.strictEqual(attempts, 2);
});

test('should retry multiple specified error types', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    if (attempts === 1) {
      throw new CustomError('Custom error');
    }
    if (attempts === 2) {
      throw new NetworkError('Network error');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { errors: ['CustomError', 'NetworkError'] });
  const result = await retryFn();
  
  assert.strictEqual(result, 'success');
  assert.strictEqual(attempts, 3);
});

test('should not retry non-specified error types', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    throw new Error('Generic error');
  };
  
  const retryFn = retry(mockFn, { errors: ['CustomError'] });
  
  await assert.rejects(retryFn(), /Generic error/);
  assert.strictEqual(attempts, 1);
});

test('should handle synchronous functions', async () => {
  let attempts = 0;
  const mockFn = (value: string) => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return `success: ${value}`;
  };
  
  const retryFn = retry(mockFn);
  const result = await retryFn('test');
  
  assert.strictEqual(result, 'success: test');
  assert.strictEqual(attempts, 3);
});

test('should handle functions that throw non-Error objects', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw 'String error';
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn);
  const result = await retryFn();
  
  assert.strictEqual(result, 'success');
  assert.strictEqual(attempts, 3);
});

test('should use default options when none provided', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn);
  const result = await retryFn();
  
  assert.strictEqual(result, 'success');
  assert.strictEqual(attempts, 3);
});

test('should handle zero intervals', async () => {
  let attempts = 0;
  const startTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { intervals: 0 });
  await retryFn();
  
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 50, `Expected less than 50ms, got ${elapsed}ms`);
  assert.strictEqual(attempts, 3);
});

test('should handle maxAttempts of 1', async () => {
  let attempts = 0;
  const mockFn = async () => {
    attempts++;
    throw new Error('Always fails');
  };
  
  const retryFn = retry(mockFn, { maxAttempts: 1 });
  
  await assert.rejects(retryFn(), /Always fails/);
  assert.strictEqual(attempts, 1);
});

test('should respect maxInterval option', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 4) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { 
    intervals: 1000, 
    backoff: 3, 
    maxAttempts: 4, 
    maxInterval: 2000 
  });
  await retryFn();
  
  assert.strictEqual(attempts, 4);
  assert.strictEqual(delays.length, 3);
  assert.ok(delays[0] >= 950 && delays[0] < 1100, `First delay: ${delays[0]}ms`);
  assert.ok(delays[1] >= 1950 && delays[1] < 2100, `Second delay capped: ${delays[1]}ms`);
  assert.ok(delays[2] >= 1950 && delays[2] < 2100, `Third delay capped: ${delays[2]}ms`);
});

test('should apply jitter when enabled', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 4) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { 
    intervals: 1000, 
    backoff: 2, 
    maxAttempts: 4, 
    jitter: true 
  });
  await retryFn();
  
  assert.strictEqual(attempts, 4);
  assert.strictEqual(delays.length, 3);
  assert.ok(delays[0] >= 800 && delays[0] < 1200, `First delay with jitter: ${delays[0]}ms`);
  assert.ok(delays[1] >= 1600 && delays[1] < 2400, `Second delay with jitter: ${delays[1]}ms`);
  assert.ok(delays[2] >= 3200 && delays[2] < 4800, `Third delay with jitter: ${delays[2]}ms`);
});

test('should combine jitter and maxInterval', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 4) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { 
    intervals: 1000, 
    backoff: 4, 
    maxAttempts: 4, 
    maxInterval: 3000,
    jitter: true 
  });
  await retryFn();
  
  assert.strictEqual(attempts, 4);
  assert.strictEqual(delays.length, 3);
  assert.ok(delays[0] >= 800 && delays[0] < 1200, `First delay with jitter: ${delays[0]}ms`);
  assert.ok(delays[1] >= 2400 && delays[1] < 3600, `Second delay with jitter and cap: ${delays[1]}ms`);
  assert.ok(delays[2] >= 2400 && delays[2] < 3600, `Third delay with jitter and cap: ${delays[2]}ms`);
});

test('should not apply jitter when disabled (default)', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { intervals: 1000, backoff: 2 });
  await retryFn();
  
  assert.strictEqual(attempts, 3);
  assert.strictEqual(delays.length, 2);
  assert.ok(delays[0] >= 950 && delays[0] < 1100, `First delay should be ~1000ms: ${delays[0]}ms`);
  assert.ok(delays[1] >= 1950 && delays[1] < 2100, `Second delay should be ~2000ms: ${delays[1]}ms`);
});

test('should handle maxInterval without jitter', async () => {
  let attempts = 0;
  const delays: number[] = [];
  let lastTime = Date.now();
  
  const mockFn = async () => {
    attempts++;
    const currentTime = Date.now();
    if (attempts > 1) {
      delays.push(currentTime - lastTime);
    }
    lastTime = currentTime;
    
    if (attempts < 4) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };
  
  const retryFn = retry(mockFn, { 
    intervals: 1000, 
    backoff: 5, 
    maxAttempts: 4, 
    maxInterval: 3000 
  });
  await retryFn();
  
  assert.strictEqual(attempts, 4);
  assert.strictEqual(delays.length, 3);
  assert.ok(delays[0] >= 950 && delays[0] < 1100, `First delay: ${delays[0]}ms`);
  assert.ok(delays[1] >= 2950 && delays[1] < 3100, `Second delay capped: ${delays[1]}ms`);
  assert.ok(delays[2] >= 2950 && delays[2] < 3100, `Third delay capped: ${delays[2]}ms`);
});
