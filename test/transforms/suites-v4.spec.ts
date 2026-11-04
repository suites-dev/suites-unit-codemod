import jscodeshift from 'jscodeshift';
import type { API } from 'jscodeshift';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import transform from '../../src/transforms/suites/3/to-suites-v4';
import { getTransform } from '../../src/transforms';
import { transform as migrateAutomock } from '../../src/transform';
import { loadFixturePair } from '../utils/fixture-loader';

const api = { jscodeshift: jscodeshift.withParser('tsx') } as API;

describe('Suites 3 to 4', () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'suites-v4-')); });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  const options = { doubles: 'jest' as const, di: 'nestjs' as const };
  function migrate(source: string, config = options, name = 'test.ts') {
    return transform({ source, path: join(directory, name) }, api, config);
  }
  function manifest(deps: string[], location = directory) {
    mkdirSync(location, { recursive: true });
    writeFileSync(join(location, 'package.json'), JSON.stringify({ devDependencies: Object.fromEntries(deps.map(dep => [dep, '^3.0.0'])) }));
  }

  it('registers the transform', () => expect(getTransform('suites/3/to-suites-v4')?.path).toBe('./transforms/suites/3/to-suites-v4'));
  it('composes Automock to Suites 3 and Suites 3 to 4 migrations', () => {
    const source = loadFixturePair('complex-impl').input;
    const v3 = migrateAutomock({ source, path: join(directory, 'test.ts') }, api);
    const v4 = migrate(v3);
    expect(v4).not.toContain('@automock/');
    expect(v4).toContain('TestBed.solitary');
    expect(v4).toContain('@suites/doubles.jest/unit');
    expect(v4).toContain('@suites/di.nestjs/metadata');
    expect(migrate(v4)).toBe(v4);
  });
  it('adds explicit references without changing TestBed API', () => {
    const source = "import { TestBed, type Mocked } from '@suites/unit';\nconst bed = TestBed.solitary(Service).compile();";
    const output = migrate(source);
    expect(output).toContain('reference types="@suites/doubles.jest/unit"');
    expect(output).toContain('reference types="@suites/di.nestjs/metadata"');
    expect(output).toContain(source);
    expect(migrate(output)).toBe(output);
  });
  it('moves only helpers and preserves aliases, type imports, and existing bindings', () => {
    const source = "import { TestBed, mock as createMock, stub, type Mocked } from '@suites/unit';\nimport { mock as adapterMock } from '@suites/doubles.jest';\nconst a = createMock<Service>(); const b = stub(); const c = adapterMock<Service>();";
    const output = migrate(source);
    expect(output).toMatch(/import \{ mock as createMock, stub \} from ["']@suites\/doubles.jest["']/);
    expect(output).toContain('type Mocked');
    expect(output).toContain('mock as adapterMock');
    expect(output).toContain('const a = createMock<Service>();');
    expect(migrate(output)).toBe(output);
  });
  it('does not require or add DI augmentation for standalone consumers', () => {
    manifest(['@suites/doubles.vitest']);
    const output = migrate("import { mock, stub, type Mocked } from '@suites/unit';", {} as typeof options);
    expect(output).toContain('@suites/doubles.vitest');
    expect(output).not.toContain('@suites/di.');
  });
  it('preserves type-only helper imports as type-only', () => {
    const output = migrate("import type { mock as MockFunction, Mocked } from '@suites/unit';");
    expect(output).toMatch(/import type \{ mock as MockFunction \} from ["']@suites\/doubles.jest["']/);
  });
  it('resolves adapters from each nearest package, not workspace siblings or root', () => {
    manifest(['@suites/doubles.jest', '@suites/di.nestjs']);
    manifest(['@suites/doubles.vitest', '@suites/di.inversify'], join(directory, 'nested'));
    const output = migrate("import { TestBed } from '@suites/unit';", {} as typeof options, 'nested/test.ts');
    expect(output).toContain('@suites/doubles.vitest/unit');
    expect(output).toContain('@suites/di.inversify/metadata');
    expect(output).not.toContain('@suites/doubles.jest');
  });
  it('stops at a nearest manifest with no adapters', () => {
    manifest(['@suites/doubles.jest', '@suites/di.nestjs']);
    manifest([], join(directory, 'nested'));
    expect(() => migrate("import { TestBed } from '@suites/unit';", {} as typeof options, 'nested/test.ts')).toThrow('Cannot determine doubles adapter');
  });
  it('rewrites obsolete directives and side-effect type imports without runtime type-only paths', () => {
    const source = '/// <reference types="@suites/doubles.jest/types" />\nimport "@suites/di.nestjs/types";\nexport {};';
    const output = migrate(source, options, 'suites.d.ts');
    expect(output).toContain('reference types="@suites/doubles.jest/unit"');
    expect(output).toContain('reference types="@suites/di.nestjs/metadata"');
    expect(output).not.toContain('/types');
    expect(output).not.toContain('import ');
    expect(migrate(output, options, 'suites.d.ts')).toBe(output);
  });
  it('adds DI declaration to existing declaration setup from installed adapter', () => {
    manifest(['@suites/doubles.jest', '@suites/di.nestjs']);
    const output = migrate('/// <reference types="@suites/doubles.jest/unit" />', {} as typeof options, 'suites.d.ts');
    expect(output).toContain('@suites/di.nestjs/metadata');
  });
  it('converts current declaration-only side-effect imports into references', () => {
    const output = migrate('import "@suites/doubles.jest/unit";\nimport "@suites/di.nestjs/metadata";');
    expect(output).not.toContain('import ');
    expect(output).toContain('reference types="@suites/di.nestjs/metadata"');
  });
  it('adds augmentation for named TestBed re-exports', () => {
    const output = migrate("export { TestBed as Bed } from '@suites/unit';");
    expect(output).toContain('@suites/di.nestjs/metadata');
    expect(output).toContain('TestBed as Bed');
  });
  it('adds explicit DI selection to declaration setup without installed DI', () => {
    const output = migrate('/// <reference types="@suites/doubles.jest/unit" />', options, 'suites.d.ts');
    expect(output).toContain('@suites/di.nestjs/metadata');
  });
  it('rejects incompatible root adapter imports', () => {
    expect(() => migrate("import { mock } from '@suites/unit';\nimport { stub } from '@suites/doubles.vitest';")).toThrow('Conflicting doubles');
  });
  it('requires selection for multiple installed adapters even with a file reference', () => {
    manifest(['@suites/doubles.jest', '@suites/doubles.vitest']);
    expect(() => migrate('/// <reference types="@suites/doubles.jest/unit" />', {} as typeof options)).toThrow('Multiple doubles');
  });
  it('preserves license comments attached to removed type imports', () => {
    const output = migrate('/* Copyright 2026 License */\nimport "@suites/doubles.jest/types";\nexport {};');
    expect(output).toContain('/* Copyright 2026 License */');
    expect(output).not.toContain('import ');
  });
  it('moves string-literal helper imports', () => {
    const output = migrate("import { 'mock' as makeMock } from '@suites/unit';");
    expect(output).toContain('@suites/doubles.jest');
    expect(output).not.toContain("from '@suites/unit'");
  });
  it('preserves CRLF when rewriting imports', () => {
    const output = migrate("import { mock } from '@suites/unit';\r\nconst value = mock<Service>();\r\n");
    expect(output.replace(/\r\n/g, '')).not.toContain('\n');
  });
  it('rejects references conflicting with the package adapter', () => {
    manifest(['@suites/doubles.jest']);
    expect(() => migrate('/// <reference types="@suites/doubles.vitest/unit" />', {} as typeof options)).toThrow('Conflicting doubles');
  });
  it('keeps the BOM at the start when rewriting imports and adding references', () => {
    const output = migrate("\uFEFFimport { mock } from '@suites/unit';\n");
    expect(output.startsWith('\uFEFF/// <reference')).toBe(true);
    expect(output.indexOf('\uFEFF', 1)).toBe(-1);
  });
  it('does not rewrite strings resembling references', () => {
    const source = 'const text = `/// <reference types="@suites/doubles.jest/types" />`;';
    expect(migrate(source)).toBe(source);
  });
  it('preserves already migrated and unrelated files byte-for-byte', () => {
    const source = '// plain file\nexport const mock = () => 1;\n';
    expect(migrate(source)).toBe(source);
    const ready = '/// <reference types="@suites/doubles.jest/unit" />\nimport { Mocked } from "@suites/unit";\n';
    expect(migrate(ready)).toBe(ready);
  });
  it('keeps CRLF and shebang before added references', () => {
    const output = migrate('#!/usr/bin/env node\r\nimport { TestBed } from "@suites/unit";\r\n');
    expect(output.startsWith('#!/usr/bin/env node\r\n/// <reference')).toBe(true);
    expect(output.replace(/\r\n/g, '')).not.toContain('\n');
  });
  it.each([
    ["import * as Suites from '@suites/unit'; const mock = Suites.mock();", 'Namespace/default'],
    ["const { mock } = require('@suites/unit');", 'CommonJS/dynamic'],
    ["type Mock = typeof import('@suites/unit').mock;", 'Inline import types'],
    ["import Suites = require('@suites/unit');", 'import-equals'],
    ["export { 'mock' as makeMock } from '@suites/unit';", 'Re-exported'],
    ["export * from '@suites/unit';", 'Star/namespace'],
    ["export * as Suites from '@suites/unit';", 'Star/namespace'],
    ["const suites = import('@suites/unit');", 'CommonJS/dynamic'],
    ["export { mock as makeMock } from '@suites/unit';", 'Re-exported'],
    ['/// <reference types="@suites/doubles.sinon/types" />', 'Sinon'],
    ["import { mock } from '@suites/unit'; import { stub } from '@suites/doubles.sinon';", 'Sinon'],
    ["import { mock } from '@suites/doubles.sinon';", 'Sinon'],
    ['/// <reference types="@suites/doubles.vitest/unit" />', 'Conflicting doubles'],
    ['import { Foo } from "@suites/doubles.jest/types";', 'Named imports'],
  ])('rejects unsupported input without guessing: %s', (source, message) => {
    expect(() => migrate(source)).toThrow(message);
  });
  it('rejects ambiguous installed adapters unless explicitly selected', () => {
    manifest(['@suites/doubles.jest', '@suites/doubles.vitest', '@suites/di.nestjs']);
    const source = "import { TestBed } from '@suites/unit';";
    expect(() => migrate(source, {} as typeof options)).toThrow('Multiple doubles');
    expect(migrate(source)).toContain('@suites/doubles.jest/unit');
  });
  it('reports installed Sinon and allows explicit selection after manual migration', () => {
    manifest(['@suites/doubles.sinon', '@suites/doubles.jest']);
    const source = "import { mock } from '@suites/unit';";
    expect(() => migrate(source, {} as typeof options)).toThrow('Sinon is not supported');
    expect(migrate(source)).toContain('@suites/doubles.jest');
  });
});
