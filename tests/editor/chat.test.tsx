// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelError } from "@/ai/turn";
import { SPIKE } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { scriptedModel, say, useTools, waitForAbort, type Step } from "../ai/fakeModel";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;
const spikes = ["fill_rect", { zone: "Zone 1", x: 3, y: 13, w: 2, h: 1, tile: SPIKE }] as [string, unknown];
const spikeIn = (project: Project | undefined) => project?.levels[0].zones[0].tiles[13 * 16 + 4];

function setup(steps: Step[], initial: Project = newProject("Game", makeId)) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const { model } = scriptedModel(steps);
  render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={0} model={model} />);
  const lastSaved = () => save.mock.calls.at(-1)?.[0];
  return { save, lastSaved };
}

async function ask(text: string) {
  await userEvent.type(screen.getByRole("textbox", { name: "Message" }), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("the assistant in the editor", () => {
  it("suggests what to ask when there is no chat yet", () => {
    setup([]);
    expect(screen.getByText(/Ask for a change/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
  });

  it("shows the game's earlier chat", () => {
    const initial: Project = {
      ...newProject("Game", makeId),
      chat: [
        { role: "user", text: "Make it snowy", at: "t" },
        { role: "assistant", text: "Done! It's snowy now.", at: "t" },
      ],
    };
    setup([], initial);
    expect(screen.getByText("Make it snowy")).toBeTruthy();
    expect(screen.getByText("Done! It's snowy now.")).toBeTruthy();
  });

  it("asks, shows the reply, saves the chat, and undoes the whole turn in one step", async () => {
    const { lastSaved } = setup([useTools(spikes), useTools(["check_zone", { zone: "Zone 1" }]), say("I added spikes to Zone 1.")]);
    await ask("Add spikes");
    expect(await screen.findByText("I added spikes to Zone 1.")).toBeTruthy();
    expect(screen.getByText("Add spikes")).toBeTruthy();
    await waitFor(() => expect(spikeIn(lastSaved())).toBe(SPIKE));
    expect(lastSaved()!.chat.map((m) => m.text)).toEqual(["Add spikes", "I added spikes to Zone 1."]);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(spikeIn(lastSaved())).toBe(1)); // the floor is back
    expect(lastSaved()!.chat).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
  });

  it("sends with Enter", async () => {
    setup([say("Hello!")]);
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Hi{Enter}");
    expect(await screen.findByText("Hello!")).toBeTruthy();
  });

  it("follows the zone the assistant is changing", async () => {
    setup([
      useTools(["fill_rect", { zone: "Boss Corridor", x: 3, y: 13, w: 1, h: 1, tile: SPIKE }], ["check_zone", { zone: "Boss Corridor" }]),
      say("Done."),
    ]);
    await ask("Spikes in the corridor");
    await screen.findByText("Done.");
    expect(screen.getByLabelText("Boss Corridor, 1 screen")).toBeTruthy();
  });

  it("locks the level while it works, and Stop puts the level back", async () => {
    const { save } = setup([useTools(spikes), waitForAbort]);
    await ask("Add spikes");
    expect(await screen.findByText("Building Zone 1…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a zone" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Export" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Stopped. Nothing was changed.");
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveProperty("value", "Add spikes");
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
    expect(save.mock.calls.some(([project]) => spikeIn(project) === SPIKE)).toBe(false);
  });

  it("unlocks the level and puts it back if something unexpected breaks the turn", async () => {
    // A reply that breaks the turn itself, outside the model call (as a bug in a tool would).
    const content = Object.assign([], {
      filter() {
        throw new Error("boom");
      },
    });
    const broken = { content, stop_reason: "end_turn" } as unknown as Step;
    const { save } = setup([useTools(spikes), broken]);
    await ask("Add spikes");
    expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong");
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Add a zone" })).toHaveProperty("disabled", false);
    expect(save.mock.calls.some(([project]) => spikeIn(project) === SPIKE)).toBe(false);
  });

  it("says when the assistant is unavailable, and the editor keeps working", async () => {
    setup([new ModelError("unavailable")]);
    await ask("Add spikes");
    expect((await screen.findByRole("alert")).textContent).toContain("The assistant isn't available right now.");
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", false);
    await userEvent.click(screen.getByRole("button", { name: "Add a zone" }));
    expect(screen.getByRole("button", { name: /Zone 2/ })).toBeTruthy();
  });
});
