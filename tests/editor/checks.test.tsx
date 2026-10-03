// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZoneCheck } from "@/checker/check";
import { snowPack } from "@/content/snow/pack";
import { CheckPanel } from "@/editor/components/CheckPanel";
import { ZoneList } from "@/editor/components/ZoneList";
import { newProject } from "@/editor/newProject";
import { useLevelCheck } from "@/editor/useLevelCheck";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let n = 0;
const makeId = () => `id-${++n}`;

const zoneCheck = (overrides: Partial<ZoneCheck> = {}): ZoneCheck => ({
  zoneId: "z",
  name: "Zone 1",
  passable: true,
  difficulty: 3,
  reason: null,
  furthest: null,
  warnings: [],
  ...overrides,
});

describe("useLevelCheck", () => {
  it("checks a moment after the project stops changing, and not while paused", () => {
    vi.useFakeTimers();
    const project = newProject("Checked", makeId);
    const levelId = project.levels[0].id;
    const { result, rerender } = renderHook(
      ({ paused }) => useLevelCheck(project, levelId, snowPack, paused, 400),
      { initialProps: { paused: true } },
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBeNull();
    rerender({ paused: false });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current?.zones).toHaveLength(3);
    expect(result.current?.problems).toEqual([]);
  });
});

describe("useLevelCheck reuse", () => {
  it("rechecks only the zones that changed", () => {
    vi.useFakeTimers();
    const project = newProject("Reuse", makeId);
    const level = project.levels[0];
    const { result, rerender } = renderHook(({ p }) => useLevelCheck(p, level.id, snowPack, false, 400), {
      initialProps: { p: project },
    });
    act(() => vi.advanceTimersByTime(400));
    const before = result.current;
    const edited = {
      ...project,
      levels: [{ ...level, zones: level.zones.map((z, i) => (i === 0 ? { ...z, intent: "changed" } : z)) }],
    };
    rerender({ p: edited });
    act(() => vi.advanceTimersByTime(400));
    expect(result.current?.zones[1]).toBe(before?.zones[1]);
    expect(result.current?.zones[2]).toBe(before?.zones[2]);
    expect(result.current?.zones[0]).not.toBe(before?.zones[0]);
  });

  it("rechecks every zone when the player's settings change", () => {
    vi.useFakeTimers();
    const project = newProject("Settings", makeId);
    const level = project.levels[0];
    const { result, rerender } = renderHook(({ p }) => useLevelCheck(p, level.id, snowPack, false, 400), {
      initialProps: { p: project },
    });
    act(() => vi.advanceTimersByTime(400));
    const before = result.current;
    rerender({ p: { ...project, player: { ...project.player, runSpeed: 1 } } });
    act(() => vi.advanceTimersByTime(400));
    expect(result.current?.zones[1]).not.toBe(before?.zones[1]);
  });
});

describe("CheckPanel", () => {
  it("waits for the first check", () => {
    render(<CheckPanel problems={[]} />);
    expect(screen.getByText("Checking…")).toBeTruthy();
  });

  it("gives the difficulty of a crossable zone", () => {
    render(<CheckPanel zoneCheck={zoneCheck()} problems={[]} />);
    expect(screen.getByText("This zone can be crossed. Difficulty 3 of 10.")).toBeTruthy();
  });

  it("explains a zone that can't be crossed, with its warnings", () => {
    render(
      <CheckPanel
        zoneCheck={zoneCheck({ passable: false, reason: "Cannot get past column 5.", warnings: ["The Snow Crawler at (2, 12) is right where the player arrives."] })}
        problems={[]}
      />,
    );
    expect(screen.getByText("This zone can't be crossed.")).toBeTruthy();
    expect(screen.getByText("Cannot get past column 5.")).toBeTruthy();
    expect(screen.getByText("The Snow Crawler at (2, 12) is right where the player arrives.")).toBeTruthy();
  });

  it("lists level problems", () => {
    render(<CheckPanel zoneCheck={zoneCheck()} problems={['The boss room "Boss Room" has no boss, so the level can never be won.']} />);
    expect(screen.getByRole("heading", { name: "Level problems" })).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toMatch(/has no boss/);
  });
});

describe("ZoneList with checks", () => {
  const level = newProject("Badges", makeId).levels[0];
  const props = () => ({
    level,
    selectedId: level.zones[0].id,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
    onAddClimb: vi.fn(),
  });

  it("shows each zone's difficulty, or that it can't be crossed", () => {
    const checks = [
      zoneCheck({ zoneId: level.zones[0].id, difficulty: 4 }),
      zoneCheck({ zoneId: level.zones[1].id, passable: false }),
    ];
    render(<ZoneList {...props()} checks={checks} />);
    expect(screen.getByRole("button", { name: /Zone 1.*difficulty 4/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Boss Corridor.*can't be crossed/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Boss Room/ }).textContent).not.toMatch(/!|\d$/);
  });

  it("adds a climbing zone", async () => {
    const p = props();
    render(<ZoneList {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a climbing zone" }));
    expect(p.onAddClimb).toHaveBeenCalled();
  });

  it("can be switched off, while playing", () => {
    render(<ZoneList {...props()} disabled />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
