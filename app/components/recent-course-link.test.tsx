import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { RecentCourseLink } from "~/components/recent-course-link";

const course = {
  courseId: 7,
  title: "Design Systems with Tailwind",
  slug: "design-systems-with-tailwind",
  progress: 44,
};

function render(path = "/courses") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <RecentCourseLink course={course} />
    </MemoryRouter>
  );
}

function linkTag(html: string) {
  return html.slice(0, html.indexOf(">") + 1);
}

describe("RecentCourseLink", () => {
  it("shows the full title on hover", () => {
    expect(linkTag(render())).toContain('title="Design Systems with Tailwind"');
  });

  it("wraps the title onto two lines instead of truncating it to one", () => {
    const html = render();
    expect(html).toContain(
      '<div class="line-clamp-2 text-sm font-medium">Design Systems with Tailwind</div>'
    );
    expect(html).not.toContain("truncate");
  });

  it("links to the course and shows its progress", () => {
    const html = render();
    expect(linkTag(html)).toContain(
      'href="/courses/design-systems-with-tailwind"'
    );
    expect(html).toContain("44%");
  });

  it("highlights the course being viewed", () => {
    expect(linkTag(render("/courses/design-systems-with-tailwind"))).toContain(
      "bg-sidebar-accent text-sidebar-accent-foreground"
    );
    expect(linkTag(render("/courses"))).not.toContain(
      "bg-sidebar-accent text-sidebar-accent-foreground"
    );
  });
});
