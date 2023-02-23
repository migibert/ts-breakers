# ts-breakers

This package aims to provide a simple, basic and efficient Circuit Breaker implementation.

## Testing

Tests are run:

* locally by using `npm test` which runs jest test suite on the local branch
* within the CI which runs jest tests suite on every pushed branch and collects the test report within CircleCI UI

## Publishing a new version

Use the standard `npm version x.y.z` to update the package version, tag the main branch and push the tags to the GitHub repository.

The CircleCI pipeline will run the tests and publish the new package to npm.