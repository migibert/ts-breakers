import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerState } from './CircuitBreakerState';

type CircuitBreakerConfiguration = {
    failureThreshold: number;
    recoveryTimeout: number;
    observers?: ((previousState: CircuitBreakerState, currentState: CircuitBreakerState) => void)[];
};

/**
 * CircuitBreakerDecorator is a decorator that wraps all the methods of a class with the wrapFunction from CircuitBreaker instance.
 * @param {CircuitBreakerConfiguration} config
 * @return {ClassDecorator}
 * @example
 *
 * @CircuitBreakerDecorator({
 *    failureThreshold: 5,
 *    recoveryTimeout: 3000,
 *  })
 *  class MyClass {...}
 *
 */
export function CircuitBreakerDecorator({ failureThreshold, recoveryTimeout, observers = [] }: CircuitBreakerConfiguration): ClassDecorator {
    return (target: Function) => {
        const circuitBreaker = new CircuitBreaker(target.name, failureThreshold, recoveryTimeout);
        for (const observer of observers) {
            circuitBreaker.addObserver(observer);
        }
        for (const key of Object.getOwnPropertyNames(target.prototype)) {
            const value = target.prototype[key];
            if (key !== 'constructor' && typeof value === 'function') {
                target.prototype[key] = circuitBreaker.wrapFunction(value);
            }
        }
    };
}
