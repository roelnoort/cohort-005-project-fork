import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeDraft, type NoteDraftStatus } from "./lib/draft";

export type { NoteDraftStatus };

/**
 * What the note editor should show for the text in the box: the character
 * count against the limit, whether it differs from the saved Note, and
 * whether Save is worth pressing. The action still validates on its own —
 * this only keeps the button honest.
 */
export function noteDraftStatus(
  draft: string,
  savedBody: string | null
): NoteDraftStatus {
  return describeDraft(draft, savedBody, MAX_NOTE_LENGTH);
}
