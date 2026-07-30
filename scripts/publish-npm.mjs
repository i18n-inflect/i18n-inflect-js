/**
 * Publishes workspace packages whose current version is not on the registry.
 *
 * Packing and uploading are split between the two package managers on purpose
 * — see `packWithPnpm` for why neither can do both.
 *
 * Versioning stays a local step (`pnpm changeset version`, committed) — that
 * keeps CI from needing permission to open pull requests, and makes the
 * version bump reviewable in the same commit as the change it describes.
 *
 * Usage: node scripts/publish-npm.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const PACKAGES_DIR = new URL("../packages/", import.meta.url).pathname;

/** Versions already on the registry, or [] when the package is unpublished. */
async function publishedVersions(name) {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`registry lookup for ${name} failed: ${response.status}`);
  const body = await response.json();
  return Object.keys(body.versions ?? {});
}

/**
 * Build the tarball with pnpm, then hand it to npm to upload.
 *
 * Neither tool can do both jobs: `npm publish` does not understand pnpm's
 * `workspace:` dependency protocol and would publish it verbatim, producing
 * an uninstallable package; `pnpm publish` understands it but cannot
 * authenticate through OIDC trusted publishing. So pnpm packs (rewriting
 * workspace ranges to real ones) and npm publishes the result.
 */
function packWithPnpm(cwd, name) {
  const output = execFileSync("pnpm", ["pack", "--pack-destination", TARBALL_DIR], {
    cwd,
    encoding: "utf8",
  });
  const tarball = output.trim().split("\n").pop();
  if (!tarball?.endsWith(".tgz")) throw new Error(`pnpm pack printed no tarball path: ${output}`);

  // Guard the exact failure above: no dependency may reach the registry with
  // a protocol only a workspace can resolve.
  const packed = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
  );
  for (const [dep, range] of Object.entries({
    ...packed.dependencies,
    ...packed.peerDependencies,
  })) {
    if (String(range).startsWith("workspace:") || String(range).startsWith("link:")) {
      throw new Error(`${name} would publish an unresolvable dependency: ${dep}@${range}`);
    }
  }
  return tarball;
}

const TARBALL_DIR = mkdtempSync(join(tmpdir(), "i18n-inflect-publish-"));
const results = [];
const failures = [];
for (const dir of readdirSync(PACKAGES_DIR)) {
  const manifestPath = join(PACKAGES_DIR, dir, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue; // not a package directory
  }
  if (manifest.private) {
    console.log(`skip ${manifest.name} — private`);
    continue;
  }
  const versions = await publishedVersions(manifest.name);
  if (versions.includes(manifest.version)) {
    console.log(`skip ${manifest.name}@${manifest.version} — already published`);
    continue;
  }
  console.log(`publish ${manifest.name}@${manifest.version}${DRY_RUN ? " (dry run)" : ""}`);
  const cwd = join(PACKAGES_DIR, dir);
  let tarball;
  try {
    tarball = packWithPnpm(cwd, manifest.name);
  } catch (error) {
    console.error(`  packing failed: ${error instanceof Error ? error.message : error}`);
    failures.push(`${manifest.name}@${manifest.version}`);
    continue;
  }
  if (DRY_RUN) {
    results.push(`${manifest.name}@${manifest.version}`);
    continue;
  }
  // Attempt every package before failing: a missing trusted publisher on one
  // of them must not hide whether the others went out.
  try {
    execFileSync("npm", ["publish", tarball, "--provenance", "--access", "public"], {
      stdio: "inherit",
    });
    console.log(`New tag: ${manifest.name}@${manifest.version}`);
    results.push(`${manifest.name}@${manifest.version}`);
  } catch {
    failures.push(`${manifest.name}@${manifest.version}`);
  }
}

if (results.length > 0) console.log(`\npublished: ${results.join(", ")}`);
if (failures.length > 0) {
  console.error(`\nFAILED to publish: ${failures.join(", ")}`);
  console.error(
    "A 404 here usually means the package has no trusted publisher configured " +
      "for this repository and workflow — see npmjs.com → package → Settings.",
  );
  process.exit(1);
}
if (results.length === 0) {
  console.log("\nnothing to publish — every package version is already on the registry");
}
