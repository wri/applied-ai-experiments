export interface FanOutOptions<T> {
  /** Max tasks in flight at once (default 3) */
  concurrency?: number;
  /** Abort skips queued tasks; in-flight tasks see the same signal if they accept one */
  signal?: AbortSignal;
  /** Called as each task settles, with a stable index — render results incrementally */
  onSettle?: (index: number, result: PromiseSettledResult<T>) => void;
}

/**
 * Run tasks with a concurrency limit. Always resolves with one settled
 * result per task, in task order. Aborted-before-start tasks settle as
 * rejected with an AbortError-like Error.
 */
export async function fanOut<T>(
  tasks: Array<() => Promise<T>>,
  opts: FanOutOptions<T> = {}
): Promise<Array<PromiseSettledResult<T>>> {
  const { concurrency = 3, signal, onSettle } = opts;
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const index = next++;
      let result: PromiseSettledResult<T>;
      if (signal?.aborted) {
        result = { status: 'rejected', reason: abortError() };
      } else {
        try {
          result = { status: 'fulfilled', value: await tasks[index]() };
        } catch (err) {
          result = { status: 'rejected', reason: err };
        }
      }
      results[index] = result;
      onSettle?.(index, result);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

function abortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}
