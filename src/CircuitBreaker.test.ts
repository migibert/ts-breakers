import { CircuitBreakerState } from './CircuitBreakerState';
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerError } from './CircuitBreakerError';

const unstableFn = (shouldThrow: boolean): boolean => {
    if (shouldThrow === true) {
        throw new Error('I am failing');
    }
    return shouldThrow;
};

const testCircuitBreakerStateAfterNFailures = (
    cb: CircuitBreaker,
    functionToWrap: (failing: boolean) => boolean,
    consecutiveFailuresCount: number,
    expectedState: CircuitBreakerState,
    delay?: number,
): (failing: boolean) => boolean => {
    const wrapped = cb.wrapFunction(functionToWrap);

    for (let i = 0; i < consecutiveFailuresCount; i++) {
        try {
            wrapped(true);
        } catch (e: any) {
            // Silent error
        }
    }

    if (delay) {
        jest.advanceTimersByTime(delay);
    }

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
        test('When a new circuit breaker is created, then its state is CLOSED', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            testCircuitBreakerStateAfterNFailures(cb, unstableFn, 0, CircuitBreakerState.CLOSED);
        });
    
        test('When the Circuit is CLOSED and wrapped function reaches its failure threshold, then it OPENs up', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            const wrapped = testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold+1, CircuitBreakerState.OPEN);
    
            expect(() => wrapped(false)).toThrow(CircuitBreakerError);
        });
    
        test('When the Circuit is CLOSED and wrapped function does not reach its failure threshold, then it remains CLOSED', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold-1, CircuitBreakerState.CLOSED);
        });
    
        test('When the Circuit is OPEN and recovery time is reached, then it HALF-OPENs', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold+1, CircuitBreakerState.HALF_OPEN, recoveryTimeout+20);
        });
    
        test('When the Circuit is OPEN and recovery time is not reached, then it remains OPEN', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            
            const wrapped = testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold+1, CircuitBreakerState.OPEN, recoveryTimeout-20);
            expect(() => wrapped(false)).toThrow(CircuitBreakerError);
        });
    
        test('When the Circuit is HALF-OPEN and wrapped function succeeds, then it CLOSEs', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            const wrapped = testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold+1, CircuitBreakerState.HALF_OPEN, recoveryTimeout+20);
    
            const result = wrapped(false);

            expect(result).toBe(false);
            expect(cb.state).toBe(CircuitBreakerState.CLOSED);
        });
    
        test('When the Circuit is HALF-OPEN and wrapped function fails, then it OPENs', () => {
            const failureThreshold = 3;
            const recoveryTimeout = 100;
            const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
            const wrapped = testCircuitBreakerStateAfterNFailures(cb, unstableFn, failureThreshold+1, CircuitBreakerState.HALF_OPEN, recoveryTimeout+20);
            
            expect(() => wrapped(true)).toThrow(Error);
            expect(cb.state).toBe(CircuitBreakerState.OPEN);
        });
    });
})

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
        class MyError extends Error {
            constructor(msg: string) {
                super(msg);
            }
        }
        const fn = () => {
            throw new MyError('Raise as expected');
        };
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapFunction(fn);

        expect(() => wrapped()).toThrow(MyError);
    });
});

describe('Observable interface Test Suite', () => {
    test('When a Circuit OPENs up, then observers are notified', () => {
        const failureThreshold = 1;
        const recoveryTimeout = 20;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const observer = jest.fn();

        cb.addObserver(observer);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        expect(observer).toBeCalledTimes(1);
    });

    test('When a Circuit OPENs up, then observers are notified with previous and current state', () => {
        const failureThreshold = 1;
        const recoveryTimeout = 20;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const observer = (previousState: CircuitBreakerState, currentState: CircuitBreakerState) => {
            expect(previousState).toBe(CircuitBreakerState.CLOSED);
            expect(currentState).toBe(CircuitBreakerState.OPEN);
        };
        cb.addObserver(observer);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }
    });

    test('When a Circuit HALF-OPENs, then observers are notified with previous and current state', async () => {
        const failureThreshold = 1;
        const recoveryTimeout = 20;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const observer = jest.fn();

        cb.addObserver(observer);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout + 5));

        expect(cb.state).toEqual(CircuitBreakerState.HALF_OPEN);
        expect(observer).toBeCalledTimes(2);
        expect(observer.mock.calls[0]).toEqual([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]);
        expect(observer.mock.calls[1]).toEqual([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN]);
    });

    test('When a Circuit CLOSEs, then observers are notified with previous and current state', async () => {
        const failureThreshold = 1;
        const recoveryTimeout = 20;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const observer = jest.fn();

        cb.addObserver(observer);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout + 5));
        wrapped(false);

        expect(observer).toBeCalledTimes(3);
        expect(observer.mock.calls[0]).toEqual([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]);
        expect(observer.mock.calls[1]).toEqual([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN]);
        expect(observer.mock.calls[2]).toEqual([CircuitBreakerState.HALF_OPEN, CircuitBreakerState.CLOSED]);
    });

    test('When a Circuit OPENs from HALF-OPEN, then observers are notified with state changes', async () => {
        const failureThreshold = 1;
        const recoveryTimeout = 20;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const observer = jest.fn();

        cb.addObserver(observer);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout + 5));
        expect(() => wrapped(true)).toThrow(Error);
        expect(observer).toBeCalledTimes(3);
        expect(observer.mock.calls[0]).toEqual([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN]);
        expect(observer.mock.calls[1]).toEqual([CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN]);
        expect(observer.mock.calls[2]).toEqual([CircuitBreakerState.HALF_OPEN, CircuitBreakerState.OPEN]);
    });
});
