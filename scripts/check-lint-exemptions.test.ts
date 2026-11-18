import { describe, expect, it } from "vitest";
import { addedExemptions, exemptions } from "./check-lint-exemptions";

const config = (overrides: unknown[], rules: object = {}) =>
  JSON.stringify({ rules, overrides });

const sizeExemption = (files: string[]) => ({
  files,
  rules: { "max-lines-per-function": "off" },
});

describe("exemptions", () => {
  it("reads every rule an override turns off, per file", () => {
    const source = config([
      sizeExemption(["a.tsx", "b.tsx"]),
      { files: ["c.ts"], rules: { "no-console": "error" } },
    ]);

    expect([...exemptions(source)]).toEqual([
      "a.tsx :: max-lines-per-function",
      "b.tsx :: max-lines-per-function",
    ]);
  });

  it("counts top-level rules turned off, written as 0 or in an array", () => {
    const source = config([], { "rule-a": 0, "rule-b": ["off"], c: "warn" });

    expect([...exemptions(source)]).toEqual(["* :: rule-a", "* :: rule-b"]);
  });

  it("reads the comments and trailing commas of .oxlintrc.json", () => {
    const source = `{
      // A comment.
      "overrides": [{ "files": ["a.tsx",], "rules": { "max-lines": "off" } },],
    }`;

    expect([...exemptions(source)]).toEqual(["a.tsx :: max-lines"]);
  });
});

describe("addedExemptions", () => {
  it("passes when an entry is removed", () => {
    const base = config([sizeExemption(["a.tsx", "b.tsx"])]);
    const current = config([sizeExemption(["a.tsx"])]);

    expect(addedExemptions(base, current)).toEqual([]);
  });

  it("reports a file added to an existing list", () => {
    const base = config([sizeExemption(["a.tsx"])]);
    const current = config([sizeExemption(["a.tsx", "new.tsx"])]);

    expect(addedExemptions(base, current)).toEqual([
      "new.tsx :: max-lines-per-function",
    ]);
  });

  it("reports a renamed file, because its entry does not carry over", () => {
    const base = config([sizeExemption(["route.tsx"])]);
    const current = config([sizeExemption(["component.tsx"])]);

    expect(addedExemptions(base, current)).toEqual([
      "component.tsx :: max-lines-per-function",
    ]);
  });
});
