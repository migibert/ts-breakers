import { CircuitBreakerState } from './InMemoryCircuitBreakerState';
import { CircuitBreakerStateProvider } from '../CircuitBreakerStateProvider';

class InMemoryStateProvider implements CircuitBreakerStateProvider {
    private state: CircuitBreakerState;

    public constructor() {
        this.state = new CircuitBreakerState();
    }

    provide(): CircuitBreakerState {
        return this.state;
    }

    update(state: CircuitBreakerState): void {
        this.state = state;
    }
}

export { InMemoryStateProvider };
