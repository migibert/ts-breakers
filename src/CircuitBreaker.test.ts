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

const testCircuitBreakerStateAfterNFailures = (
    cb: CircuitBreaker,
    functionToWrap: (failing: boolean) => boolean,
    consecutiveFailuresCount: number,
    delay: number,
    expectedState: CircuitBreakerState,
): ((failing: boolean) => boolean) => {
    const wrapped = cb.wrapFunction(functionToWrap);

    for (let i = 0; i < consecutiveFailuresCount; i++) {
        try {
            wrapped(true);
        } catch (e: any) {
            // Silent error
        }
    }
    jest.advanceTimersByTime(delay);

    expect(cb.state).toBe(expectedState);
    return wrapped;
};

describe('Test Suite', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('State machine Test Suite', () => {
        const failureThreshold = 3;
        const recoveryTimeout = 100;
        test.each([
            {
                consecutiveFailures: 0,
                delay: 0,
                expectedState: CircuitBreakerState.CLOSED,
                expectedNotifications: [],
            },
            {
                consecutiveFailures: failureThreshold,
                delay: 0,
                expectedState: CircuitBreakerState.OPEN,
                expectedNotifications: [[CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]],
            },
            {
                consecutiveFailures: failureThreshold - 1,
                delay: 0,
                expectedState: CircuitBreakerState.CLOSED,
                expectedNotifications: [],
            },
            {
                consecutiveFailures: failureThreshold,
                delay: recoveryTimeout + 20,
                expectedState: CircuitBreakerState.HALF_OPEN,
                expectedNotifications: [
                    [CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN],
                    [CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN],
                ],
            },
            {
                consecutiveFailures: failureThreshold,
                delay: recoveryTimeout - 20,
                expectedState: CircuitBreakerState.OPEN,
                expectedNotifications: [[CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]],
            },
        ])(
            'Given a failure treshold set to 3 and a recovery timeout set to 100, When $consecutiveFailures consecutive failures happen and $delay ms elapsed, then the circuit is $expectedState',
            ({ consecutiveFailures, delay, expectedState, expectedNotifications }) => {
                const observer = jest.fn();
                const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
                cb.addObserver(observer);
                testCircuitBreakerStateAfterNFailures(cb, unstableFn, consecutiveFailures + 1, delay, expectedState);
                expect(observer).toBeCalledTimes(expectedNotifications.length);
                for (let i = 0; i < expectedNotifications.length; i++) {
                    expect(observer.mock.calls[i]).toEqual(expectedNotifications[i]);
                }
            },
        );

        test('When the Circuit is HALF-OPEN and wrapped function succeeds, then it CLOSEs', () => {
            const observer = jest.fn();
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            cb.addObserver(observer);
            const wrapped = testCircuitBreakerStateAfterNFailures(
                cb,
                unstableFn,
                failureThreshold + 1,
                recoveryTimeout + 20,
                CircuitBreakerState.HALF_OPEN,
            );

            const result = wrapped(false);

            expect(result).toBe(false);
            expect(cb.state).toBe(CircuitBreakerState.CLOSED);
            expect(observer).toBeCalledTimes(3);
            expect(observer.mock.calls[0]).toEqual([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]);
            expect(observer.mock.calls[1]).toEqual([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN]);
            expect(observer.mock.calls[2]).toEqual([CircuitBreakerState.HALF_OPEN, CircuitBreakerState.CLOSED]);
        });

        test('When the Circuit is HALF-OPEN and wrapped function fails, then it OPENs', () => {
            const observer = jest.fn();
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            cb.addObserver(observer);
            const wrapped = testCircuitBreakerStateAfterNFailures(
                cb,
                unstableFn,
                failureThreshold + 1,
                recoveryTimeout + 20,
                CircuitBreakerState.HALF_OPEN,
            );

            expect(() => wrapped(true)).toThrow(MyError);
            expect(cb.state).toBe(CircuitBreakerState.OPEN);
            expect(observer).toBeCalledTimes(3);
            expect(observer.mock.calls[0]).toEqual([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]);
            expect(observer.mock.calls[1]).toEqual([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN]);
            expect(observer.mock.calls[2]).toEqual([CircuitBreakerState.HALF_OPEN, CircuitBreakerState.OPEN]);
        });
    });
});

describe('Wrapper interface Test Suite', () => {
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

        expect(() => wrapped(true)).toThrow(Error);
    });

    test('When function is wrapped, then its exceptions type are preserved', () => {
        const fn = () => {
            throw new MyError('Raise as expected');
        };
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapFunction(fn);

        expect(() => wrapped()).toThrow(MyError);
    });
});
