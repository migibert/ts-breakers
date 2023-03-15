import { CircuitBreakerError } from './CircuitBreakerError';
import { CircuitBreakerStorageStrategy } from './CircuitBreakerStorageStrategy';

enum CircuitBreakerStatus {
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
    CLOSED = 'CLOSED',
}

type CircuitBreakerState = {
    status: CircuitBreakerStatus;
    consecutiveFailures: number;
    lastDetectedFailure?: Date;
};

type CircuitBreakerConfiguration = {
    failureThreshold: number;
    recoveryTimeout: number;
};

class CircuitBreaker {
    private id: string;
    private storageStrategy: CircuitBreakerStorageStrategy;
    private observers: Array<(previous: CircuitBreakerStatus, next: CircuitBreakerStatus) => void>;

    constructor(id: string, storageStrategy: CircuitBreakerStorageStrategy) {
        this.id = id;
        this.storageStrategy = storageStrategy;
        this.observers = [];
    }

    public addObserver(observer: (previous: CircuitBreakerStatus, next: CircuitBreakerStatus) => void): void {
        this.observers.push(observer);
    }

    private updateState(state: CircuitBreakerState): void {
        const loadedState = this.storageStrategy.loadState();
        if (loadedState === state) {
            return;
        }
        this.storageStrategy.saveState(state);
        for (const observer of this.observers) {
            if (state.status !== loadedState.status) {
                observer(loadedState.status, state.status);
            }
        }
    }

    public getStatus(): CircuitBreakerStatus {
        const configuration = this.storageStrategy.loadConfiguration();
        const state = this.storageStrategy.loadState();
        if (state.status === CircuitBreakerStatus.OPEN) {
            if (!state.lastDetectedFailure) {
                throw new Error(
                    '${this.id} circuit breaker is in an inconsistent state: an OPEN circuit must have a last detected failure date',
                );
            }
            const elapsed = new Date().getTime() - state.lastDetectedFailure.getTime();
            if (elapsed > configuration.recoveryTimeout) {
                this.updateState({
                    status: CircuitBreakerStatus.HALF_OPEN,
                    consecutiveFailures: state.consecutiveFailures,
                    lastDetectedFailure: state.lastDetectedFailure,
                });
                return CircuitBreakerStatus.HALF_OPEN;
            }
        }
        return state.status;
    }

    public isClosed(): boolean {
        return this.getStatus() === CircuitBreakerStatus.CLOSED;
    }

    public isOpen(): boolean {
        return this.getStatus() === CircuitBreakerStatus.OPEN;
    }

    public isHalfOpen(): boolean {
        return this.getStatus() === CircuitBreakerStatus.HALF_OPEN;
    }

    public collectFailure() {
        const configuration = this.storageStrategy.loadConfiguration();
        const state = this.storageStrategy.loadState();

        const consecutiveFailures = state.consecutiveFailures + 1;
        let targetStatus = state.status;

        if (consecutiveFailures > configuration.failureThreshold) {
            targetStatus = CircuitBreakerStatus.OPEN;
        }

        if (this.isHalfOpen()) {
            targetStatus = CircuitBreakerStatus.OPEN;
        }

        this.updateState({
            status: targetStatus,
            consecutiveFailures: consecutiveFailures,
            lastDetectedFailure: new Date(),
        });
    }

    public collectSuccess() {
        const state = this.storageStrategy.loadState();

        let targetStatus = state.status;
        if (this.isHalfOpen()) {
            targetStatus = CircuitBreakerStatus.CLOSED;
        }

        this.updateState({
            status: targetStatus,
            consecutiveFailures: 0,
        });
    }

    public wrapFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => TReturn,
    ): (...parameters: TArgs) => TReturn {
        return (...parameters: TArgs) => {
            try {
                if (this.isOpen()) {
                    throw new CircuitBreakerError(`${this.id} is OPEN`);
                }
                const result = targetFunction(...parameters);
                this.collectSuccess();
                return result;
            } catch (e: any) {
                this.collectFailure();
                throw e;
            }
        };
    }

    public wrapAsyncFunction<TArgs extends any[], TReturn>(
        targetFunction: (...parameters: TArgs) => Promise<TReturn>,
    ): (...parameters: TArgs) => Promise<TReturn> {
        return (...parameters: TArgs): Promise<TReturn> => {
            if (this.isOpen()) {
                return Promise.reject(new CircuitBreakerError(`Circuit ${this.id} is OPEN`));
            }
            const promise = targetFunction(...parameters);
            return promise.then(
                (value: TReturn) => {
                    this.collectSuccess();
                    return value;
                },
                (error: any) => {
                    this.collectFailure();
                    throw error;
                },
            );
        };
    }
}

export {
    CircuitBreaker,
    CircuitBreakerState,
    CircuitBreakerConfiguration,
    CircuitBreakerStatus,
    CircuitBreakerStorageStrategy,
};
