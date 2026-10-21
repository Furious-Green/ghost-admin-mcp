# Pinned builds, artifacts and rollback

This public fork's manifest is `ghost-admin-mcp`, with `private: true` to prevent
accidental npm publication. That flag does **not** make the repository private.
The executable remains `ghost-mcp`, and existing MCP settings/tool names remain.
Version `0.2.0` is inherited metadata, **not a newly published fork release**.
Use an approved full commit SHA and checksums for identity. No npm package, tag,
release, deployment or consumer switch is automatically created by these steps.

MIT and the original Fanyang Meng copyright/author are retained. This fork is
maintained at [Furious-Green/ghost-admin-mcp](https://github.com/Furious-Green/ghost-admin-mcp),
derived from [MFYDev/ghost-mcp](https://github.com/MFYDev/ghost-mcp). The fork does
not claim upstream's npm scope, authorship of upstream code, or npm name ownership.

## Build from a reviewed commit

Use Node 22, npm, git and tar on Linux (the verified baseline). Set `COMMIT` to
the approved **40-character SHA**, not `main`, a branch name or an unreviewed
latest revision. Use a new install directory, retaining the previous install.

```sh
git clone https://github.com/Furious-Green/ghost-admin-mcp.git ghost-admin-mcp-pinned
cd ghost-admin-mcp-pinned
git checkout --detach "$COMMIT"
git rev-parse HEAD
npm ci
npm run typecheck
npm test
npm audit --json
npm audit --omit=dev --json
npm run verify:artifacts
```

Compare `git rev-parse HEAD` to the independently approved SHA before building.
`npm ci` compiles through prepare using the committed lock. Do not substitute
`npm install` or regenerate the lock during adoption. Registry access is required
for dependencies/audits; MCP verification uses dummy credentials and blocks
external HTTP. No real Ghost key is needed for this gate.

`verify:artifacts` requires a clean **tracked** tree and creates a new
`dist/<full-sha>/`; it refuses an existing output rather than overwriting it.
Untracked/ignored files are excluded by `git archive`. To rerun the same revision,
use a fresh checkout rather than deleting an output you may want to retain.
It creates:

- `ghost-admin-mcp-<full-sha>-source.tar.gz`: committed source, lock, tests and docs;
- `ghost-admin-mcp-<full-sha>-runtime.tar.gz`: compiled `build/`, manifest, lock,
  README and MIT license only, **no node_modules or secrets**;
- `verification.json`: commit, actual Node/npm/platform, source/runtime discovery
  counts, zero Ghost requests and runtime archive membership;
- `SHA256SUMS`: checksums of both archives and verification evidence.

Both archives are extracted separately and installed from their locks. The
source must compile/start; the runtime must start with production dependencies
only, without TypeScript. Both discover all 54 tools, seven resource entries/
templates and one prompt without Ghost requests. CI runs this same gate but does
not publish or upload artifacts. Reproducibility here means a committed dependency
graph and verified clean builds, **not byte-identical tarballs across toolchains**.
The script needs a git checkout; source archives themselves contain no `.git`.

## Install a retained artifact

Obtain an archive and SHA256SUMS through a trusted channel, tied to the approved
commit. A checksum fetched from the same untrusted location is integrity
evidence, **not independent authenticity or a signature**. In the artifact output
directory, verify all files before extracting:

```sh
sha256sum --check SHA256SUMS
```

Create a fresh empty install directory. Extract **one** selected archive into it
(replace the archive path and full SHA explicitly):

```sh
tar -xzf /trusted/path/ghost-admin-mcp-FULL_SHA-runtime.tar.gz -C /absolute/new-install
cd /absolute/new-install
npm ci --omit=dev --ignore-scripts
```

The runtime **requires `--ignore-scripts`**: the retained prepare script compiles
source with development TypeScript, which is deliberately absent from this
artifact. Do not use plain `npm ci`, `npm start` through an untrusted manifest,
or `npx` against upstream's package. Run the compiled entry directly with Node.
The executable bin mapping remains available for consumers who explicitly link
an installation; linking is neither required nor performed by the gate.

For a **source** archive instead, extract it to a fresh directory and run `npm ci`,
`npm run typecheck`, `npm test` to compile/verify before use. Both forms require
registry access on installation; neither is a bundled/offline dependency image.
Runtime archives omit test/source/docs directories; retain the corresponding
source archive or consult this commit's public documentation for evidence.

## Adoption and rollback checklist

1. Retain the previous pinned executable, lock, configuration and its known
   compatible response parser. Verify required operations and credential class
   against the [coverage matrix](coverage.md); offline tests are not live proof.
2. Adapt parsers to `{data, meta?}` inside MCP text, retain delete text handling,
   reject unknown fields/selectors, and remove unsupported newsletter/offer/tier
   delete and role-read names. Read the README's full migrations, not only this
   checklist. No compatibility switch or implicit archival exists.
3. Configure the MCP client to run `node` with the absolute new
   `build/server.js` path and its existing `GHOST_API_URL`,
   `GHOST_ADMIN_API_KEY`, `GHOST_API_VERSION` settings. Store real secrets in
   the consumer's secret mechanism, never an archive/commit. Restart/reconnect
   and refresh discovery. Separately authorize any live verification; do not
   “smoke-test” by sending email, editing billing or uploading/activating themes.
4. To roll back the executable, restore the retained old path/configuration and
   matching parser, restart/reconnect and refresh discovery. Keep installs
   separate; do not overwrite the new or old lock in place.
5. Executable rollback **does not restore remote Ghost data**, unsend mail,
   reverse Stripe changes, restore overwritten files or reactivate an old theme.
   Those require separately planned backups/remediation and explicit approval.
   Check remote state before manually repeating an uncertain/timed-out mutation.

Passing this gate establishes the documented release-preparation scope, not
authorization to publish/deploy, comprehensive security, universal credential
permissions or live compatibility with every Ghost version/hosting plan.
