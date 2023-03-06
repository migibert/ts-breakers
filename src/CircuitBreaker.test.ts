import { CircuitBreakerState } from './CircuitBreakerState';
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerError } from './CircuitBreakerError';

class MyError extends Error {
    constructor(msg: string) {
        super(msg);
    }
}

const unstableFn = (shouldThrow: boolean): boolean => {
    if (shouldThrow === true) {
        throw new MyError('I am failing');
    }
    return shouldThrow;
};

const unstableAsyncFn = (shouldThrow: boolean): Promise<boolean> => {
    if (shouldThrow === true) {
        return Promise.reject(new MyError('I am failing'));
    }
    return Promise.resolve(shouldThrow);
};

const failConsecutivelyAsync = async (
    cb: CircuitBreaker,
    functionToWrap: (failing: boolean) => Promise<boolean>,
    consecutiveFailuresCount: number,
): Promise<(failing: boolean) => Promise<boolean>> => {
    const wrapped = cb.wrapAsyncFunction(functionToWrap);

    const promises: Array<Promise<boolean>> = [];
    for (let i = 0; i < consecutiveFailuresCount; i++) {
        const promise = wrapped(true);
        promise.catch((_: any) => {
            /* Silent error */
        });
        promises.push(promise);
    }
    try {
        await Promise.allSettled(promises);
    } catch (e: any) {
        // Silent error
    }
    return wrapped;
};

const failConsecutively = (
    cb: CircuitBreaker,
    functionToWrap: (failing: boolean) => boolean,
    consecutiveFailuresCount: number,
): ((failing: boolean) => any) => {
    const wrapped = cb.wrapFunction(functionToWrap);

    for (let i = 0; i < consecutiveFailuresCount; i++) {
        try {
            wrapped(true);
        } catch (e: any) {
            // Silent error
        }
    }
    return wrapped;
};

const testSynchronousExtraFailure = (wrapped: (failing: boolean) => boolean, extraFailure?: boolean) => {
    if (extraFailure === undefined) {
        return;
    }
    if (extraFailure === true) {
        expect(() => wrapped(extraFailure)).toThrow(MyError);
    } else {
        expect(wrapped(extraFailure)).toBe(extraFailure);
    }
};

const testAsynchronousExtraFailure = async (
    wrapped: (failing: boolean) => Promise<boolean>,
    extraFailure?: boolean,
) => {
    if (extraFailure === undefined) {
        return;
    }
    if (extraFailure === true) {
        await expect(() => wrapped(extraFailure)).rejects.toThrow(MyError);
    } else {
        await expect(wrapped(extraFailure)).resolves.toBe(extraFailure);
    }
};

describe('Test Suite', () => {
    const failureThreshold = 3;
    const recoveryTimeout = 100;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe.each([{ sync: true }, { sync: false }])('State Machine Test Suite - synchronous: $sync', (args) => {
        const synchronous = args.sync;
        test.each([
            {
                consecutiveFailures: 0,
                delay: 0,
                expectedState: CircuitBreakerState.CLOSED,
                expectedNotifications: [],
            },
            {
                consecutiveFailures: failureThreshold + 1,
                delay: 0,
                expectedState: CircuitBreakerState.OPEN,
                expectedNotifications: [[CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]],
            },
            {
                consecutiveFailures: failureThreshold,
                delay: 0,
                expectedState: CircuitBreakerState.CLOSED,
                expectedNotifications: [],
            },
            {
                consecutiveFailures: failureThreshold + 1,
                delay: recoveryTimeout + 20,
                expectedState: CircuitBreakerState.HALF_OPEN,
                expectedNotifications: [
                    [CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN],
                    [CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN],
                ],
            },
            {
                consecutiveFailures: failureThreshold + 1,
                delay: recoveryTimeout - 20,
                expectedState: CircuitBreakerState.OPEN,
                expectedNotifications: [[CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]],
            },
            {
                consecutiveFailures: failureThreshold + 1,
                delay: recoveryTimeout + 20,
                expectedState: CircuitBreakerState.OPEN,
                expectedNotifications: [
                    [CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN],
                    [CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN],
                    [CircuitBreakerState.HALF_OPEN, CircuitBreakerState.OPEN],
                ],
                failAfterDelay: true,
            },
            {
                consecutiveFailures: failureThreshold + 1,
                delay: recoveryTimeout + 20,
                expectedState: CircuitBreakerState.CLOSED,
                expectedNotifications: [
                    [CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN],
                    [CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN],
                    [CircuitBreakerState.HALF_OPEN, CircuitBreakerState.CLOSED],
                ],
                failAfterDelay: false,
            },
        ])(
            'Given a failure treshold set to 3 and a recovery timeout set to 100, When $consecutiveFailures consecutive failures happen, $delay ms elapsed, then the circuit is $expectedState',
            async ({ consecutiveFailures, delay, expectedState, expectedNotifications, failAfterDelay }) => {
                const observer = jest.fn();
                const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
                cb.addObserver(observer);

                if (synchronous === true) {
                    const wrapped = failConsecutively(cb, unstableFn, consecutiveFailures);
                    jest.advanceTimersByTime(delay);
                    testSynchronousExtraFailure(wrapped, failAfterDelay);
                } else {
                    const wrapped = await failConsecutivelyAsync(cb, unstableAsyncFn, consecutiveFailures);
                    jest.advanceTimersByTime(delay);
                    await testAsynchronousExtraFailure(wrapped, failAfterDelay);
                }
                expect(cb.state).toBe(expectedState);
                expect(observer).toBeCalledTimes(expectedNotifications.length);
                for (let i = 0; i < expectedNotifications.length; i++) {
                    expect(observer.mock.calls[i]).toEqual(expectedNotifications[i]);
                }
            },
        );
    });
});

describe('Synchronous Wrapper interface Test Suite', () => {
    test('When function is wrapped, then its parameter and typing are preserved', () => {
        const sum = (a: number, b: number): number => a + b;
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapFunction(sum);

        const result = wrapped(2, 3);

        expect(result).toBe(5);
    });

    test('When function is wrapped, then its exceptions are bubbled up', () => {
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapFunction(unstableFn);

        expect(() => wrapped(true)).toThrow(MyError);
    });

    test('When function is wrapped and circuit is open, then thrown exception is CircuitBreakerError', () => {
        const failureThreshold = 3;
        const cb = new CircuitBreaker('test', failureThreshold, 2000);
        const wrapped = failConsecutively(cb, unstableFn, failureThreshold + 1);

        expect(() => wrapped(true)).toThrow(CircuitBreakerError);
    });
});

describe('Asynchronous Wrapper interface Test Suite', () => {
    test('When function is wrapped, then its parameter and typing are preserved', async () => {
        const sum = (a: number, b: number): Promise<number> => Promise.resolve(a + b);
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapAsyncFunction(sum);

        const result = wrapped(2, 3);

        await expect(result).resolves.toBe(5);
    });

    test('When function is wrapped, then its exceptions are bubbled up', async () => {
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapAsyncFunction(unstableAsyncFn);

        await expect(wrapped(true)).rejects.toThrow(MyError);
    });

    test('When function is wrapped and circuit is open, then thrown exception is CircuitBreakerError', async() => {
        const failureThreshold = 3;
        const cb = new CircuitBreaker('test', failureThreshold, 2000);
        const wrapped = await failConsecutivelyAsync(cb, unstableAsyncFn, failureThreshold + 1);

        await expect(wrapped(true)).rejects.toThrow(CircuitBreakerError);
    });
});
