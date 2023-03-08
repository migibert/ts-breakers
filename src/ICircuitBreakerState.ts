enum CircuitBreakerStatus {
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
    CLOSED = 'CLOSED',
}

interface ICircuitBreakerState {
    getStatus(): CircuitBreakerStatus;

    isClosed(): boolean;

    isOpen(): boolean;

    isHalfOpen(): boolean;

    fail(): void;

    succeed(): void;

    addObserver(observer: (previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void): void;
}

export { ICircuitBreakerState, CircuitBreakerStatus };
