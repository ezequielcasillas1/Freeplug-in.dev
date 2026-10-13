# Security notes

## Accepted advisories

### GHSA-vfj7-8cjw-p6xm (braces, high), accepted as dev-only
- Path: eslint-config-next 16.3.8 > @next/eslint-plugin-next 16.3.8 > fast-glob 3.3.1 > micromatch 4.0.8 > braces 3.0.3
- Shows in `npm audit` as 5 high entries: braces, micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next.
- Why accepted: lint tooling only. It's a devDependency, isn't in the Next/OpenNext server or client bundles, and it only processes our own repo globs, not user input.
- npm's suggested fix downgrades eslint-config-next to 14.2.35 (a semver-major step back). We are not downgrading.
- Ruling: Aria, Oct 13 2026.
- revisit when eslint-config-next 16.x ships a fix.
