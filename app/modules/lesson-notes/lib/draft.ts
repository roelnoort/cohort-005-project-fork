export type NoteDraftStatus = {
  length: number;
  limit: number;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null,
  limit: number
): NoteDraftStatus {
  // The action trims before saving, so compare and count what it will store.
  const stored = draft.trim();
  const length = stored.length;
  const tooLong = length > limit;
  const empty = length === 0;
  const unsaved = stored !== (savedBody ?? "");
  return {
    length,
    limit,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
