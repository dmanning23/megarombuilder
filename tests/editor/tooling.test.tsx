// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("component tests", () => {
  it("render React in jsdom", () => {
    render(<button>Make a new game</button>);
    expect(screen.getByRole("button", { name: "Make a new game" })).toBeTruthy();
  });

  it("see no canvas context", () => {
    expect(document.createElement("canvas").getContext("2d")).toBeNull();
  });
});
