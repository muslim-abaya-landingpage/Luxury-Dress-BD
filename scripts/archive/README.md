# Archived one-off scripts

These scripts were used once (fixing encodings, bumping hand-written `?v=` cache strings, building the
thana list, patching `index.html`) and are no longer run by the build, tests or any other file.
They are kept here for reference only.

- `bump-*-cache.mjs` are obsolete: the Cloudflare build now gives every JS/CSS file a content version
  automatically (`scripts/build-catalog-asset-versions.mjs`).
- Some import files from `scripts/` by relative path and may need path changes before running again.
