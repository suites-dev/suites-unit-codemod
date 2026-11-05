# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/suites-dev/suites-unit-codemod/compare/@suites/codemod@0.1.0...@suites/codemod@0.2.0) (2026-11-05)

### Features

* add Suites v4 migration codemod ([#5](https://github.com/suites-dev/suites-unit-codemod/issues/5)) ([70c7cb2](https://github.com/suites-dev/suites-unit-codemod/commit/70c7cb286c2ffea56d1be3ef0577a898a5bc1ea6))

### Bug Fixes

* align release metadata with renamed repository ([#6](https://github.com/suites-dev/suites-unit-codemod/issues/6)) ([438a041](https://github.com/suites-dev/suites-unit-codemod/commit/438a0410ef2257890983316d02c9905f6890e2cb))
* use release bot and npm trusted publishing ([#7](https://github.com/suites-dev/suites-unit-codemod/issues/7)) ([b8542cf](https://github.com/suites-dev/suites-unit-codemod/commit/b8542cf86877c2297cc18278ae07fab7ee207ae3))

## [0.1.0](https://github.com/suites-dev/codemod/compare/@suites/codemod@0.0.0...@suites/codemod@0.1.0) (2026-05-05)

### ⚠ BREAKING CHANGES

* Transform argument now required. Users must specify:
  npx @suites/codemod automock/2/to-suites-v3 <path>

Changes:
- Transform registry: Updated to automock/2/to-suites-v3
- Directory structure: Created hierarchical namespace src/transforms/automock/2/
- CLI: Removed default transform, require explicit specification
- File processor: Renamed to generic naming (filterSourceFiles)
- Runner: Updated variable naming (automockFiles → sourceFiles)
- Tests: Updated imports, all 207 tests passing
- Documentation: Updated README with new usage examples

Benefits:
- Follows React codemod and Codemod Registry patterns
- Future-proof for v3-to-v4, v4-to-v5 migrations
- Support for multiple transforms per version
- Extensible to other frameworks (jest, vitest, etc.)

### Features

* add manual publish workflow and coverage tracking ([82f6da6](https://github.com/suites-dev/codemod/commit/82f6da67f3f0e8a177e23a091375c7e8364a4be6))
* complete Automock to Suites codemod with TypeScript parser fallback ([0fcb66e](https://github.com/suites-dev/codemod/commit/0fcb66ecd5c5d3d50a06e99dbdd0acc03f637464))

### Bug Fixes

* remove duplicate symbols from logger output ([915ca24](https://github.com/suites-dev/codemod/commit/915ca24cb0b75db1f6cc1508239efb80f976d760))
* use consistent checkmark symbol (✔) in logger output ([e95d2fc](https://github.com/suites-dev/codemod/commit/e95d2fc71a7670096e144c271f570b181a29e0a1))

### Documentation

* add architecture section and local development guide ([a6e821c](https://github.com/suites-dev/codemod/commit/a6e821cc3c8014d54c739822235235d0b8c85c1a))
* add CLI arguments section matching Next.js format ([362265a](https://github.com/suites-dev/codemod/commit/362265ae21fef3488991ed86c705c43f9d2680f3))
* new readme file [skip ci] ([9c4a9ea](https://github.com/suites-dev/codemod/commit/9c4a9eaf9fda4096240d870f61e10ab948987872))

### Code Refactoring

* adopt codemod registry naming pattern ([#1](https://github.com/suites-dev/codemod/issues/1)) ([8abdedd](https://github.com/suites-dev/codemod/commit/8abdedddb856d0531d400b93973ff6012d232062))
* adopt codemod registry naming pattern (automock/2/to-suites-v3) ([eae87f7](https://github.com/suites-dev/codemod/commit/eae87f7297ba6a40359ae81faca1e8eeb6be040c))
* align argument names with Next.js codemod conventions ([fa0f792](https://github.com/suites-dev/codemod/commit/fa0f7925fb96ea0dba5b9684eeb54a70d93922ab))
* align CLI options with Next.js codemod conventions ([287c8ca](https://github.com/suites-dev/codemod/commit/287c8caabb407dcb6f02e0ffb621ae568b81081c))
* rename --list-transforms to --list-codemods for consistency ([f2c382d](https://github.com/suites-dev/codemod/commit/f2c382d2025cc40abc21141bf0cba94a8673b085))
* simplify CLI to match Next.js codemod (remove unnecessary options) ([94e91b4](https://github.com/suites-dev/codemod/commit/94e91b4f8b1f3e60b73d65629e76fe7bc1584268))
* use jscodeshift runner for file processing ([77d3704](https://github.com/suites-dev/codemod/commit/77d37047e0388641063e40629ee9a1d74a1f09b1))
