# @suites/codemod

[![npm version](https://img.shields.io/npm/v/@suites/codemod.svg)](https://www.npmjs.com/package/@suites/codemod)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Code transformation toolkit for the Suites testing framework

Automated code transformations for Suites projects. Built on [jscodeshift](https://github.com/facebook/jscodeshift) with intelligent AST-based transformations, built-in validation, and TypeScript-first support.

## Usage

```bash
npx @suites/codemod <codemod> <source> [options]
```

**Example:**

```bash
npx @suites/codemod automock/2/to-suites-v3 src/**/*.spec.ts
```

Run with `--dry` or `-d` to preview changes without modifying files.

## Available Codemods

- **`suites/3/to-suites-v4`** - Add explicit Suites v4 type references and clean up legacy helper imports
- **`automock/2/to-suites-v3`** - Migrate test files from Automock v2 to Suites v3 testing framework

## Example

### Before (Automock)

```typescript
import { TestBed } from '@automock/jest';

describe('UserService', () => {
  let service: UserService;

  beforeAll(() => {
    const { unit } = TestBed.create(UserService)
      .mock(UserRepository)
      .using({ findById: jest.fn() })
      .compile();
    service = unit;
  });
});
```

### After (Suites)

```typescript
import { TestBed } from '@suites/unit';

describe('UserService', () => {
  let service: UserService;

  beforeAll(async () => {
    const { unit } = await TestBed.solitary(UserService)
      .mock(UserRepository)
      .final({ findById: jest.fn() })
      .compile();
    service = unit;
  });
});
```

## CLI Reference

### Arguments

| Argument  | Description                                                             | Default |
| --------- | ----------------------------------------------------------------------- | ------- |
| `codemod` | Codemod slug to run. See available transforms below.                    | -       |
| `source`  | Path to source files or directory to transform including glob patterns. | `.`     |

### Options

| Option              | Description                                               | Default |
| ------------------- | --------------------------------------------------------- | ------- |
| `-v, --version`     | Output the current version                                | -       |
| `-d, --dry`         | Dry run (no changes are made to files)                    | `false` |
| `-f, --force`       | Bypass Git safety checks and forcibly run codemods        | `false` |
| `-p, --print`       | Print transformed files to stdout, useful for development | `false` |
| `--verbose`         | Show more information about the transform process         | `false` |
| `--doubles <adapter>` | Suites v4 doubles adapter: `jest` or `vitest` | inferred |
| `--di <adapter>` | Suites v4 DI adapter: `nestjs` or `inversify` | inferred |
| `--parser <parser>` | Parser to use: `tsx`, `ts`, `babel`                       | `tsx`   |
| `-h, --help`        | Display help message                                      | -       |

**Examples:**

```bash
# Preview changes (dry run)
npx @suites/codemod automock/2/to-suites-v3 src --dry

# Print output to stdout
npx @suites/codemod automock/2/to-suites-v3 src/file.ts -p

# Verbose output
npx @suites/codemod automock/2/to-suites-v3 src --verbose

# Use different parser
npx @suites/codemod automock/2/to-suites-v3 src --parser babel
```

## Transform Details

### `suites/3/to-suites-v4`

Suites 4 stops patching declaration files during installation. This transform makes adapter augmentation explicit in your selected TypeScript source and declaration files:

```bash
# Run separately for each test TypeScript project.
npx @suites/codemod suites/3/to-suites-v4 ./src --dry --print

# Select adapters explicitly when they cannot be inferred.
npx @suites/codemod suites/3/to-suites-v4 'tests/**/*.ts' --doubles jest --di nestjs --dry

# Apply after reviewing the preview.
npx @suites/codemod suites/3/to-suites-v4 ./src
```

**Release availability:** This transform requires a codemod release containing it. It is not included in `@suites/codemod@0.1.0`. To try this checkout before release, run `pnpm install --frozen-lockfile`, `pnpm build`, then replace `npx @suites/codemod` with `node /path/to/codemod/bin/suites-codemod.js`.

**Automatic changes:**

- Adds a `/// <reference types="@suites/doubles.jest/unit" />` or Vitest equivalent to files using Suites types/API. Files using TestBed also receive their DI adapter's `/metadata` reference. Standalone `mock`, `stub`, `Mocked`, and `Stub` consumers do not need a DI adapter.
- Includes `.d.ts` files, preserving existing references and adding missing DI metadata when a DI adapter is installed. Unrelated declarations are unchanged.
- Moves named `mock` and `stub` imports from `@suites/unit` to the selected doubles adapter, preserving aliases and type-only imports. This repairs older examples and Automock codemod output; these helpers were not public exports of `@suites/unit` in v3.1.1 either.
- Rewrites obsolete adapter `/types` references to `/unit` or `/metadata`. `/types` was not a canonical v3 export. Side-effect imports of declaration-only entry points become triple-slash references, never runtime imports of those paths.
- Preserves `TestBed.solitary()`, `TestBed.sociable()`, `.compile()`, mock configuration, and dependency retrieval calls.

The transform selects one doubles adapter (`--doubles jest|vitest`) and, where needed, one DI adapter (`--di nestjs|inversify`). It reads only the nearest `package.json`, considering dependencies, devDependencies, and peerDependencies. Existing references and adapter imports also identify an adapter when the manifest does not. Multiple installed adapters require explicit selection even when a file has a reference. Conflicting references/imports must be fixed manually. Run separately for test projects with different adapters.

References are added per file so this transform does not guess your tsconfig inheritance or include patterns. You may consolidate them into a shared `suites.d.ts` afterward, provided your test tsconfig includes it. Already migrated files are unchanged on repeated runs. Both `--dry` and `--print` prevent writes.

**Manual work and limitations:**

- Upgrade Suites packages together to v4 and check runtime/framework peer requirements using the [v4 migration guide](https://suites.dev/docs/migration-guides/from-v3/). Package manifests, lockfiles, tsconfigs, test-runner settings, and installed packages are not changed.
- Migrate Sinon calls/assertions manually and remove its unsupported adapter. The codemod reports Sinon rather than selecting a replacement. An explicit doubles choice does not convert Sinon APIs.
- Review NestJS metadata arguments and Inversify decorators/injection changes manually. The transform does not remove arguments or infer DI tokens.
- Namespace/default imports, CommonJS/dynamic/import-equals imports, inline import types, star re-exports, and helper re-exports from `@suites/unit` receive actionable errors. Convert these to named imports/exports before retrying.
- Only `.ts` and `.tsx` source files are processed, including `.d.ts` for this transform. Use a directory or a quoted glob. Include your declaration setup files in the selected target, and update any obsolete references in `tsconfig.compilerOptions.types` manually.

An error leaves the affected file unchanged and makes the CLI exit nonzero. Other files may have completed, so use a clean Git tree and preview first. `--allow-critical-errors` does not bypass v4 safety errors. After applying, review the diff, run your TypeScript check, and run your test suite.

### `automock/2/to-suites-v3`

Intelligently migrates Automock v2 test files to Suites v3 framework.

**What it transforms:**

- Import statements: `@automock/jest` -> `@suites/unit`
- TestBed API: `TestBed.create()` -> `TestBed.solitary().compile()`
- Mock configuration: `.using()` -> `.impl()` or `.final()`
- Type annotations: `jest.Mocked<T>` -> `Mocked<T>` from `@suites/unit`
- Async/await: Adds `async`/`await` to test hooks as needed
- Mock retrieval: Intelligently selects `.impl()` vs `.final()` strategy
- Jest globals: Preserves `jest` imports where needed
- Type casts: Removes obsolete type assertions

**Mock Strategy Selection:**

The codemod automatically chooses between `.impl()` and `.final()`:

- **`.impl()`** - Used when mocks are retrieved via `unitRef.get()` and need runtime manipulation (spy assertions, dynamic mock configuration)
- **`.final()`** - Used when mocks are provided as final implementations without retrieval

**Validation:**

Built-in validation ensures:

- No `@automock` imports remain
- `TestBed.create()` is converted to `TestBed.solitary()`
- `.compile()` is called with proper `await`
- Mock strategies are correctly applied
- Retrieved mocks use `.impl()` strategy

## Requirements

- **Node.js**: `^16.10.0 || ^18.12.0 || >=20.0.0`
- **Project Type**: TypeScript or JavaScript
- **Git**: Clean working directory recommended (bypass with `--force`)

## Troubleshooting

**"Working directory is not clean"**

- Commit your changes or use `--force` to bypass

**"No files found"**

- Check your source path and ensure it contains `.ts` or `.tsx` files

**Parser errors**

- Try the babel parser: `--parser babel`

**Validation failed**

- Run with `--verbose` for detailed logs
- Review validation errors in the output
- Fix the issues reported by validators

For more help, see [troubleshooting guide](https://github.com/suites-dev/suites-unit-codemod/issues) or open an issue.

## How It Works

The codemod uses [jscodeshift](https://github.com/facebook/jscodeshift) to:

1. Parse TypeScript/JavaScript into an Abstract Syntax Tree (AST)
2. Apply intelligent transformations (imports, TestBed API, mocks, types)
3. Validate the transformed code
4. Output the result

**TypeScript Support:** First-class support with fallback parser for complex syntax (generics, type guards, decorators, JSX/TSX).

## Architecture

This codemod follows the **Codemod Registry** pattern used by React, Next.js, and other major frameworks:

**Transform Naming:** `<framework>/<version>/<transform>`

- `automock/2/to-suites-v3` - Current migration
- `automock/3/to-suites-v4` - Future migrations
- Supports multiple transforms per version
- Extensible to other frameworks (e.g., `jest/28/to-v29`)

**Directory Structure:**

```
src/transforms/
  automock/              # Framework namespace
    2/                   # Source version
      to-suites-v3.ts    # Migration transform
    3/                   # Future: next version
      to-suites-v4.ts
```

**Design Benefits:**

- No default transform - explicit selection prevents mistakes
- Version-based organization supports migration chains
- Framework namespacing allows multi-framework support
- Clear source → target versioning

## Contributing

Contributions welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run tests: `npm test` and linter: `npm run lint`
5. Commit: `git commit -m "feat: add feature"`
6. Push and open a Pull Request

### Adding New Transforms

1. Create transform directory: `src/transforms/<framework>/<version>/<transform-name>.ts`
2. **Export a default function** that follows jscodeshift's transform signature:

   ```typescript
   import type { FileInfo, API, Options } from 'jscodeshift';
   import { transform } from '../../../transform';

   export default transform;
   ```

   Or implement your own transform function:

   ```typescript
   import type { FileInfo, API, Options } from 'jscodeshift';

   export default function transform(
     fileInfo: FileInfo,
     api: API,
     options: Options
   ): string | null | undefined {
     // Your transform logic here
     return transformedCode;
   }
   ```

3. Register in `src/transforms/index.ts`:
   ```typescript
   {
     name: 'framework/version/transform-name',
     description: 'Description of what it does',
     path: './transforms/framework/version/transform-name',
   }
   ```
4. Add test fixtures in `fixtures/`
5. Add integration tests in `test/integration/`
6. Update this README

**Example:**

```typescript
// src/transforms/automock/3/to-suites-v4.ts
import { transform } from '../../../transform';

export default transform;
```

### Project Structure

```
src/
  analyzers/        # Code analysis utilities
  transforms/       # Transform implementations
    automock/       # Framework namespace
      2/            # Version-specific transforms
        to-suites-v3.ts
    index.ts        # Transform registry
  validators/       # Post-transform validation
  utils/            # Shared utilities
  cli.ts            # CLI interface
  runner.ts         # Transform runner
  transform.ts      # Main transform logic

test/
  integration/      # Integration tests
  transforms/       # Transform unit tests
  fixtures/         # Test fixtures (before/after)
```

## License

MIT (c) [Omer Morad](https://github.com/omermorad)

## Links

- [Suites Documentation](https://suites.dev)
- [GitHub Repository](https://github.com/suites-dev/suites-unit-codemod)
- [Issue Tracker](https://github.com/suites-dev/suites-unit-codemod/issues)
- [NPM Package](https://www.npmjs.com/package/@suites/codemod)

## Related Projects

- [@suites/unit](https://github.com/suites-dev/suites) - The Suites testing framework
- [jscodeshift](https://github.com/facebook/jscodeshift) - JavaScript codemod toolkit
- [@automock/jest](https://github.com/automock/automock) - Automock testing framework

---

**Need help?** Open an issue on [GitHub](https://github.com/suites-dev/suites-unit-codemod/issues) or check the [Suites documentation](https://suites.dev).
