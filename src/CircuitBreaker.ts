import { CircuitBreakerError } from './CircuitBreakerError';
import { CircuitBreakerState } from './CircuitBreakerState';

class CircuitBreaker {
    public readonly id: string;
    private _state: CircuitBreakerState;
    private failuresCount: number;
    private failureThreshold: number;
    private lastDetectedFailure?: number;
    private recoveryTimeout: number; // in ms
    private observers: ((previousState: CircuitBreakerState, currentState: CircuitBreakerState) => void)[];

    constructor(id: string, failureThreshold: number, recoveryTimeout: number) {
        this.id = id;
        this._state = CircuitBreakerState.CLOSED;
        this.failuresCount = 0;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.observers = [];
    }

    public get state(): CircuitBreakerState {
        if (this._state === CircuitBreakerState.OPEN) {
            if (!this.lastDetectedFailure) {
                throw new Error('Circuit is OPEN but no last detected failure is known');
            }
            const elapsedTime = new Date().getTime() - this.lastDetectedFailure;
            if (elapsedTime > this.recoveryTimeout) {
                this.state = CircuitBreakerState.HALF_OPEN;
            }
        }
        return this._state;
    }

    private set state(state: CircuitBreakerState) {
        const previousState = this._state;
        this._state = state;
        for (const observer of this.observers) {
            observer(previousState, state);
        }
    }

    public addObserver(observer: (previousState: CircuitBreakerState, currentState: CircuitBreakerState) => void) {
        this.observers.push(observer);
    }

    public wrapFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => TReturn,
    ): (...parameters: TArgs) => TReturn {
        return (...parameters: TArgs) => {
            try {
                if (this.state === CircuitBreakerState.OPEN) {
                    throw new CircuitBreakerError(`${this.id} is OPEN`);
                }
                const result = targetFunction(...parameters);
                this.handleSuccess();
                return result;
            } catch (e: any) {
                this.handleFailure();
                throw e;
            }
        };
    }

    public wrapAsyncFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => Promise<TReturn>,
    ): (...parameters: TArgs) => Promise<TReturn> {
        return (...parameters: TArgs): Promise<TReturn> => {
            if (this.state === CircuitBreakerState.OPEN) {
                return Promise.reject(new CircuitBreakerError(`Circuit ${this.id} is OPEN`));
            }
            const promise = targetFunction(...parameters);
            return promise.then(
                (value: TReturn) => {
                    this.handleSuccess();
                    return value;
                },
                (error: any) => {
                    this.handleFailure();
                    throw error;
                },
            );
        };
    }

    private handleSuccess(): void {
        this.failuresCount = 0;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.state = CircuitBreakerState.CLOSED;
            return;
        }
    }

    private handleFailure(): void {
        this.failuresCount++;
        this.lastDetectedFailure = new Date().getTime();
        if (this.state === CircuitBreakerState.CLOSED) {
            if (this.failuresCount > this.failureThreshold) {
                this.state = CircuitBreakerState.OPEN;
                return;
            }
        }
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.state = CircuitBreakerState.OPEN;
            return;
        }
    }
}

export { CircuitBreaker };
