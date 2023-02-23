class CircuitBreakerError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, CircuitBreakerError.prototype);
    }
}

export { CircuitBreakerError };
