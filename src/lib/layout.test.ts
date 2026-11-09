import { describe, expect, it } from "vitest";
import { SIM } from "./constants";
import { frameAccel, jumpMetrics, loft, span } from "./layout";

describe("single-jump loft", () => {
  it("keeps the climb under one hop and the early gap under one running jump", () => {
    const metrics = jumpMetrics();
    const stage = loft();
    const left = span(stage.platforms[0]!);
    const right = span(stage.platforms[1]!);
    const beam = span(stage.platforms[2]!);
    const gap = right.left - left.right;
    const rise = left.top - beam.top;

    expect(metrics.climb / metrics.H).toBeCloseTo(0.75);
    expect(jumpMetrics(SIM.jumpSpeed + 2, SIM.runSpeed, SIM.gravity).H).toBeGreaterThan(metrics.H);
    expect(frameAccel(0.002, 10)).toBeCloseTo(0.2);
    expect(metrics.earlyGap / metrics.D).toBeCloseTo(0.8);
    expect(metrics.lateGap).toBeGreaterThan(metrics.D);
    expect(rise).toBeCloseTo(metrics.climb);
    expect(rise).toBeLessThan(metrics.H);
    expect(gap).toBeCloseTo(metrics.earlyGap);
    expect(gap).toBeLessThan(metrics.D);
    expect(beam.left).toBeGreaterThan(left.right);
  });
});
