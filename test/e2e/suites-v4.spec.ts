import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const cli = join(__dirname, '../../bin/suites-codemod.js');
describe('Suites v4 CLI', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'suites-v4-cli-'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ devDependencies: {
      '@suites/doubles.vitest': '^3.0.0', '@suites/di.inversify': '^3.0.0',
    } }));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  function run(args: string[] = [], target = directory, slug = 'suites/3/to-suites-v4') {
    return spawnSync(process.execPath, [cli, slug, target, '--force', ...args], { encoding: 'utf8', timeout: 30000 });
  }
  function put(name: string, content: string) { writeFileSync(join(directory, name), content); }
  function read(name: string) { return readFileSync(join(directory, name), 'utf8'); }
  const input = "import { TestBed, mock as makeMock, type Mocked } from '@suites/unit';\nconst value = makeMock<Service>();\n";

  it('writes source and declarations, excludes dependencies, and is idempotent', () => {
    put('service.spec.ts', input);
    put('suites.d.ts', '/// <reference types="@suites/doubles.vitest/types" />\n');
    mkdirSync(join(directory, 'node_modules'));
    put('node_modules/ignored.ts', input);
    const first = run();
    expect(first.status).toBe(0);
    expect(read('service.spec.ts')).toContain('@suites/doubles.vitest');
    expect(read('service.spec.ts')).toContain('@suites/di.inversify/metadata');
    expect(read('suites.d.ts')).toContain('@suites/doubles.vitest/unit');
    expect(read('suites.d.ts')).toContain('@suites/di.inversify/metadata');
    expect(read('node_modules/ignored.ts')).toBe(input);
    const output = read('service.spec.ts');
    expect(run().status).toBe(0);
    expect(read('service.spec.ts')).toBe(output);
  });
  it.each(['--dry', '--print'])('does not write with %s', flag => {
    put('service.spec.ts', input);
    put('suites.d.ts', '/// <reference types="@suites/doubles.vitest/types" />\n');
    const result = run([flag]);
    expect(result.status).toBe(0);
    expect(read('service.spec.ts')).toBe(input);
    expect(read('suites.d.ts')).toContain('/types');
    if (flag === '--print') expect(result.stdout).toContain('@suites/di.inversify/metadata');
  });
  it('supports quoted globs', () => {
    put('service.spec.ts', input);
    put('other.ts', input);
    const result = run([], join(directory, '*.spec.ts'));
    expect(result.status).toBe(0);
    expect(read('service.spec.ts')).toContain('@suites/doubles.vitest');
    expect(read('other.ts')).toBe(input);
  });
  it('exits nonzero for unsafe input without writing the affected file', () => {
    put('service.spec.ts', "import * as Suites from '@suites/unit';\nSuites.mock();");
    const before = read('service.spec.ts');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('Namespace/default');
    expect(read('service.spec.ts')).toBe(before);
  });
  it('reports missing and ambiguous adapters, and accepts explicit selection', () => {
    put('package.json', JSON.stringify({ devDependencies: { '@suites/doubles.jest': '*', '@suites/doubles.vitest': '*' } }));
    put('service.spec.ts', input);
    expect(run().status).toBe(1);
    const result = run(['--doubles', 'jest', '--di', 'nestjs']);
    expect(result.status).toBe(0);
    expect(read('service.spec.ts')).toContain('@suites/doubles.jest/unit');
  });
  it('fails for invalid adapter and unmatched glob', () => {
    expect(run(['--doubles', 'sinon']).status).toBe(1);
    expect(run([], join(directory, 'missing/*.ts')).status).toBe(1);
  });
  it('keeps declaration exclusion for the Automock transform', () => {
    const declaration = "import { TestBed } from '@automock/jest';";
    put('legacy.d.ts', declaration);
    expect(run([], directory, 'automock/2/to-suites-v3').status).toBe(0);
    expect(read('legacy.d.ts')).toBe(declaration);
  });
});
