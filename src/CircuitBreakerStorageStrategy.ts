import { CircuitBreakerConfiguration, CircuitBreakerState } from './CircuitBreaker';

interface CircuitBreakerStorageStrategy {
    saveState(state: CircuitBreakerState): void;

    loadState(): CircuitBreakerState;

    saveConfiguration(configuration: CircuitBreakerConfiguration): void;

    loadConfiguration(): CircuitBreakerConfiguration;
}

export { CircuitBreakerStorageStrategy };
