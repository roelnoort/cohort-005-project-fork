import { NavLink } from "react-router";
import { cn } from "~/lib/utils";

export type RecentCourse = {
  courseId: number;
  title: string;
  slug: string;
  progress: number;
};

export function RecentCourseLink({ course }: { course: RecentCourse }) {
  return (
    <NavLink
      to={`/courses/${course.slug}`}
      // A title longer than two lines is still clamped; the tooltip shows it whole.
      title={course.title}
      className={({ isActive }) =>
        cn(
          "block rounded-md px-3 py-2 transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <div className="line-clamp-2 text-sm font-medium">{course.title}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-sidebar-accent">
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${course.progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-sidebar-foreground/50">
          {course.progress}%
        </span>
      </div>
    </NavLink>
  );
}
