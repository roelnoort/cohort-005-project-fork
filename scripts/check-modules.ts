// Fails when a module in app/modules/ is missing its lib/ folder or its tests.
// Every module copies app/modules/example/: entry points at the root, the
// implementation in lib/, and tests in tests/ that go through the entry points.
// Usage: tsx scripts/check-modules.ts

import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MODULES_ROOT = "app/modules";
const TEST_FILE = /\.test\.tsx?$/;

const entries = (dir: string): Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** The problems with one module, as sentences. Empty when the module is fine. */
export function moduleProblems(moduleDir: string): string[] {
  const names = new Set(
    entries(moduleDir)
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  );
  const hasTests = entries(join(moduleDir, "tests")).some(
    (entry) => entry.isFile() && TEST_FILE.test(entry.name)
  );
  return [
    ...(names.has("lib") ? [] : ["has no lib/ folder"]),
    ...(hasTests ? [] : ["has no test file in tests/"]),
  ];
}

export function findModuleProblems(
  root: string
): { module: string; problems: string[] }[] {
  return entries(root)
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .map((module) => ({ module, problems: moduleProblems(module) }))
    .filter(({ problems }) => problems.length > 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const broken = findModuleProblems(MODULES_ROOT);
  if (broken.length > 0) {
    console.error("These modules do not have the module layout:\n");
    for (const { module, problems } of broken) {
      console.error(`  ${module}: ${problems.join(", ")}`);
    }
    console.error(`
Every module has the layout of ${MODULES_ROOT}/example/:
- entry points (index.ts, index.server.ts, …) at the module root, kept small;
- the implementation in lib/;
- tests in tests/ that call the entry points, at least one *.test.ts.
A module that came from moving code out of a route needs tests too: the move
is the moment its behaviour gets a test. See ${MODULES_ROOT}/README.md.`);
    process.exit(1);
  }
}
