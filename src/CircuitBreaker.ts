import { CircuitBreakerError } from './CircuitBreakerError';
import { CircuitBreakerState } from './CircuitBreakerState';

class CircuitBreaker {
    public readonly id: string;
    private _state: CircuitBreakerState;
    private failuresCount: number;
    private failureThreshold: number;
    private lastDetectedFailure?: number;
    private recoveryTimeout: number; // in ms

    constructor(id: string, failureThreshold: number, recoveryTimeout: number) {
        this.id = id;
        this._state = CircuitBreakerState.CLOSED;
        this.failuresCount = 0;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
    }

    public get state(): CircuitBreakerState {
        if (this._state === CircuitBreakerState.OPEN) {
            const lastFailure = this.lastDetectedFailure || 0;
            const elapsedTime = new Date().getTime() - lastFailure;
            if (elapsedTime > this.recoveryTimeout) {
                this.state = CircuitBreakerState.HALF_OPEN;
            }
        }
        return this._state;
    }

    private set state(state: CircuitBreakerState) {
        this._state = state;
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
