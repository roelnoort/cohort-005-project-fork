import { describe, expect, it } from "vitest";
import { flattenCourseLessons } from "../course.server";

describe("flattenCourseLessons", () => {
  it("lists every lesson in module order, tagged with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        {
          id: 1,
          title: "Basics",
          lessons: [
            { id: 10, title: "Hello", moduleId: 1 },
            { id: 11, title: "Types", moduleId: 1 },
          ],
        },
        {
          id: 2,
          title: "Advanced",
          lessons: [{ id: 20, title: "Generics", moduleId: 2 }],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 10, title: "Hello", moduleId: 1, moduleTitle: "Basics" },
      { id: 11, title: "Types", moduleId: 1, moduleTitle: "Basics" },
      { id: 20, title: "Generics", moduleId: 2, moduleTitle: "Advanced" },
    ]);
  });

  it("returns nothing for a module with no lessons", () => {
    expect(
      flattenCourseLessons({
        modules: [{ id: 1, title: "Empty", lessons: [] }],
      })
    ).toEqual([]);
  });
});
