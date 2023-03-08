import { CircuitBreakerError } from './CircuitBreakerError';
import { CircuitBreakerDecorator } from './CircuitBreakerDecorator';

describe('CircuitBreakerDecorator test Suite', () => {
    @CircuitBreakerDecorator({
        failureThreshold: 1,
        recoveryTimeout: 3000,
    })
    class ClassUnderTest {
        public unstableFn(shouldThrow: boolean): boolean {
            if (shouldThrow === true) {
                throw new Error('I am failing');
            }
            return shouldThrow;
        }
    }

    let myInstance: ClassUnderTest;

    beforeEach(() => {
        myInstance = new ClassUnderTest();
    });

    test('should throw a CircuitBreakerError when consecutive fail are superior to 1', () => {
        try {
            const result = () => {
                try {
                    myInstance.unstableFn(true);
                } catch (e) {
                    if (e instanceof CircuitBreakerError) {
                        throw e;
                    }
                    result();
                }
            };
            result();
        } catch (e) {
            expect(e).toBeInstanceOf(CircuitBreakerError);
        }
    });
});
