import { CircuitBreakerState } from './CircuitBreakerState';
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerError } from './CircuitBreakerError';

const unstableFn = (shouldThrow: boolean): boolean => {
    if (shouldThrow === true) {
        throw new Error('I am failing');
    }
    return shouldThrow;
};

describe('Proxy Test Suite', () => {
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
                Object.setPrototypeOf(this, MyError.prototype);
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

describe('State machine Test Suite', () => {
    test('When a new circuit breaker is created, then its state is CLOSED', () => {
        const fn = () => true;
        const cb = new CircuitBreaker('test', 5, 2000);
        const wrapped = cb.wrapFunction(fn);

        const result = wrapped();

        expect(cb.state).toBe(CircuitBreakerState.CLOSED);
    });

    test('When the Circuit is CLOSED and wrapped function reaches its failure threshold, then it OPENs up', () => {
        const failureThreshold = 3;
        const cb = new CircuitBreaker('test', failureThreshold, 2000);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        expect(cb.state).toBe(CircuitBreakerState.OPEN);
        expect(() => wrapped(false)).toThrow(CircuitBreakerError);
    });

    test('When the Circuit is CLOSED and wrapped function does not reach its failure threshold, then it remains CLOSED', () => {
        const failureThreshold = 3;
        const cb = new CircuitBreaker('test', failureThreshold, 2000);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i < failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        expect(cb.state).toBe(CircuitBreakerState.CLOSED);
    });

    test('When the Circuit is OPEN and recovery time is reached, then it HALF-OPENs', async () => {
        const failureThreshold = 3;
        const recoveryTimeout = 200;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout + 10));

        expect(cb.state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    test('When the Circuit is OPEN and recovery time is not reached, then it remains OPEN', async () => {
        const failureThreshold = 3;
        const recoveryTimeout = 200;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout - 10));

        expect(() => wrapped(false)).toThrow(CircuitBreakerError);
        expect(cb.state).toBe(CircuitBreakerState.OPEN);
    });

    test('When the Circuit is HALF-OPEN and wrapped function succeeds, then it CLOSEs', async () => {
        const failureThreshold = 3;
        const recoveryTimeout = 200;
        const cb = new CircuitBreaker('test', failureThreshold, recoveryTimeout);
        const wrapped = cb.wrapFunction(unstableFn);

        for (let i = 0; i <= failureThreshold; i++) {
            try {
                wrapped(true);
            } catch (e: any) {
                // Silent error
            }
        }

        await new Promise<void>((res) => setTimeout(res, recoveryTimeout + 10));

        const result = wrapped(false);
        expect(result).toBe(false);
        expect(cb.state).toBe(CircuitBreakerState.CLOSED);
    });
});
