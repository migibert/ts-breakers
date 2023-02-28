[![npm version](https://badge.fury.io/js/ts-breakers.svg)](https://badge.fury.io/js/ts-breakers)
[![Build Status](https://circleci.com/gh/migibert/ts-breakers.svg?style=shield)](https://circleci.com/gh/migibert/ts-breakers)
[![codecov](https://codecov.io/gh/migibert/ts-breakers/branch/main/graph/badge.svg?token=CTV9BCN9LK)](https://codecov.io/gh/migibert/ts-breakers)


# ts-breakers

This package aims to provide a simple, basic and efficient Circuit Breaker implementation.

The CircuitBreaker pattern is a stateful pattern, as it associates a state to function calls in order to decide if it should fail fast, give a try to the function execution, or execute it normally.


## Usage

Some usage examples are available as tests in `CircuitBreaker.test.ts` file.

The most basic example is to create a `CircuitBreaker` instance (for holding the state) then associate it to your subject to failure function by wrapping it.

The wrapped function has the exact same interface than the function it wraps and two functions are offered for wrapping synchronous and asynchronous functions.

### Synchronous interface

To wrap a synchronous function, you have to call `circuitBreaker.wrapFunction`.

```
const sum = (a: number, b: number): number => a + b;
const cb = new CircuitBreaker('mycb', 5, 2000);
const wrapped = cb.wrapFunction(sum);
const result = wrapped(2, 3);
expect(result).toBe(5);
```

You may also want to be notified on state changes for logging or collecting metric:

```
const sum = (a: number, b: number): number => a + b;
const cb = new CircuitBreaker('mycb', 5, 2000);
cb.addObserver((previousState: CircuitBreakerState, currentState: CircuitBreakerState) => {
    console.log(`${previousState} => ${currentState}`);
});

const wrapped = cb.wrapFunction(sum);
const result = wrapped(2, 3);
expect(result).toBe(5);
```

### Asynchronous interface

To wrap an asynchronous function, you have to call `circuitBreaker.wrapAsyncFunction`.

Example:

```
const sum = async (a: number, b: number): Promise<number> => {
    return Promise.resolve(a + b);
}

const cb = new CircuitBreaker('mycb', 5, 2000);
const wrapped = cb.wrapAsyncFunction(sum);
const result = wrapped(2, 3);
await expect(result).resolves.toBe(5);
```

You may also want to be notified on state changes for logging or collecting metric:

```
const sum = async (a: number, b: number): Promise<number> => {
    return Promise.resolve(a + b);
}
const cb = new CircuitBreaker('mycb', 5, 2000);
cb.addObserver((previousState: CircuitBreakerState, currentState: CircuitBreakerState) => {
    console.log(`${previousState} => ${currentState}`);
});

const wrapped = cb.wrapAsyncFunction(sum);
const result = wrapped(2, 3);
await expect(result).resolves.toBe(5);
```


## Decorator

It is also possible to use the `@CircuitBreakerDecorator` decorator to wrap all members of a class.

```
@CircuitBreakerDecorator({
    failureThreshold: 1,
    recoveryTimeout: 3000,
})
class MyClass {...}
```

## Testing

Tests are run:

* locally by using `npm test` which runs jest test suite on the local branch
* within the CI which runs jest tests suite on every pushed branch and collects the test report within CircleCI UI


The tests are meant to cover the state machine transitions. They are designed as parameterized tests and written to serve as usage example for the end user.


## Publishing a new version

Use the standard `npm version x.y.z` to update the package version, tag the main branch and push the tags to the GitHub repository.

The CircleCI pipeline will run the tests and publish the new package to npm.