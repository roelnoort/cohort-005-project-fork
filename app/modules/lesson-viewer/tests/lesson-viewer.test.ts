import { describe, it, expect } from "vitest";
import { flattenCourseLessons } from "../course.server";
import { calculateWatchProgress } from "../progress.server";

describe("flattenCourseLessons", () => {
  it("lists lessons in module order, each tagged with its module", () => {
    const course = {
      modules: [
        {
          id: 1,
          title: "Basics",
          lessons: [
            { id: 10, title: "Hello", moduleId: 1 },
            { id: 11, title: "Variables", moduleId: 1 },
          ],
        },
        {
          id: 2,
          title: "Functions",
          lessons: [{ id: 20, title: "Arguments", moduleId: 2 }],
        },
      ],
    };

    expect(flattenCourseLessons(course)).toEqual([
      { id: 10, title: "Hello", moduleId: 1, moduleTitle: "Basics" },
      { id: 11, title: "Variables", moduleId: 1, moduleTitle: "Basics" },
      { id: 20, title: "Arguments", moduleId: 2, moduleTitle: "Functions" },
    ]);
  });

  it("skips modules with no lessons", () => {
    expect(
      flattenCourseLessons({
        modules: [{ id: 1, title: "Empty", lessons: [] }],
      })
    ).toEqual([]);
  });
});

describe("calculateWatchProgress", () => {
  it("is zero for a video with no duration, without reading any events", () => {
    expect(calculateWatchProgress(1, 1, 0)).toBe(0);
    expect(calculateWatchProgress(1, 1, -5)).toBe(0);
  });
});
