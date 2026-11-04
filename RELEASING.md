# Releasing @suites/codemod

The manual **Release** workflow uses `suites-release-bot` for GitHub commits, tags, and releases. npm authenticates separately through Trusted Publishing with GitHub Actions OIDC. Neither workflow needs an npm token.

## Configure the release bot

Install the organization-owned `suites-release-bot` GitHub App on `suites-dev/suites-unit-codemod` with its existing permissions:

- Contents: read/write
- Pull requests: read/write
- Metadata: read

Make these organization settings accessible to this repository:

| Setting | Value |
| --- | --- |
| Variable `SUITES_RELEASE_APP_CLIENT_ID` | The app's client ID |
| Secret `SUITES_RELEASE_APP_PRIVATE_KEY` | The app's PEM private key |

An organization secret restricted to selected repositories must explicitly include `suites-unit-codemod`. App installation access and secret access are separate prerequisites. Do not grant Issues permission: semantic-release issue/PR comments, released labels, and failure issues are disabled. GitHub Releases remain enabled.

The workflow mints an installation token scoped to this repository, uses it for GitHub API and Git push authentication, and obtains the app's bot login and noreply email for release commits. The checkout does not persist the default `GITHUB_TOKEN`. Existing branch protections still apply; the workflow does not grant the bot a bypass.

## Configure npm Trusted Publishing

On npm, open the settings for **`@suites/codemod`** and add GitHub Actions trusted publishers for the workflows you intend to use:

| npm field | Semantic release | Direct package publish |
| --- | --- | --- |
| Organization or user | `suites-dev` | `suites-dev` |
| Repository | `suites-unit-codemod` | `suites-unit-codemod` |
| Workflow filename | `release.yml` | `publish.yml` |
| Environment name | Leave blank | Leave blank |

Enable direct publication (`npm publish`) for each trusted publisher you configure; a stage-only publisher cannot run these workflows.

These workflows do not use a GitHub environment. Enter only the filename, not `.github/workflows/`. Configure `release.yml` for the normal release path; configure the second entry only if you use the existing direct publisher.

Enable trusted-publisher dist-tag management for `release.yml` if semantic-release will promote existing versions between its `next` and `latest` channels. npm requires at least 11.21.0 (or 12.2.0) for that additional permission. The workflows explicitly install npm 11.21.1 on PATH, and the authentication check verifies the executable selected by the release plugin. Its transitive npm dependency alone does not provide a root npm executable under pnpm. Publishing a new version uses its normal publication tag without that optional grant.

The package repository metadata must continue to point to `https://github.com/suites-dev/suites-unit-codemod.git`. Follow [npm's Trusted Publishing setup](https://docs.npmjs.com/trusted-publishers/) for the registry-side configuration. The GitHub App token is not an npm credential, and adding the app does not configure npm trust.

## Run a release

1. Merge the reviewed changes into `master`, or `next` for a prerelease.
2. Open **Actions → Release → Run workflow** and select that branch.
3. Inspect the build and semantic-release output, then verify the npm version and GitHub Release.

Semantic-release continues to calculate versions from conventional commits, update `package.json` and `CHANGELOG.md`, publish the package, create its configured package tag and GitHub Release, and push the existing `v<version>` alias tag. `master` publishes stable releases; `next` uses the prerelease channel. Running this workflow can publish immediately; there is no additional environment approval gate.

The **Publish Package** workflow remains a separate manual path for publishing the version already committed on the selected branch with the selected npm tag. It does not calculate a new version or create GitHub commits, tags, or releases, so it does not need the release bot token. Its trusted publisher is the `publish.yml` entry above.

## Release toolchain

CI and publishing use Node 24 LTS. This is a development/release requirement; the package's consumer engine range is unchanged. The semantic-release dependency floor is 25.0.1 because it requires an npm plugin with OIDC support. The previous locked plugin, `@semantic-release/npm@12.0.2`, required token authentication and bundled npm 10, so removing token variables alone was insufficient.

Before running the validation commands locally, use Node 24.10.0 or newer within Node 24 LTS and ensure the npm executable on PATH is at least 11.21.0. The workflows use npm 11.21.1 explicitly. `pnpm test:release-auth` fails on older npm executables even if the plugin has a newer transitive npm dependency.

Install with the committed lockfile:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test:release-auth
pnpm lint
pnpm test -- --runInBand
pnpm exec jest --testPathPattern=e2e --runInBand
```

The release workflow invokes the locked local semantic-release executable. Do not run semantic-release locally just to validate configuration: its plugins can create external releases, comments, tags, or package publications.

## Troubleshooting

- **App token creation fails:** check the app installation includes this repository and that both organization settings are available to it.
- **Git push fails:** check the app's Contents permission and the existing branch rules. No branch protection changes are performed by this workflow.
- **npm rejects publication:** verify the package's trusted-publisher organization, repository, filename, and blank environment. Check the job has `id-token: write` and is running on a GitHub-hosted runner.
- **A channel promotion fails:** check the npm trusted publisher's dist-tag permission and the npm CLI version.
- **Repository URL mismatch:** check the package repository URL matches `suites-dev/suites-unit-codemod` exactly.
- **A version already exists:** inspect npm before rerunning. The direct publisher does not bump versions, and npm versions cannot be overwritten.

Do not restore `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or token-based `.npmrc` entries to work around a trust mismatch. Correct the relevant trusted publisher instead.
