import { CircuitBreakerError } from './CircuitBreakerError';
import { LocalCircuitBreakerState } from './LocalCircuitBreakerState';
import { CircuitBreakerStatus, CircuitBreakerState } from './CircuitBreakerState';

class CircuitBreaker {
    public readonly id: string;
    private state: CircuitBreakerState;

    constructor(id: string, failureThreshold: number, recoveryTimeout: number, state?: CircuitBreakerState) {
        this.id = id;
        this.state = state || new LocalCircuitBreakerState(recoveryTimeout, failureThreshold);
    }

    public getStatus(): CircuitBreakerStatus {
        return this.state.getStatus();
    }

    public addObserver(observer: (previousStatus: CircuitBreakerStatus, currentStatus: CircuitBreakerStatus) => void) {
        this.state.addObserver(observer);
    }

    public wrapFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => TReturn,
    ): (...parameters: TArgs) => TReturn {
        return (...parameters: TArgs) => {
            try {
                if (this.state.isOpen()) {
                    throw new CircuitBreakerError(`${this.id} is OPEN`);
                }
                const result = targetFunction(...parameters);
                this.state.onSuccess();
                return result;
            } catch (e: any) {
                this.state.onFailure();
                throw e;
            }
        };
    }

    public wrapAsyncFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => Promise<TReturn>,
    ): (...parameters: TArgs) => Promise<TReturn> {
        return (...parameters: TArgs): Promise<TReturn> => {
            if (this.state.isOpen()) {
                return Promise.reject(new CircuitBreakerError(`Circuit ${this.id} is OPEN`));
            }
            const promise = targetFunction(...parameters);
            return promise.then(
                (value: TReturn) => {
                    this.state.onSuccess();
                    return value;
                },
                (error: any) => {
                    this.state.onFailure();
                    throw error;
                },
            );
        };
    }
}

export { CircuitBreaker };
