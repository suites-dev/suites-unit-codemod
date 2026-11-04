import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';
import type { API, FileInfo, Options } from 'jscodeshift';

type Doubles = 'jest' | 'vitest';
type Di = 'nestjs' | 'inversify';
interface V4Options extends Options {
  doubles?: Doubles;
  di?: Di;
}

const UNIT = '@suites/unit';
const helpers = new Set(['mock', 'stub']);
const nameOf = (node: any): string => node?.name ?? node?.value ?? '';
const referencePaths: Record<string, string> = {
  '@suites/doubles.jest/types': '@suites/doubles.jest/unit',
  '@suites/doubles.vitest/types': '@suites/doubles.vitest/unit',
  '@suites/di.nestjs/types': '@suites/di.nestjs/metadata',
  '@suites/di.inversify/types': '@suites/di.inversify/metadata',
};

function dependencies(filePath: string): Set<string> {
  let directory = dirname(resolve(filePath));
  while (true) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      return new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }));
    }
    const parent = dirname(directory);
    if (parent === directory) return new Set();
    directory = parent;
  }
}

function select<T extends string>(
  kind: 'doubles' | 'di', values: readonly T[], explicit: T | undefined,
  packages: Set<string>, references: string[]
): T {
  if (explicit && !values.includes(explicit)) throw new Error(`Unsupported --${kind} ${explicit}. Choose ${values.join(' or ')}.`);
  const referenced = values.filter(value => references.some(ref => ref.startsWith(`@suites/${kind}.${value}/`)));
  if (referenced.length > 1 || (explicit && referenced.some(value => value !== explicit))) {
    throw new Error(`Conflicting ${kind} type references. Keep one adapter per TypeScript project before migrating.`);
  }
  const installed = values.filter(value => packages.has(`@suites/${kind}.${value}`));
  if (installed.length > 1 && !explicit) throw new Error(`Multiple ${kind} adapters are installed. Select one explicitly with --${kind}.`);
  const choice = explicit || installed[0] || referenced[0];
  if (choice && referenced.some(value => value !== choice)) throw new Error(`Conflicting ${kind} adapter imports or references. Keep one adapter per TypeScript project before migrating.`);
  if (!choice) throw new Error(`Cannot determine ${kind} adapter. Run this migration for one test project with --${kind} ${values.join(` or --${kind} `)}.`);
  return choice;
}

