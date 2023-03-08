import { CircuitBreakerError } from './CircuitBreakerError';
import { CircuitBreakerStatus, InMemoryCircuitBreakerState } from './providers/InMemoryCircuitBreakerState';
import { ICircuitBreakerState } from './ICircuitBreakerState';

class CircuitBreaker {
    public readonly id: string;
    private state: ICircuitBreakerState;

    constructor(id: string, failureThreshold: number, recoveryTimeout: number) {
        this.id = id;
        this.state = new InMemoryCircuitBreakerState(recoveryTimeout, failureThreshold);
    }

    public getStatus(): CircuitBreakerStatus {
        return this.state.getStatus();
    }

    public addObserver(observer: (previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void) {
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
                this.state.succeed();
                return result;
            } catch (e: any) {
                this.state.fail();
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
                    this.state.succeed();
                    return value;
                },
                (error: any) => {
                    this.state.fail();
                    throw error;
                },
            );
        };
    }
}

export { CircuitBreaker };
