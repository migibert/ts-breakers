enum CircuitBreakerStatus {
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
    CLOSED = 'CLOSED',
}

interface CircuitBreakerState {
    getStatus(): CircuitBreakerStatus;

    isClosed(): boolean;

    isOpen(): boolean;

    isHalfOpen(): boolean;

    onFailure(): void;

    onSuccess(): void;

    addObserver(observer: (previousState: CircuitBreakerStatus, currentState: CircuitBreakerStatus) => void): void;
}

export { CircuitBreakerState, CircuitBreakerStatus };
