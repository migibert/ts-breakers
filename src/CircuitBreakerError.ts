class CircuitBreakerError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export { CircuitBreakerError };
