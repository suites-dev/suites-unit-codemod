import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, findPackageJSON } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, mock } from 'node:test';

const require = createRequire(import.meta.url);
const releaseEntry = require.resolve('semantic-release');
const releaseRequire = createRequire(releaseEntry);
const npmEntry = releaseRequire.resolve('@semantic-release/npm');
const npmRequire = createRequire(npmEntry);
const githubEntry = releaseRequire.resolve('@semantic-release/github');
const semver = releaseRequire('semver');
const config = JSON.parse(readFileSync(new URL('../../.releaserc.json', import.meta.url), 'utf8'));
const githubConfig = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@semantic-release/github')[1];
const logger = { log() {}, warn() {}, error() {} };
const moduleAt = (entry, relative) => import(pathToFileURL(join(dirname(entry), relative)).href);

test('release dependencies and the selected npm executable support trusted publishing', async () => {
  const pkg = entry => JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8'));
  assert.ok(semver.gte(pkg(releaseEntry).version, '25.0.1'));
  assert.ok(semver.gte(pkg(npmEntry).version, '13.1.1'));
  const npm = npmRequire('npm/package.json');
  assert.ok(semver.gte(npm.version, '11.21.0'));
  const { execa } = await import(pathToFileURL(npmRequire.resolve('execa')).href);
  const selectedNpm = await execa('npm', ['--version'], { cwd: process.cwd(), preferLocal: true });
  assert.ok(semver.gte(selectedNpm.stdout.trim(), '11.21.0'), `npm on PATH is ${selectedNpm.stdout}, expected >=11.21.0`);
});

test('npm authentication accepts a mocked GitHub OIDC exchange without an npm token', async () => {
  const corePackage = findPackageJSON('@actions/core', pathToFileURL(npmEntry));
  const { OidcClient } = await import(pathToFileURL(join(dirname(corePackage), 'lib/oidc-utils.js')).href);
  const oidc = mock.method(OidcClient, 'getIDToken', async audience => {
    assert.equal(audience, 'npm:registry.npmjs.org');
    return 'test-oidc-token';
  });
  const exchange = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/%40suites%2Fcodemod');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-oidc-token');
    return { ok: true, json: async () => ({ token: 'test-registry-token' }) };
  });
  const saved = { ...process.env };
  try {
    delete process.env.NPM_TOKEN;
    delete process.env.NODE_AUTH_TOKEN;
    process.env.CI = 'true';
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REPOSITORY = 'suites-dev/suites-unit-codemod';
    const { default: verifyAuth } = await moduleAt(npmEntry, 'lib/verify-auth.js');
    await verifyAuth('/unused-test-npmrc', { name: '@suites/codemod' }, {}, {
      cwd: process.cwd(), env: process.env, logger,
    });
    assert.equal(oidc.mock.callCount(), 1);
    assert.equal(exchange.mock.callCount(), 1);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    oidc.mock.restore();
    exchange.mock.restore();
  }
});

test('configured GitHub success and failure hooks do not require issue access', async () => {
  const requests = [];
  class Octokit {
    async request(route) {
      requests.push(route);
      assert.equal(route, 'GET /repos/{owner}/{repo}');
      return { data: { full_name: 'suites-dev/suites-unit-codemod' } };
    }
    async graphql() { assert.fail('Issue/PR queries must remain disabled'); }
  }
  const context = {
    options: { repositoryUrl: 'https://github.com/suites-dev/suites-unit-codemod.git' },
    env: { GITHUB_TOKEN: 'test-app-token' },
    commits: [{ hash: 'example', message: 'fix: example' }],
    branch: { name: 'master' },
    nextRelease: { version: '0.2.0' },
    releases: [], errors: [new Error('example')], logger,
  };
  const { default: success } = await moduleAt(githubEntry, 'lib/success.js');
  const { default: fail } = await moduleAt(githubEntry, 'lib/fail.js');
  await success(githubConfig, context, { Octokit });
  await fail(githubConfig, context, { Octokit });
  assert.deepEqual(requests, ['GET /repos/{owner}/{repo}']);
});
