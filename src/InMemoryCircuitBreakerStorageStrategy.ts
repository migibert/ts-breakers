import { CircuitBreakerConfiguration, CircuitBreakerState } from './CircuitBreaker';
import { CircuitBreakerStorageStrategy } from './CircuitBreakerStorageStrategy';

class InMemoryCircuitBreakerStorageStrategy implements CircuitBreakerStorageStrategy {
    private configuration: CircuitBreakerConfiguration;
    private state: CircuitBreakerState;

    public constructor(configuration: CircuitBreakerConfiguration, state: CircuitBreakerState) {
        this.configuration = configuration;
        this.state = state;
    }

    public saveState(state: CircuitBreakerState): void {
        this.state = state;
    }

    public loadState(): CircuitBreakerState {
        return this.state;
    }

    public saveConfiguration(configuration: CircuitBreakerConfiguration): void {
        this.configuration = configuration;
    }

    public loadConfiguration(): CircuitBreakerConfiguration {
        return this.configuration;
    }
}

export { InMemoryCircuitBreakerStorageStrategy };
