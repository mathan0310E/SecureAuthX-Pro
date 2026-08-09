/**
 * Ref'd timeout guard for database calls.
 *
 * Why this exists: on Cloudflare Workers, a pending `pg` connection has its
 * timeout timers `unref()`d (see pg's client.js). An unref'd timer is not a
 * pending event, so when a TCP/TLS/SCRAM handshake stalls (e.g. Neon is
 * waking a suspended compute, or the pooler is queueing connections), the
 * runtime sees an empty event loop with no response → it kills the request
 * with Error 1101 "The script will never generate a response".
 *
 * Racing every DB call against a *ref'd* setTimeout keeps at least one event
 * in the loop for the full window, so a stall surfaces as a catchable timeout
 * error (clean 5xx) instead of a runtime-canceled request.
 */

/** Races `promise` against a ref'd timer. The timer is cleared on settle. */
export function withDbTimeout<T>(promise: Promise<T>, ms: number, label = 'db'): Promise<T> {
  const guarded = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
  // Prisma's batch `$transaction([...])` validates elements via
  // `Symbol.toStringTag === "PrismaPromise"`. We wrap Prisma promises, so
  // claim the same tag to keep array transactions working; the batch
  // executor awaits the returned promise directly.
  Object.defineProperty(guarded, Symbol.toStringTag, { value: 'PrismaPromise' });
  return guarded;
}

type AnyFn = (...args: never[]) => unknown;

/**
 * Wraps a function so promise-returning calls race against the watchdog.
 * Calls are applied with `owner` as `this` — Prisma methods (e.g.
 * `$transaction`) read instance state (`_tracingHelper`), so the binding must
 * be preserved through the Proxy.
 */
function wrapCall<TFn extends AnyFn>(fn: TFn, owner: object, timeoutMs: number, label: string): TFn {
  return ((...args: never[]) => {
    const result = fn.apply(owner, args);
    return result && typeof (result as Promise<unknown>).then === 'function'
      ? withDbTimeout(result as Promise<unknown>, timeoutMs, label)
      : result;
  }) as TFn;
}

/**
 * Wraps a PrismaClient so every promise-returning call (model methods,
 * `$queryRaw`, `$executeRaw`, `$transaction`, ...) races against the ref'd
 * watchdog. Synchronous members (`$on`, `$use`, `$extends`, ...) pass through
 * untouched; model delegates get their method calls guarded too.
 */
export function guardPrisma<T>(client: T, timeoutMs: number, label = 'db'): T {
  const guardedModels = new Map<string, object>();
  return new Proxy(client as object, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop, receiver);
      }
      const value = Reflect.get(target, prop, receiver);
      if (value && typeof value === 'object') {
        // Model delegate (e.g. client.user) — guard its methods.
        let guarded = guardedModels.get(prop);
        if (!guarded) {
          guarded = new Proxy(value as object, {
            get(modelTarget, modelProp) {
              const modelValue = Reflect.get(modelTarget, modelProp, modelTarget);
              return typeof modelValue === 'function'
                ? wrapCall(modelValue as AnyFn, modelTarget, timeoutMs, label)
                : modelValue;
            },
          });
          guardedModels.set(prop, guarded);
        }
        return guarded;
      }
      return typeof value === 'function'
        ? wrapCall(value as AnyFn, target, timeoutMs, label)
        : value;
    },
  }) as T;
}
