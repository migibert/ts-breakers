[![npm version](https://badge.fury.io/js/ts-breakers.svg)](https://badge.fury.io/js/ts-breakers)

[![Build Status](https://circleci.com/gh/migibert/ts-breakers.svg?style=shield)](https://circleci.com/gh/migibert/ts-breakers)

# ts-breakers

This package aims to provide a simple, basic and efficient Circuit Breaker implementation.

The CircuitBreaker pattern is a stateful pattern, as it associates a state to function calls in order to decide if it should fail fast, give a try to the function execution, or execute it normally.


## Usage

Some usage examples are available as tests in `CircuitBreaker.test.ts` file.

The most basic example is to create a `CircuitBreaker` instance (for holding the state) then associate it to your subject to failure function by wrapping it.

One example worth thousands words:

```
const sum = (a: number, b: number): number => a + b;
const cb = new CircuitBreaker('mycb', 5, 2000);
const wrapped = cb.wrapFunction(sum);
const result = wrapped(2, 3);
expect(result).toBe(5);
```

## Testing

Tests are run:

* locally by using `npm test` which runs jest test suite on the local branch
* within the CI which runs jest tests suite on every pushed branch and collects the test report within CircleCI UI

## Publishing a new version

Use the standard `npm version x.y.z` to update the package version, tag the main branch and push the tags to the GitHub repository.

The CircleCI pipeline will run the tests and publish the new package to npm.