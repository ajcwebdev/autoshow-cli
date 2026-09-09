# Setup Tests

The no-cost `test/test-cases/validation/cli/network-check-contracts.test.ts` covers option validation, readiness, all three clients, bounded failure, and fixture cleanup; `docker-workspace-invocation.test.ts` executes the documented shell function with fake Docker to verify literal arguments, mounts, Linux ownership, environment enforcement, image override, and failure propagation. A real 150-second Docker host-gateway fixture probe is separate container acceptance.

Coverage for the `setup` command, `--doctor`, progress output, and managed downloads.

Safety: this suite is local and no-cost. Downloads are mocked, so nothing here calls a paid or quota-limited provider.

## Quick Start

```bash
bun test test/test-cases/validation/setup/
```

## Price Preflight

Setup has no provider-priced commands, so `--price` and `--budget` do not estimate anything for this suite.

## Related Docs

- [Testing Overview](../../testing.md)
- [Setup](setup.md)
