export type HeroAction = {
  label: string;
  to: string;
  variant: "default" | "outline";
};

export type HeroViewer = { id: number } | null;

const browseCourses: HeroAction = {
  label: "Browse Courses",
  to: "/courses",
  variant: "default",
};

export function actionsFor(viewer: HeroViewer): HeroAction[] {
  const secondary: HeroAction = viewer
    ? { label: "Go to Dashboard", to: "/dashboard", variant: "outline" }
    : { label: "Sign Up Free", to: "/signup", variant: "outline" };
  return [browseCourses, secondary];
}
