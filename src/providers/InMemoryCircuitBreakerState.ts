import { CircuitBreakerStatus } from '../ICircuitBreakerState';

class InMemoryCircuitBreakerState {
    private status: CircuitBreakerStatus;
    private recoveryTimeout: number;
    private failureThreshold: number;
    private consecutiveFailures: number;
    private lastDetectedFailure?: Date;
    private observers: ((previousStatus: CircuitBreakerStatus, currentStatus: CircuitBreakerStatus) => void)[];

    public constructor(recoveryTimeout: number, failureThreshold: number) {
        this.status = CircuitBreakerStatus.CLOSED;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.consecutiveFailures = 0;
        this.observers = [];
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

    public isClosed() {
        return this.getStatus() === CircuitBreakerStatus.CLOSED;
    }

    public isOpen() {
        return this.getStatus() === CircuitBreakerStatus.OPEN;
    }

    public isHalfOpen() {
        return this.getStatus() === CircuitBreakerStatus.HALF_OPEN;
    }

    private updateStatus(status: CircuitBreakerStatus) {
        const previousStatus = this.status;
        this.status = status;
        for (const observer of this.observers) {
            observer(previousStatus, status);
        }
    }

    private close() {
        this.updateStatus(CircuitBreakerStatus.CLOSED);
    }

    private open() {
        this.updateStatus(CircuitBreakerStatus.OPEN);
        this.lastDetectedFailure = new Date();
    }

    private halfOpen() {
        this.updateStatus(CircuitBreakerStatus.HALF_OPEN);
        this.consecutiveFailures = 0;
    }

    public fail() {
        this.consecutiveFailures++;
        if (this.consecutiveFailures > this.failureThreshold) {
            this.open();
        }
        if (this.isHalfOpen()) {
            this.open();
        }
    }

    public succeed() {
        this.consecutiveFailures = 0;
        if (this.isHalfOpen()) {
            this.close();
        }
    }

    public addObserver(observer: (previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void) {
        this.observers.push(observer);
    }
}

export { InMemoryCircuitBreakerState, CircuitBreakerStatus };
