# @i18n-inflect/neural

## 0.1.1

### Patch Changes

- aab164a: Expose `./package.json` in the `exports` map. Bundler plugins, framework
  integrations and tooling routinely read a dependency's `package.json`, and an
  `exports` map that omits it makes those reads fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- Updated dependencies [aab164a]
  - i18n-inflect@0.1.2
