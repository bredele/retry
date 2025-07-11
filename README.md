# retry

Elegant Retry mechanism with max attempts, intervals and exponential backoff rate. Wrap any async method (or sync method) and get an async callback that automatically retries on failure with configurable retry logic.

## Installation

```sh
npm install @bredele/retry
```

## Usage

```ts
import retry from "@bredele/retry";

// Wrap an async function - retries 3 times with 1s intervals and 2x backoff
const retriableFunction = retry(asyncMethod);
await retriableFunction();

// Pass arguments through to the wrapped function
const retriableWithArgs = retry(async (id: string, options: object) => {
  return await api.getData(id, options);
});
await retriableWithArgs("user123", { timeout: 5000 });
```

## API

`retry(fn, options?): AsyncFunction`

- `fn` - The function to wrap (async or sync)
- `options` - Optional configuration object
  - `errors?: string[]` List of error names to retry. If not specified, retries all errors
  - `intervals?: number` Base retry interval in milliseconds
  - `backoff?: number` Exponential backoff multiplier
  - `maxAttempts?: number` Maximum number of attempts (including the initial attempt)
  - `maxInterval?: number` Maximum delay between retries (prevents infinite growth)
  - `jitter?: boolean` Add ±20% randomness to delays (prevents thundering herd)

## Notes

### Error Filtering

When `errors` is specified, only errors with matching names will trigger retries:

```ts
// Only retry specific error types
const retriableFunction = retry(asyncMethod, {
  errors: ["NetworkError", "TimeoutError"],
});

// This will retry on NetworkError but not on ValidationError
```

### Exponential Backoff

The retry intervals follow an exponential backoff pattern:

- 1st retry: `intervals` ms
- 2nd retry: `intervals * backoff` ms
- 3rd retry: `intervals * backoff²` ms
- And so on...

```ts
// With intervals: 1000, backoff: 2
// Retry delays: 1000ms, 2000ms, 4000ms, 8000ms...
const retriableFunction = retry(asyncMethod, {
  intervals: 1000,
  backoff: 2,
  maxAttempts: 5,
});
```

### Enhanced Backoff Features

#### Maximum Interval Cap

Prevent delays from growing too large:

```ts
// Delays: 1000ms, 2000ms, 4000ms, 5000ms, 5000ms...
const retriableFunction = retry(asyncMethod, {
  intervals: 1000,
  backoff: 2,
  maxInterval: 5000, // Cap at 5 seconds
  maxAttempts: 6,
});
```

#### Jitter (Anti-Thundering Herd)

Add randomness to prevent all clients from retrying simultaneously:

```ts
// Delays: ~1000ms, ~2000ms, ~4000ms (with ±20% variation)
const retriableFunction = retry(asyncMethod, {
  intervals: 1000,
  backoff: 2,
  jitter: true, // Adds 20% randomness
  maxAttempts: 4,
});
```

**Why use jitter?** When many clients fail simultaneously (e.g., service outage), they all retry at the same intervals. This can overwhelm the recovering service. Jitter spreads out the retry attempts over time.

#### Combining Features

```ts
// Production-ready configuration
const robustRetry = retry(apiCall, {
  intervals: 1000,
  backoff: 2,
  maxAttempts: 5,
  maxInterval: 30000, // Never wait more than 30 seconds
  jitter: true, // Spread out retries
  errors: ["NetworkError", "TimeoutError"],
});
```
