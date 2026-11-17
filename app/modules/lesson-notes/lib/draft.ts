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
  const length = draft.length;
  const tooLong = length > limit;
  const empty = draft.trim().length === 0;
  const unsaved = draft !== (savedBody ?? "");
  return {
    length,
    limit,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
