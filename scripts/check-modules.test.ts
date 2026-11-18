import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findModuleProblems } from "./check-modules";

function modulesRoot(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "modules-"));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "");
  }
  return root;
}

describe("findModuleProblems", () => {
  it("passes a module with the layout of example/", () => {
    const root = modulesRoot([
      "notes/index.ts",
      "notes/lib/draft.ts",
      "notes/tests/notes.test.ts",
    ]);

    expect(findModuleProblems(root)).toEqual([]);
  });

  it("reports a module of loose files at its root", () => {
    const root = modulesRoot(["viewer/quiz.server.ts"]);

    expect(findModuleProblems(root)).toEqual([
      {
        module: join(root, "viewer"),
        problems: ["has no lib/ folder", "has no test file in tests/"],
      },
    ]);
  });

  it("reports a tests/ folder that holds only fixtures", () => {
    const root = modulesRoot([
      "notes/index.ts",
      "notes/lib/draft.ts",
      "notes/tests/fixtures.ts",
    ]);

    expect(findModuleProblems(root)).toEqual([
      { module: join(root, "notes"), problems: ["has no test file in tests/"] },
    ]);
  });

  it("ignores files at the root of app/modules", () => {
    const root = modulesRoot(["README.md"]);

    expect(findModuleProblems(root)).toEqual([]);
  });
});
