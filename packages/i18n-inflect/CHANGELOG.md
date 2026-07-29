# i18n-inflect

## 0.1.1

### Patch Changes

- Fix language packs not registering when the package is loaded through
  CommonJS. Each `require()` entry bundled its own copy of the core, so
  `require("i18n-inflect/hu")` populated a different registry than
  `require("i18n-inflect")` read from, and every call returned its input
  unchanged — silently, with no error. The build now emits a shared chunk for
  both module formats, and a new post-build check exercises the published
  artifacts through `import` and `require` so this cannot regress. ESM users
  were unaffected.
