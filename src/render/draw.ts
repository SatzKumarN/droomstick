import { COMBAT, isDodging, isPunching, type Splash } from "../lib/combat";
import { BARREL, formatClock } from "../lib/crumble";
import { HP, MATCH_MS, SERIES_LENGTH } from "../lib/constants";
import { displayName, labelFor } from "../lib/name";
import { colorForSlot, type BroomColor } from "../lib/palette";
import { kickButton, layoutDoor, type DoorView } from "../lib/net";
import { seriesButtons, standings, type Series } from "../lib/series";
import { isGrounded, type Sim } from "../lib/physics";
import { controlLayout, type ButtonBox, type ControlLayout } from "../lib/input";
import { limbPose, ragdollPose, ragdollTilt, type Facing, type LimbPose } from "../lib/pose";
import type { PoppedHead, Stain } from "../lib/death";
import { muteButton } from "../lib/sfx";

const VIEW_W = 960;
const VIEW_H = 540;

/** A pit kill happens just under the camera. Keep the ragdoll on screen. */
function onScreen(y: number): number {
  return Math.min(y, VIEW_H - 18);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  cssWidth: number,
  cssHeight: number,
  facing: Facing,
  series: Series,
  door: DoorView,
  showKick = false,
  nickname = "",
  muted = false,
): ControlLayout {
  const layout = controlLayout(cssWidth, cssHeight);
  const portrait = cssHeight > cssWidth;
  const reserve = portrait ? Math.min(168, Math.round(cssHeight * 0.26)) : 0;
  const viewH = Math.max(1, cssHeight - reserve);
  const scale = Math.min(cssWidth / VIEW_W, viewH / VIEW_H);
  const ox = (cssWidth - VIEW_W * scale) / 2;
  const oy = Math.max(0, (viewH - VIEW_H * scale) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#d7c4a3";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.fillStyle = "#6a4a30";
  for (const platform of [...sim.platforms, ...sim.chunks]) {
    const width = platform.bounds.max.x - platform.bounds.min.x;
    const height = platform.bounds.max.y - platform.bounds.min.y;
    ctx.fillRect(platform.bounds.min.x - 0.5, platform.bounds.min.y, width + 1, height);
  }
  for (const stain of sim.stains) drawStain(ctx, { ...stain, y: onScreen(stain.y) });
  for (const dust of sim.dust) drawBarrel(ctx, dust);
  const playerHead = sim.heads.find((head) => head.slot === 1);
  const pose = sim.fighter.hp <= 0 && playerHead
    ? ragdollPose(facing, playerHead.age)
    : limbPose({
    vx: sim.player.velocity.x,
    vy: sim.player.velocity.y,
    grounded: isGrounded(sim),
    timeMs: sim.engine.timing.timestamp,
    facing,
    acting: isPunching(sim.fighter)
      ? "punch"
      : isDodging(sim.fighter)
        ? "dodge"
        : undefined,
  });
  if (sim.dummy) {
    const dummyFacing: Facing = sim.dummyFacing;
    const dummyHead = sim.heads.find((head) => head.slot === 2);
    const dummyPose = sim.dummyFighter.hp <= 0 && dummyHead
      ? ragdollPose(dummyFacing, dummyHead.age)
      : limbPose({
          vx: sim.dummy.velocity.x,
          vy: sim.dummy.velocity.y,
          grounded: true,
          timeMs: sim.engine.timing.timestamp,
          facing: dummyFacing,
        });
    const dummyFeet = sim.dummyFighter.hp <= 0 ? onScreen(sim.dummy.bounds.max.y) : sim.dummy.bounds.max.y;
    drawBroom(ctx, sim.dummy.position.x, dummyFeet, dummyPose, colorForSlot(2), {
      headless: sim.dummyFighter.hp <= 0,
      tilt: dummyHead && sim.dummyFighter.hp <= 0 ? ragdollTilt(dummyFacing, dummyHead.age) : 0,
    });
  }
  const playerFeet = sim.fighter.hp <= 0 ? onScreen(sim.player.bounds.max.y) : sim.player.bounds.max.y;
  drawBroom(ctx, sim.player.position.x, playerFeet, pose, colorForSlot(1), {
    headless: sim.fighter.hp <= 0,
    tilt: playerHead && sim.fighter.hp <= 0 ? ragdollTilt(facing, playerHead.age) : 0,
  });
  for (const head of sim.heads) drawPoppedHead(ctx, head);
  drawSplashes(ctx, sim);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (door.kind !== "play") {
    drawDoor(ctx, door, cssWidth, cssHeight, nickname);
    paintButton(ctx, muteButton(muted, cssWidth));
    return layout;
  }
  if (series.phase === "fight" || series.phase === "intermission") {
    drawHealth(ctx, cssWidth, sim, series);
    drawClock(ctx, sim);
    drawMatch(ctx, series);
    if (series.phase === "fight") drawControls(ctx, layout);
  }
  if (series.phase !== "fight") drawMenu(ctx, series, cssWidth, cssHeight);
  if (showKick) paintButton(ctx, kickButton(cssWidth));
  paintButton(ctx, muteButton(muted));
  return layout;
}

function paintButton(
  ctx: CanvasRenderingContext2D,
  button: { x: number; y: number; w: number; h: number; label: string },
): void {
  ctx.fillStyle = "#141414";
  ctx.fillRect(button.x, button.y, button.w, button.h);
  ctx.fillStyle = "#f7f7f5";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(button.label, button.x + button.w / 2, button.y + 32);
  ctx.textAlign = "left";
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  door: Exclude<DoorView, { kind: "play" }>,
  width: number,
  height: number,
  nickname: string,
): void {
  ctx.fillStyle = "rgba(20, 20, 20, 0.45)";
  ctx.fillRect(0, 0, width, height);
  const layout = layoutDoor(
    door.kind,
    width,
    height,
    door.kind === "host" ? door.canStart : false,
    door.kind === "host" && door.code.length === 6,
  );
  const { panel } = layout;
  ctx.fillStyle = "#f3e6cf";
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = "#141414";
  ctx.textAlign = "center";
  ctx.font = height < 420 ? "22px sans-serif" : "28px sans-serif";
  ctx.fillText("Droomstick: Mayhem", width / 2, layout.titleY);
  ctx.font = "18px sans-serif";
  if (door.kind === "pick") {
    ctx.fillText("Practice here, or play a friend.", width / 2, layout.lineY);
  } else if (door.kind === "host") {
    ctx.font = `${layout.codeSize}px sans-serif`;
    ctx.fillText(door.code || "......", width / 2, layout.lineY);
    ctx.font = "18px sans-serif";
    ctx.fillText(
      height < 420 ? `${door.status} · ${displayName(nickname, "Red")}` : door.status,
      width / 2,
      layout.detailY,
    );
    if (height >= 420) ctx.fillText(`Host: ${displayName(nickname, "Red")}`, width / 2, layout.nameY);
  } else if (door.kind === "notice") {
    ctx.fillText(door.status, width / 2, layout.lineY);
  } else {
    const digits = `${door.digits}${"·".repeat(6 - door.digits.length)}`;
    ctx.font = `${layout.codeSize}px sans-serif`;
    ctx.fillText(digits, width / 2, layout.lineY);
    ctx.font = "18px sans-serif";
    ctx.fillText(door.status, width / 2, layout.detailY);
  }
  for (const button of layout.buttons) paintButton(ctx, button);
}

function drawMatch(ctx: CanvasRenderingContext2D, series: Series): void {
  ctx.fillStyle = "#141414";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Match ${series.match}/${SERIES_LENGTH}`, 28, 72);
}

function drawMenu(
  ctx: CanvasRenderingContext2D,
  series: Series,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "rgba(20, 20, 20, 0.45)";
  ctx.fillRect(0, 0, width, height);
  const panelW = Math.min(460, width - 24);
  const panelH = Math.min(320, height - 16);
  const x = (width - panelW) / 2;
  const y = Math.max(8, Math.min(height / 2 - 170, height - panelH - 8));
  ctx.fillStyle = "#f3e6cf";
  ctx.fillRect(x, y, panelW, panelH);
  ctx.fillStyle = "#141414";
  ctx.textAlign = "center";
  ctx.font = "28px sans-serif";
  if (series.phase === "lobby") {
    ctx.fillText("Droomstick: Mayhem", width / 2, y + 72);
    ctx.font = "18px sans-serif";
    ctx.fillText(`${labelFor(series.names, 1)}   ·   ${labelFor(series.names, 2)}`, width / 2, y + 118);
    ctx.fillText("Five matches. Last broom standing.", width / 2, y + 150);
  } else if (series.phase === "intermission") {
    const title =
      series.winner === null ? "Both down. Replay." : `${labelFor(series.names, series.winner)} wins`;
    ctx.fillText(title, width / 2, y + 84);
    ctx.font = "18px sans-serif";
    ctx.fillText(`Next in ${Math.ceil(series.intermissionMs / 1000)}`, width / 2, y + 124);
  } else {
    ctx.fillText("Series", width / 2, y + 58);
    ctx.font = "22px sans-serif";
    ctx.textAlign = "left";
    standings(series).forEach((row, index) => {
      const color = colorForSlot(row.slot);
      const line = y + 108 + index * 36;
      ctx.fillStyle = color.fill;
      ctx.fillRect(x + 48, line - 16, 18, 18);
      ctx.fillStyle = "#141414";
      ctx.fillText(`${labelFor(series.names, row.slot)}    ${row.wins}`, x + 78, line);
    });
  }
  for (const button of seriesButtons(series.phase, width, height)) paintButton(ctx, button);
}

function drawBarrel(
  ctx: CanvasRenderingContext2D,
  body: { position: { x: number; y: number }; angle: number },
): void {
  const w = BARREL.w;
  const h = BARREL.h;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "#a56b3c";
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h / 2);
  ctx.quadraticCurveTo(-w * 0.62, 0, -w * 0.32, h / 2);
  ctx.lineTo(w * 0.32, h / 2);
  ctx.quadraticCurveTo(w * 0.62, 0, w * 0.32, -h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6a4324";
  ctx.lineWidth = 1;
  for (let stave = -2; stave <= 2; stave += 1) {
    ctx.beginPath();
    ctx.moveTo(stave * 3.2, -h / 2 + 2);
    ctx.quadraticCurveTo(stave * 4.2, 0, stave * 3.2, h / 2 - 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#2a2118";
  ctx.lineWidth = 2.5;
  for (const hoop of [-0.22, 0.22]) {
    const y = h * hoop;
    const bulge = 0.5 - Math.abs(hoop);
    ctx.beginPath();
    ctx.moveTo(-w * bulge, y);
    ctx.quadraticCurveTo(0, y + Math.sign(hoop) * 1.5, w * bulge, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawClock(ctx: CanvasRenderingContext2D, sim: Sim): void {
  ctx.fillStyle = "#141414";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(formatClock(MATCH_MS - sim.elapsed), 28, 46);
}

function drawHealth(ctx: CanvasRenderingContext2D, width: number, sim: Sim, series: Series): void {
  const radius = 26;
  const gap = 16;
  const cy = 28 + radius;
  const playerX = width - 36 - radius;
  drawHealthRing(ctx, playerX, cy, sim.fighter.hp, colorForSlot(1).fill);
  ctx.fillStyle = "#141414";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(labelFor(series.names, 1), playerX, cy + radius + 18);
  if (sim.dummy) {
    const blueX = playerX - radius * 2 - gap;
    drawHealthRing(ctx, blueX, cy, sim.dummyFighter.hp, colorForSlot(2).fill);
    ctx.fillStyle = "#141414";
    ctx.fillText(labelFor(series.names, 2), blueX, cy + radius + 18);
  }
  ctx.textAlign = "left";
}

function drawHealthRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hp: number,
  color: string,
): void {
  const radius = 26;
  ctx.lineCap = "butt";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(20, 20, 20, 0.16)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  const fraction = Math.max(0, Math.min(1, hp / HP));
  if (fraction === 0) return;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
  ctx.stroke();
}

function drawSplashes(ctx: CanvasRenderingContext2D, sim: Sim): void {
  for (const splash of sim.splashes) drawInk(ctx, splash, splash.big ? 1.8 : 1);
  ctx.globalAlpha = 1;
}

function drawStain(ctx: CanvasRenderingContext2D, stain: Stain): void {
  drawInk(
    ctx,
    { x: stain.x, y: stain.y, life: COMBAT.splashLifeMs, slot: stain.slot, seed: stain.seed },
    0.45,
    0.8,
  );
}

function drawPoppedHead(ctx: CanvasRenderingContext2D, head: PoppedHead): void {
  ctx.save();
  ctx.translate(head.x, onScreen(head.y));
  ctx.rotate(head.angle);
  drawBristleHead(ctx, 0, 0, 1, colorForSlot(head.slot));
  ctx.restore();
}

function inkRand(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function drawInk(ctx: CanvasRenderingContext2D, splash: Splash, scale = 1, alpha = 1): void {
  const rand = inkRand(splash.seed * 9973 + 17);
  const age = 1 - Math.max(0, splash.life / COMBAT.splashLifeMs);
  const lobes = 5 + (splash.seed % 4);
  ctx.save();
  ctx.translate(splash.x, splash.y);
  ctx.rotate(splash.seed * 0.9);
  ctx.globalAlpha = Math.max(0, 1 - age) * alpha;
  ctx.fillStyle = colorForSlot(splash.slot).fill;
  const size = 0.55 * scale;
  ctx.scale((0.95 + age * 0.4) * size, (0.9 + age * 0.32) * size);
  blot(ctx, rand, 0, 0, 18, lobes);
  blot(ctx, rand, (rand() - 0.5) * 16, (rand() - 0.5) * 14, 8, Math.max(5, lobes - 1));
  const streaks = 2 + (splash.seed % 3);
  for (let i = 0; i < streaks; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = 20 + rand() * 14;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(angle) * dist,
      Math.sin(angle) * dist,
      3 + rand() * 6,
      1.4 + rand() * 1.6,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const drops = 4 + (splash.seed % 5);
  for (let i = 0; i < drops; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = 26 + rand() * 16;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.1 + rand() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function blot(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  x: number,
  y: number,
  size: number,
  lobes: number,
): void {
  ctx.beginPath();
  for (let i = 0; i <= lobes; i += 1) {
    const angle = (i / lobes) * Math.PI * 2;
    const radius = size * (0.65 + rand() * 0.7);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
      continue;
    }
    const mid = angle - Math.PI / lobes;
    const bulge = size * (0.9 + rand() * 0.8);
    ctx.quadraticCurveTo(x + Math.cos(mid) * bulge, y + Math.sin(mid) * bulge, px, py);
  }
  ctx.fill();
}

function drawBroom(
  ctx: CanvasRenderingContext2D,
  x: number,
  feetY: number,
  pose: LimbPose,
  color: BroomColor,
  options?: { headless?: boolean; tilt?: number },
): void {
  const bodyX = x;
  const stickBottom = feetY - 22 + pose.bob;
  const stickTop = stickBottom - 14;
  ctx.save();
  ctx.translate(x, feetY);
  ctx.rotate(options?.tilt ?? 0);
  ctx.translate(-x, -feetY);
  drawLimb(ctx, bodyX, stickTop + 7, pose.backArm, 0.4, pose.facing, color, true, 12, 11);
  drawStick(ctx, bodyX, stickTop, stickBottom, color);
  drawLimb(ctx, bodyX, stickBottom, pose.backLeg, pose.knee, pose.facing, color, false, 13, 12);
  drawLimb(ctx, bodyX, stickBottom, pose.frontLeg, pose.knee, pose.facing, color, false, 13, 12);
  drawLimb(ctx, bodyX, stickTop + 7, pose.frontArm, 0.4, pose.facing, color, true, 12, 11);
  if (!options?.headless) drawBristleHead(ctx, bodyX, stickTop, pose.facing, color);
  ctx.restore();
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  color: BroomColor,
): void {
  const width = 8;
  ctx.fillStyle = color.fill;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, top, width, bottom - top, 4);
  ctx.fill();
}

function drawBristleHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  bindY: number,
  facing: Facing,
  color: BroomColor,
): void {
  const rand = inkRand(color.slot * 9973 + 17);
  const count = 25 + Math.floor(rand() * 16);
  const spread = 36 + rand() * 26;
  const thickness = 1.4 + rand() * 0.9;
  const head = 40;
  const bristles = [];
  let peak = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const length = 0.35 + Math.sin(t * Math.PI) * (0.4 + rand() * 0.55);
    peak = Math.max(peak, length);
    bristles.push({
      side: t - 0.5,
      length,
      lean: (rand() - 0.5) * 14,
      bend: 0.2 + rand() * 0.5,
      curve: 0.35 + rand() * 0.35,
      width: thickness * (0.7 + rand() * 0.6),
    });
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = color.fill;
  for (const bristle of bristles) {
    const length = (bristle.length / peak) * head;
    const tipX = x + facing * (bristle.side * spread + bristle.lean);
    const tipY = bindY - length;
    ctx.beginPath();
    ctx.moveTo(x, bindY);
    ctx.quadraticCurveTo(
      x + facing * (bristle.side * spread * bristle.bend + bristle.lean * 0.35),
      bindY - length * bristle.curve,
      tipX,
      tipY,
    );
    ctx.lineWidth = bristle.width;
    ctx.stroke();
  }
  const band = 10 + rand() * 8;
  ctx.fillStyle = color.fill;
  ctx.beginPath();
  ctx.roundRect(x - band / 2, bindY - 3, band, 7, 3);
  ctx.fill();
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  rootX: number,
  rootY: number,
  swing: number,
  bend: number,
  facing: Facing,
  color: BroomColor,
  hand: boolean,
  upper: number,
  lower: number,
): void {
  const joint = endOf(rootX, rootY, swing, upper, facing);
  const tip = endOf(joint.x, joint.y, swing + (hand ? bend : -bend), lower, facing);
  strokeLine(ctx, rootX, rootY, joint.x, joint.y, color.fill, 4);
  strokeLine(ctx, joint.x, joint.y, tip.x, tip.y, color.fill, 4);
  fillCircle(ctx, tip.x, tip.y, hand ? 4.5 : 3.5, color);
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: BroomColor,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color.fill;
  ctx.fill();
}

function endOf(
  x: number,
  y: number,
  angle: number,
  length: number,
  facing: Facing,
): { x: number; y: number } {
  return {
    x: x + Math.sin(angle) * length * facing,
    y: y + Math.cos(angle) * length,
  };
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawButton(ctx: CanvasRenderingContext2D, box: ButtonBox, label: string): void {
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.strokeStyle = "rgba(20, 20, 20, 0.45)";
  ctx.lineWidth = 3;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = "#141414";
  ctx.font = "16px sans-serif";
  ctx.fillText(label, box.x + 16, box.y + 36);
}

function drawControls(ctx: CanvasRenderingContext2D, layout: ControlLayout): void {
  ctx.strokeStyle = "rgba(20, 20, 20, 0.45)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(layout.stick.cx, layout.stick.cy, layout.stick.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawButton(ctx, layout.punch, "Punch");
  drawButton(ctx, layout.dodge, "Dodge");
  drawButton(ctx, layout.jump, "Jump");
}
