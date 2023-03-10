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
    id: string;
    failureThreshold: number;
    recoveryTimeout: number;
};

class CircuitBreaker {
    private configuration: CircuitBreakerConfiguration;
    private state: CircuitBreakerState;
    private storageStrategy: CircuitBreakerStorageStrategy;
    private observers: Array<(previous: CircuitBreakerStatus, next: CircuitBreakerStatus) => void>;

    constructor(
        defaultConfiguration: CircuitBreakerConfiguration,
        initialState: CircuitBreakerState,
        storageStrategy: CircuitBreakerStorageStrategy,
    ) {
        this.configuration = defaultConfiguration;
        this.state = initialState;
        this.storageStrategy = storageStrategy;
        this.observers = [];

        this.state = this.storageStrategy.loadState();
        this.configuration = this.storageStrategy.loadConfiguration();
    }

    public addObserver(observer: (previous: CircuitBreakerStatus, next: CircuitBreakerStatus) => void): void {
        this.observers.push(observer);
    }

    private updateState(state: CircuitBreakerState): void {
        const previousState = this.storageStrategy.loadState();
        if (previousState === state) {
            return;
        }
        this.state = state;
        this.storageStrategy.saveState(state);
        for (const observer of this.observers) {
            if (state.status !== previousState.status) {
                observer(previousState.status, state.status);
            }
        }
    }

    public getStatus(): CircuitBreakerStatus {
        if (this.state.status === CircuitBreakerStatus.OPEN) {
            if (!this.state.lastDetectedFailure) {
                throw new Error('Inconsistent state: an OPEN circuit must have a last detected failure date');
            }
            const elapsed = new Date().getTime() - this.state.lastDetectedFailure.getTime();
            if (elapsed > this.configuration.recoveryTimeout) {
                this.updateState({
                    status: CircuitBreakerStatus.HALF_OPEN,
                    consecutiveFailures: this.state.consecutiveFailures,
                    lastDetectedFailure: this.state.lastDetectedFailure,
                });
                return CircuitBreakerStatus.HALF_OPEN;
            }
        }
        return this.state.status;
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
        const consecutiveFailures = this.state.consecutiveFailures + 1;
        let targetStatus = this.state.status;

        if (consecutiveFailures > this.configuration.failureThreshold) {
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
        let targetStatus = this.state.status;

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
                    throw new CircuitBreakerError(`${this.configuration.id} is OPEN`);
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
                return Promise.reject(new CircuitBreakerError(`Circuit ${this.configuration.id} is OPEN`));
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
