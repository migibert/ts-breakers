import { CircuitBreakerStatus, CircuitBreakerState } from './CircuitBreakerState';

class LocalCircuitBreakerState implements CircuitBreakerState {
    private status: CircuitBreakerStatus;
    private recoveryTimeout: number;
    private failureThreshold: number;
    private consecutiveFailures: number;
    private lastDetectedFailure?: Date;
    private observers: ((previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void)[];

    public constructor(recoveryTimeout: number, failureThreshold: number) {
        this.status = CircuitBreakerStatus.CLOSED;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.consecutiveFailures = 0;
        this.observers = [];
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

    public addObserver(
        observer: (previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void,
    ): void {
        this.observers.push(observer);
    }

    private notify(previousStatus: CircuitBreakerStatus, currentStatus: CircuitBreakerStatus) {
        for (const observer of this.observers) {
            observer(previousStatus, currentStatus);
        }
    }

    public getStatus(): CircuitBreakerStatus {
        if (this.status === CircuitBreakerStatus.OPEN) {
            if (!this.lastDetectedFailure) {
                throw new Error('Inconsistent state: an OPEN circuit must have a last detected failure date');
            }
            const elapsed = new Date().getTime() - this.lastDetectedFailure.getTime();
            if (elapsed > this.recoveryTimeout) {
                this.halfOpen();
            }
        }
        return this.status;
    }

    private setStatus(status: CircuitBreakerStatus) {
        const previousStatus = this.status;
        this.status = status;
        this.notify(previousStatus, status);
    }

    private close() {
        this.setStatus(CircuitBreakerStatus.CLOSED);
    }

    private open() {
        this.setStatus(CircuitBreakerStatus.OPEN);
        this.lastDetectedFailure = new Date();
    }

    private halfOpen() {
        this.setStatus(CircuitBreakerStatus.HALF_OPEN);
        this.consecutiveFailures = 0;
    }

    public onFailure() {
        this.consecutiveFailures++;
        if (this.consecutiveFailures > this.failureThreshold) {
            this.open();
        }
        if (this.isHalfOpen()) {
            this.open();
        }
    }

    public onSuccess() {
        this.consecutiveFailures = 0;
        if (this.isHalfOpen()) {
            this.close();
        }
    }
}

export { LocalCircuitBreakerState };