/** Migrate source/declaration entry points, leaving dependency upgrades to the user. */
export default function transform(file: FileInfo, api: API, options: V4Options): string {
  const j = api.jscodeshift;
  const root = j(file.source);
  const directives = ts.preProcessFile(file.source).typeReferenceDirectives;
  const references = directives.map(ref => ref.fileName);
  const imports = root.find(j.ImportDeclaration).filter(p => p.node.source.value === UNIT);
  const sinonImports = root.find(j.ImportDeclaration).filter(p => String(p.node.source.value).startsWith('@suites/doubles.sinon'));
  const oldReferences = references.filter(ref => ref in referencePaths);
  const suitesReferences = references.filter(ref => /^@suites\/(doubles\.|di\.)/.test(ref));
  const typePaths = new Set([...Object.keys(referencePaths), ...Object.values(referencePaths)]);
  const oldImports = root.find(j.ImportDeclaration).filter(p => typePaths.has(String(p.node.source.value)));
  const exports = root.find(j.ExportNamedDeclaration).filter(p => p.node.source?.value === UNIT);
  const exportAll = root.find(j.ExportAllDeclaration).filter(p => p.node.source.value === UNIT);
  const importEquals = root.find(j.TSImportEqualsDeclaration).filter(p => p.node.moduleReference.type === 'TSExternalModuleReference' && p.node.moduleReference.expression.value === UNIT);
  const importTypes = root.find(j.TSImportType).filter(p => p.node.argument.type === 'StringLiteral' && p.node.argument.value === UNIT);
  const unsupportedLoads = root.find(j.CallExpression).filter(p => {
    const first = p.node.arguments[0];
    return (p.node.callee.type === 'Import' || (p.node.callee.type === 'Identifier' && p.node.callee.name === 'require')) &&
      first && 'value' in first && first.value === UNIT;
  });
  if (!sinonImports.size() && !imports.size() && !oldImports.size() && !exports.size() && !exportAll.size() && !importEquals.size() && !importTypes.size() && !unsupportedLoads.size() && !suitesReferences.length) return file.source;
  if (importEquals.size()) throw new Error('TypeScript import-equals from @suites/unit needs manual migration. Use named ESM imports and explicit adapter references.');
  if (exportAll.size()) throw new Error('Star/namespace re-exports from @suites/unit need manual migration. Use explicit named exports and move mock/stub to your doubles adapter.');
  if (importTypes.size()) throw new Error('Inline import types from @suites/unit need manual migration. Use named type imports and explicit adapter type references.');
  if (unsupportedLoads.size()) throw new Error('CommonJS/dynamic @suites/unit imports need manual migration. Use named ESM imports, and import mock/stub from your doubles adapter.');
  imports.forEach(p => {
    if (p.node.specifiers?.some(spec => spec.type !== 'ImportSpecifier')) {
      throw new Error('Namespace/default @suites/unit imports need manual migration. Use named imports and move mock/stub to your doubles adapter.');
    }
  });
  exports.forEach(p => {
    if (p.node.specifiers?.some(spec => spec.type !== 'ExportSpecifier')) throw new Error('Star/namespace re-exports from @suites/unit need manual migration. Use explicit named exports.');
    if (p.node.specifiers?.some(spec => spec.type === 'ExportSpecifier' && spec.local && helpers.has(nameOf(spec.local)))) {
      throw new Error('Re-exported mock/stub from @suites/unit need manual migration. Re-export them from your doubles adapter.');
    }
  });

  const packages = dependencies(file.path);
  if (references.some(ref => ref.includes('@suites/doubles.sinon')) ||
      sinonImports.size() ||
      (packages.has('@suites/doubles.sinon') && !options.doubles)) {
    throw new Error('Sinon is not supported by Suites 4. Migrate Sinon calls/assertions to Jest or Vitest, remove @suites/doubles.sinon, then rerun with --doubles jest or --doubles vitest.');
  }
  const importReferences: string[] = [];
  oldImports.forEach(p => {
    if (p.node.specifiers?.length) throw new Error('Named imports from adapter declaration entry points need manual migration to triple-slash type references.');
    importReferences.push(String(p.node.source.value));
  });
  const adapterImports = root.find(j.ImportDeclaration).nodes()
    .map(node => String(node.source.value))
    .filter(value => /^@suites\/(doubles\.(jest|vitest)|di\.(nestjs|inversify))$/.test(value))
    .map(value => `${value}/`);
  const allReferences = [...references, ...importReferences, ...adapterImports];
  const doubles = select('doubles', ['jest', 'vitest'], options.doubles, packages, allReferences);
  let needsDi = Boolean(options.di && file.path.endsWith('.d.ts')) || exports.nodes().some(node => node.specifiers?.some(spec => spec.type === 'ExportSpecifier' && spec.local && !['Mocked', 'Stub'].includes(nameOf(spec.local)))) || allReferences.some(ref => ref.startsWith('@suites/di.'));
  imports.forEach(p => {
    if (p.node.specifiers?.some(spec => spec.type === 'ImportSpecifier' && !['mock', 'stub', 'Mocked', 'Stub'].includes(nameOf(spec.imported)))) needsDi = true;
  });
  // Declaration-only setup also needs DI metadata when the project installs a DI adapter.
  if (file.path.endsWith('.d.ts') && ['nestjs', 'inversify'].some(di => packages.has(`@suites/di.${di}`))) needsDi = true;
  const di = needsDi ? select('di', ['nestjs', 'inversify'], options.di, packages, allReferences) : undefined;
  const requiredReferences = [`@suites/doubles.${doubles}/unit`, ...(di ? [`@suites/di.${di}/metadata`] : [])];

  let changed = false;
  imports.forEach(p => {
    const moved = p.node.specifiers?.filter(spec => spec.type === 'ImportSpecifier' && helpers.has(nameOf(spec.imported))) || [];
    if (!moved.length) return;
    const remaining = p.node.specifiers?.filter(spec => !moved.includes(spec)) || [];
    const adapterImport = j.importDeclaration(moved, j.stringLiteral(`@suites/doubles.${doubles}`));
    adapterImport.importKind = p.node.importKind;
    if (remaining.length) {
      p.node.specifiers = remaining;
      j(p).insertAfter(adapterImport);
    } else {
      adapterImport.comments = p.node.comments;
      j(p).replaceWith(adapterImport);
    }
    changed = true;
  });
  oldImports.forEach(p => {
    if (p.node.comments?.length) {
      const placeholder = j.emptyStatement();
      placeholder.comments = p.node.comments;
      j(p).replaceWith(placeholder);
    } else j(p).remove();
    changed = true;
  });
  const eol = file.source.includes('\r\n') ? '\r\n' : '\n';
  let output = changed ? root.toSource({ lineTerminator: eol }) : file.source;
  if (file.source.startsWith('\uFEFF') && !output.startsWith('\uFEFF')) output = '\uFEFF' + output;
  // TypeScript identifies actual directive spans, avoiding lookalikes in strings/comments.
  const updatedDirectives = ts.preProcessFile(output).typeReferenceDirectives;
  for (const ref of [...updatedDirectives].reverse()) {
    const replacement = referencePaths[ref.fileName];
    if (replacement) output = output.slice(0, ref.pos) + replacement + output.slice(ref.end);
  }
  const existingReferences = ts.preProcessFile(output).typeReferenceDirectives.map(ref => ref.fileName);
  const missing = requiredReferences.filter(ref => !existingReferences.includes(ref));
  if (missing.length) {
    const bom = output.startsWith('\uFEFF') ? '\uFEFF' : '';
    output = output.slice(bom.length);
    const prefix = missing.map(ref => `/// <reference types="${ref}" />`).join(eol) + eol;
    const shebang = output.match(/^#![^\r\n]*(?:\r?\n|$)/)?.[0] || '';
    output = bom + shebang + prefix + output.slice(shebang.length);
  }
  // Keep byte-for-byte output for already migrated files.
  return !changed && !oldReferences.length && !missing.length ? file.source : output;
}
