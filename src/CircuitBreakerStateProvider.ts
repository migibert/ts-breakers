import { CircuitBreakerState } from './providers/InMemoryCircuitBreakerState';

interface CircuitBreakerStateProvider {
    provide(): CircuitBreakerState;

    update(state: CircuitBreakerState): void;
}

export { CircuitBreakerStateProvider };
