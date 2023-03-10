import { CircuitBreakerConfiguration, CircuitBreakerState } from './CircuitBreaker';
import { CircuitBreakerStorageStrategy } from './CircuitBreakerStorageStrategy';

class InMemoryCircuitBreakerStorageStrategy implements CircuitBreakerStorageStrategy {
    private state: CircuitBreakerState;
    private configuration: CircuitBreakerConfiguration;

    public constructor(state: CircuitBreakerState, configuration: CircuitBreakerConfiguration) {
        this.state = state;
        this.configuration = configuration;
    }

    saveState(state: CircuitBreakerState): void {
        this.state = state;
    }

    loadState(): CircuitBreakerState {
        return this.state;
    }

    saveConfiguration(configuration: CircuitBreakerConfiguration): void {
        this.configuration = configuration;
    }

    loadConfiguration(): CircuitBreakerConfiguration {
        return this.configuration;
    }
}

export { InMemoryCircuitBreakerStorageStrategy as InMemoryStorageStrategy };
