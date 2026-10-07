// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snowArt } from "@/content/snow/art";
import { snowHero } from "@/content/snow/hero";
import { snowPack } from "@/content/snow/pack";
import { GamePreview } from "@/editor/components/GamePreview";
import { previewInputs, previewSim } from "@/editor/hero/preview";
import { DEFAULT_ABILITIES } from "@/model/hero";

afterEach(cleanup);

describe("GamePreview", () => {
  it("shows a game-sized picture of the game, named", () => {
    render(
      <GamePreview
        label="Your hero in action"
        start={() => previewSim(snowHero, DEFAULT_ABILITIES, snowPack)}
        inputs={previewInputs(DEFAULT_ABILITIES)}
        heroLook={snowHero}
        enemies={[]}
        art={snowArt}
      />,
    );
    const canvas = screen.getByRole("img", { name: "Your hero in action" }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 240]);
  });
});
