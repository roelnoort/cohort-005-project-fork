import {
  actionsFor,
  type HeroAction,
  type HeroViewer,
} from "./lib/hero-actions";

export type { HeroAction, HeroViewer };

/**
 * The calls to action in the landing page hero, in display order: browsing
 * comes first for everyone, then the next step that fits the visitor.
 */
export function heroActions(viewer: HeroViewer): HeroAction[] {
  return actionsFor(viewer);
}
