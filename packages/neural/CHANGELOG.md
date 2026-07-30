# @i18n-inflect/neural

## 0.1.4

### Patch Changes

- Updated dependencies
  - i18n-inflect@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies
  - i18n-inflect@0.2.0

## 0.1.2

### Patch Changes

- Fix an unresolvable dependency in 0.1.1. The release pipeline published the
  package with `npm publish`, which does not understand pnpm's `workspace:`
  protocol, so the dependency on `i18n-inflect` reached the registry as
  `workspace:^` and the package could not be installed at all. Releases now
  build the tarball with `pnpm pack` — which rewrites workspace ranges — and
  upload that with npm, and the publish script refuses to upload any tarball
  that still carries a workspace-only dependency range.

## 0.1.1

### Patch Changes

- aab164a: Expose `./package.json` in the `exports` map. Bundler plugins, framework
  integrations and tooling routinely read a dependency's `package.json`, and an
  `exports` map that omits it makes those reads fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- Updated dependencies [aab164a]
  - i18n-inflect@0.1.2
