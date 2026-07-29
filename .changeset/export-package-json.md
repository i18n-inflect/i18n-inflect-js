---
"i18n-inflect": patch
"@i18n-inflect/neural": patch
---

Expose `./package.json` in the `exports` map. Bundler plugins, framework
integrations and tooling routinely read a dependency's `package.json`, and an
`exports` map that omits it makes those reads fail with
`ERR_PACKAGE_PATH_NOT_EXPORTED`.
