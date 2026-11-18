// Fails when .oxlintrc.json turns a rule off for a file or glob it did not
// turn off before. The exemption lists only shrink: a file comes off once it
// is split, and a new file never goes on.
//
// Usage:
//   tsx scripts/check-lint-exemptions.ts --staged   the index against HEAD (pre-commit)
//   tsx scripts/check-lint-exemptions.ts            the working tree against
//                                                     its merge-base with origin/main

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";

const CONFIG = ".oxlintrc.json";
const BASE_BRANCH = "origin/main";

type Rules = Record<string, unknown>;
type Config = {
  rules?: Rules;
  overrides?: { files: string[]; rules?: Rules }[];
};

const isOff = (setting: unknown): boolean => {
  const level = Array.isArray(setting) ? setting[0] : setting;
  return level === "off" || level === 0;
};

/**
 * Every (files, rule) pair the config turns off, as "files :: rule" strings.
 * Top-level rules count with "*" as their files.
 */
export function exemptions(source: string): Set<string> {
  const config: Config = JSON5.parse(source);
  const scopes = [
    { files: ["*"], rules: config.rules ?? {} },
    ...(config.overrides ?? []),
  ];
  return new Set(
    scopes.flatMap(({ files, rules }) =>
      Object.entries(rules ?? {})
        .filter(([, setting]) => isOff(setting))
        .flatMap(([rule]) => files.map((file) => `${file} :: ${rule}`))
    )
  );
}

/** The exemptions in `current` that `base` did not have. */
export function addedExemptions(base: string, current: string): string[] {
  const before = exemptions(base);
  return [...exemptions(current)].filter((pair) => !before.has(pair));
}

const git = (args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: "pipe" });

const showAt = (ref: string): string => git(["show", `${ref}:${CONFIG}`]);

function sources() {
  if (process.argv.includes("--staged")) {
    return { base: showAt("HEAD"), current: showAt(""), against: "HEAD" };
  }
  const mergeBase = git(["merge-base", "HEAD", BASE_BRANCH]).trim();
  return {
    base: showAt(mergeBase),
    current: readFileSync(CONFIG, "utf8"),
    against: `${BASE_BRANCH} (${mergeBase.slice(0, 7)})`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { base, current, against } = sources();
  const added = addedExemptions(base, current);
  if (added.length > 0) {
    console.error(
      `${CONFIG} turns off rules it did not turn off at ${against}:\n`
    );
    for (const pair of added) console.error(`  ${pair}`);
    console.error(`
The exemption lists only shrink. Make the code pass the rule instead: split a
long function into smaller ones, split a long file at its seams. Moving or
renaming a file that is on a list does not carry its entry over: the new file
has to pass. Removing an entry is always fine.`);
    process.exit(1);
  }
}
