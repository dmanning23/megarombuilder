// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { HeroPreview } from "@/editor/components/HeroPreview";
import { DEFAULT_ABILITIES } from "@/model/hero";

afterEach(cleanup);

describe("HeroPreview", () => {
  it("shows a game-sized picture of the hero in action", () => {
    render(<HeroPreview look={snowHero} abilities={DEFAULT_ABILITIES} pack={snowPack} art={snowArt} />);
    const canvas = screen.getByRole("img", { name: "Your hero in action" }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 240]);
  });
});
