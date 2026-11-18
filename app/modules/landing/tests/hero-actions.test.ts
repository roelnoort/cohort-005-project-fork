import { describe, it, expect } from "vitest";
import { heroActions } from "../index";

describe("heroActions", () => {
  it("offers browsing first, then sign-up, to a signed-out visitor", () => {
    expect(heroActions(null)).toEqual([
      { label: "Browse Courses", to: "/courses", variant: "default" },
      { label: "Sign Up Free", to: "/signup", variant: "outline" },
    ]);
  });

  it("offers browsing first, then the dashboard, to a signed-in visitor", () => {
    expect(heroActions({ id: 7 })).toEqual([
      { label: "Browse Courses", to: "/courses", variant: "default" },
      { label: "Go to Dashboard", to: "/dashboard", variant: "outline" },
    ]);
  });

  it("never offers sign-up to a signed-in visitor", () => {
    const targets = heroActions({ id: 1 }).map((action) => action.to);
    expect(targets).not.toContain("/signup");
  });

  it("gives exactly one primary action", () => {
    for (const viewer of [null, { id: 1 }]) {
      const primaries = heroActions(viewer).filter(
        (action) => action.variant === "default"
      );
      expect(primaries).toHaveLength(1);
    }
  });
});
