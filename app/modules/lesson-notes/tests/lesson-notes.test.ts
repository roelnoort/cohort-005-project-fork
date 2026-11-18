import { describe, it, expect } from "vitest";
import { noteDraftStatus } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteDraftStatus", () => {
  it("cannot save an empty box when there is no Note yet", () => {
    expect(noteDraftStatus("", null)).toEqual({
      length: 0,
      limit: MAX_NOTE_LENGTH,
      tooLong: false,
      empty: true,
      unsaved: false,
      canSave: false,
    });
  });

  it("can save new text that differs from the saved Note", () => {
    const status = noteDraftStatus("Cursor beats offset", null);
    expect(status.length).toBe(19);
    expect(status.unsaved).toBe(true);
    expect(status.empty).toBe(false);
    expect(status.canSave).toBe(true);
  });

  it("cannot save text identical to the saved Note", () => {
    const status = noteDraftStatus("same", "same");
    expect(status.unsaved).toBe(false);
    expect(status.canSave).toBe(false);
  });

  it("treats whitespace-only text as empty", () => {
    const status = noteDraftStatus("   \n ", "old");
    expect(status.empty).toBe(true);
    expect(status.unsaved).toBe(true);
    expect(status.canSave).toBe(false);
  });

  it("allows exactly the limit", () => {
    const status = noteDraftStatus("a".repeat(MAX_NOTE_LENGTH), null);
    expect(status.tooLong).toBe(false);
    expect(status.canSave).toBe(true);
  });

  it("refuses one character over the limit", () => {
    const status = noteDraftStatus("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(status.tooLong).toBe(true);
    expect(status.canSave).toBe(false);
  });

  it("treats surrounding whitespace as saved, because the server trims it", () => {
    const status = noteDraftStatus(
      "Cursor beats offset \n",
      "Cursor beats offset"
    );
    expect(status.unsaved).toBe(false);
    expect(status.canSave).toBe(false);
  });

  it("counts the length the server will store, without surrounding whitespace", () => {
    const status = noteDraftStatus(`  ${"a".repeat(MAX_NOTE_LENGTH)}\n`, null);
    expect(status.length).toBe(MAX_NOTE_LENGTH);
    expect(status.tooLong).toBe(false);
    expect(status.canSave).toBe(true);
  });
});
