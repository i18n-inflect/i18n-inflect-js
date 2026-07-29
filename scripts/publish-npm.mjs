/**
 * Publishes workspace packages whose current version is not on the registry.
 *
 * Deliberately uses `npm publish` rather than `pnpm publish`: npm's trusted
 * publishing (OIDC) is only implemented for the npm CLI, so publishing through
 * pnpm would fall back to token authentication and defeat the point.
 *
 * Versioning stays a local step (`pnpm changeset version`, committed) — that
 * keeps CI from needing permission to open pull requests, and makes the
 * version bump reviewable in the same commit as the change it describes.
 *
 * Usage: node scripts/publish-npm.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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

const results = [];
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
  if (!DRY_RUN) {
    execFileSync("npm", ["publish", "--provenance", "--access", "public"], {
      cwd: join(PACKAGES_DIR, dir),
      stdio: "inherit",
    });
    // changesets/action and humans both look for this line.
    console.log(`New tag: ${manifest.name}@${manifest.version}`);
  }
  results.push(`${manifest.name}@${manifest.version}`);
}

console.log(
  results.length === 0
    ? "\nnothing to publish — every package version is already on the registry"
    : `\npublished: ${results.join(", ")}`,
);
