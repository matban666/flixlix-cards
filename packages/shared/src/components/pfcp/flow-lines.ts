import { type IndividualObject } from "@flixlix-cards/shared/states/raw/individual/get-individual-object";
import { type FlowCardPlusConfig, type NewDur } from "@flixlix-cards/shared/types";
import { checkShouldShowDots } from "@flixlix-cards/shared/utils/check-should-show-dots";
import { computeIndividualFlowRate } from "@flixlix-cards/shared/utils/compute-flow-rate";
import { showLine } from "@flixlix-cards/shared/utils/show-line";
import { styleLine } from "@flixlix-cards/shared/utils/style-line";
import { css, html, LitElement, nothing, svg, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

/**
 * Flow lines between the solar, grid, home, battery and device bubbles, drawn from the bubbles'
 * measured positions so every line ends on a bubble border at any card width. Also draws the
 * "!" badge on bubbles with an active `alert`.
 *
 * Lives in its own shadow DOM: the card's broad rules (`path {}`, `.circle svg {}`, ...) can't
 * reach in, and these styles can't leak out. Colours come in through the card's CSS variables.
 */

export type IndividualPosition = "left-top" | "left-bottom" | "right-top" | "right-bottom";
export type BubbleKey =
  | "solar"
  | "grid"
  | "home"
  | "battery"
  | "non-fossil"
  | `individual-${IndividualPosition}`;
export type FlowLineKey =
  | `individual-${IndividualPosition}`
  | "solar-home"
  | "solar-grid"
  | "solar-battery"
  | "grid-home"
  | "battery-home"
  | "battery-grid";

export type FlowDot = { dur: number; color: string; reverse?: boolean };
export type FlowLine = { key: FlowLineKey; color: string; zeroStyle: string; dots: FlowDot[] };

type Bubble = { x: number; y: number; r: number };
type Geometry = { width: number; height: number; bubbles: Partial<Record<BubbleKey, Bubble>> };

/** A device bubble and where the card placed it. */
export type PlacedIndividual = { position: IndividualPosition; obj: IndividualObject | undefined };

const individualColor: Record<IndividualPosition, string> = {
  "left-top": "var(--individual-left-top-color)",
  "left-bottom": "var(--individual-left-bottom-color)",
  "right-top": "var(--individual-right-top-color)",
  "right-bottom": "var(--individual-right-bottom-color)",
};

/** Which lines to draw and how, using the same rules as the original per-line components. */
export const flowLinesData = (
  config: FlowCardPlusConfig,
  {
    battery,
    grid,
    solar,
    newDur,
    individuals = [],
  }: {
    battery: any;
    grid: any;
    solar: any;
    newDur: NewDur;
    individuals?: PlacedIndividual[];
  }
): FlowLine[] => {
  const dots = checkShouldShowDots(config);
  const homeShown = !config.entities.home?.hide;
  const lines: FlowLine[] = [];
  const add = (show: boolean, line: Omit<FlowLine, "dots">, lineDots: (FlowDot | false)[]) => {
    if (show) lines.push({ ...line, dots: dots ? lineDots.filter((d): d is FlowDot => !!d) : [] });
  };

  add(
    solar.has && homeShown && showLine(config, solar.state.toHome || 0),
    {
      key: "solar-home",
      color: "var(--energy-solar-color)",
      zeroStyle: styleLine(solar.state.toHome || 0, config),
    },
    [!!solar.state.toHome && { dur: newDur.solarToHome, color: "var(--energy-solar-color)" }]
  );
  add(
    grid.has && grid.hasReturnToGrid && solar.has && showLine(config, solar.state.toGrid || 0),
    {
      key: "solar-grid",
      color: "var(--energy-grid-return-color)",
      zeroStyle: styleLine(solar.state.toGrid || 0, config),
    },
    [
      !!solar.state.toGrid && {
        dur: newDur.solarToGrid,
        color: "var(--energy-grid-return-color)",
      },
    ]
  );
  add(
    battery.has && solar.has && showLine(config, solar.state.toBattery || 0),
    {
      key: "solar-battery",
      color: "var(--energy-battery-in-color)",
      zeroStyle: styleLine(solar.state.toBattery || 0, config),
    },
    [
      !!solar.state.toBattery && {
        dur: newDur.solarToBattery,
        color: "var(--energy-battery-in-color)",
      },
    ]
  );
  add(
    grid.has && homeShown && showLine(config, grid.state.fromGrid),
    {
      key: "grid-home",
      color: "var(--energy-grid-consumption-color)",
      zeroStyle: styleLine(grid.state.toHome || 0, config),
    },
    [
      !!grid.state.toHome && {
        dur: newDur.gridToHome,
        color: "var(--energy-grid-consumption-color)",
      },
    ]
  );
  add(
    battery.has && homeShown && showLine(config, battery.state.toHome),
    {
      key: "battery-home",
      color: "var(--energy-battery-out-color)",
      zeroStyle: styleLine(battery.state.toHome || 0, config),
    },
    [
      !!battery.state.toHome && {
        dur: newDur.batteryToHome,
        color: "var(--energy-battery-out-color)",
      },
    ]
  );
  add(
    grid.has &&
      battery.has &&
      showLine(config, Math.max(grid.state.toBattery || 0, battery.state.toGrid || 0)),
    {
      key: "battery-grid",
      color: "var(--battery-grid-line)",
      zeroStyle: styleLine(battery.state.toGrid || grid.state.toBattery || 0, config),
    },
    [
      !!grid.state.toBattery && {
        dur: newDur.batteryGrid,
        color: "var(--energy-grid-consumption-color)",
        reverse: true,
      },
      !!battery.state.toGrid && {
        dur: newDur.batteryGrid,
        color: "var(--energy-grid-return-color)",
      },
    ]
  );

  // Device connectors. Dots run home -> device unless inverted_animation, as before.
  for (const { position, obj } of individuals) {
    if (!obj) continue;
    const index = config.entities.individual?.findIndex((e) => e.entity === obj.entity) ?? -1;
    const isRight = position.startsWith("right");
    const duration = newDur.individual[index] || (isRight ? 1.66 : 0);
    // The left-bottom element defaulted calculate_flow_rate to on; the others pass it through.
    const calculate =
      position === "left-bottom"
        ? obj.field?.calculate_flow_rate !== false
        : obj.field?.calculate_flow_rate;
    const state = obj.state || 0;
    add(
      homeShown && showLine(config, state),
      {
        key: `individual-${position}`,
        color: individualColor[position],
        zeroStyle: styleLine(state, config),
      },
      [
        !!obj.state &&
          obj.state >= (obj.displayZeroTolerance ?? 0) && {
            dur: computeIndividualFlowRate(calculate, duration),
            color: individualColor[position],
            // Left paths run home -> device; right paths (bends) run device -> home.
            reverse: isRight ? !obj.invertAnimation : obj.invertAnimation,
          },
      ]
    );
  }
  return lines;
};

/** Half-width of the circle at `offset` from its centre line, i.e. where a parallel line meets the edge. */
const edge = (b: Bubble, offset: number) => Math.sqrt(Math.max(b.r * b.r - offset * offset, 0));

/**
 * A vertical run from bubble `from` that bends into a horizontal run ending on bubble `to`.
 * `side` is +1 when `to` is right of `from`, -1 when left. Falls back to a straight line if the
 * bubbles aren't laid out for a bend.
 */
const bend = (from: Bubble, to: Bubble, gap: number, fromBelow: boolean): string => {
  const side = Math.sign(to.x - from.x) || 1;
  const vertical = fromBelow ? -1 : 1; // direction of travel from `from` towards `to`'s row
  const x0 = from.x + side * gap;
  const y0 = from.y + vertical * edge(from, gap);
  const yEnd = to.y - vertical * gap;
  const xEnd = to.x - side * edge(to, gap);
  const run = (yEnd - y0) * vertical;
  const reach = (xEnd - x0) * side;
  if (run <= 0 || reach <= 0) return `M${x0},${y0} L${xEnd},${yEnd}`;
  const radius = Math.min(run, reach, to.r * 0.6);
  return (
    `M${x0},${y0} V${yEnd - vertical * radius} ` +
    `Q${x0},${yEnd} ${x0 + side * radius},${yEnd} H${xEnd}`
  );
};

/** Straight line between two bubbles along their centre line, from edge to edge. */
const straight = (from: Bubble, to: Bubble): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return `M${from.x + ux * from.r},${from.y + uy * from.r} L${to.x - ux * to.r},${to.y - uy * to.r}`;
};

const linePath = (key: FlowLineKey, b: Geometry["bubbles"]): string | undefined => {
  const gap = (b.home?.r ?? 40) * 0.15;
  switch (key) {
    case "individual-left-top":
    case "individual-left-bottom": {
      const device = b[key];
      return b.home && device && straight(b.home, device);
    }
    case "individual-right-top":
    case "individual-right-bottom": {
      const device = b[key];
      return b.home && device && bend(device, b.home, gap, key === "individual-right-bottom");
    }
    case "solar-home":
      return b.solar && b.home && bend(b.solar, b.home, gap, false);
    case "solar-grid":
      return b.solar && b.grid && bend(b.solar, b.grid, gap, false);
    case "battery-home":
      return b.battery && b.home && bend(b.battery, b.home, gap, true);
    case "battery-grid":
      return b.battery && b.grid && bend(b.battery, b.grid, gap, true);
    case "solar-battery":
      return (
        b.solar &&
        b.battery &&
        `M${b.solar.x},${b.solar.y + b.solar.r} L${b.battery.x},${b.battery.y - b.battery.r}`
      );
    case "grid-home":
      return (
        b.grid &&
        b.home &&
        `M${b.grid.x + b.grid.r},${b.grid.y} L${b.home.x - b.home.r},${b.home.y}`
      );
  }
};

const sameGeometry = (a: Geometry | undefined, b: Geometry) => {
  if (!a) return false;
  const close = (p: number, q: number) => Math.abs(p - q) < 0.5;
  if (!close(a.width, b.width) || !close(a.height, b.height)) return false;
  const keys = new Set([...Object.keys(a.bubbles), ...Object.keys(b.bubbles)]) as Set<BubbleKey>;
  for (const k of keys) {
    const p = a.bubbles[k];
    const q = b.bubbles[k];
    if (!p || !q || !close(p.x, q.x) || !close(p.y, q.y) || !close(p.r, q.r)) return false;
  }
  return true;
};

export class PfcpFlowLines extends LitElement {
  @property({ attribute: false }) public lines: FlowLine[] = [];

  /** Bubbles with an active alert, mapped to the badge colour. */
  @property({ attribute: false }) public badges: Partial<Record<BubbleKey, string>> = {};

  @state() private _geometry?: Geometry;

  private _resizeObserver?: ResizeObserver;

  public connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined" && this.parentElement) {
      this._resizeObserver = new ResizeObserver(() => this._measure());
      this._resizeObserver.observe(this.parentElement);
    }
  }

  public disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    // The card re-renders (and may change bubble sizes) whenever `lines` is reassigned.
    if (changed.has("lines") || changed.has("badges")) this._measure();
  }

  /** Bubble centres and radii in this element's own (untransformed) pixel space. */
  private _measure(): void {
    const parent = this.parentElement;
    if (!parent) return;
    const base = parent.getBoundingClientRect();
    if (!base.width || !parent.offsetWidth) return;
    // Undo any CSS transform/zoom on the card so SVG units stay 1:1 with layout pixels.
    const scale = base.width / parent.offsetWidth;
    const bubbles: Geometry["bubbles"] = {};
    parent.querySelectorAll<HTMLElement>("[data-pfcp-bubble]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      bubbles[el.dataset.pfcpBubble as BubbleKey] = {
        x: (r.left - base.left + r.width / 2) / scale,
        y: (r.top - base.top + r.height / 2) / scale,
        r: r.width / 2 / scale,
      };
    });
    const geometry = { width: parent.offsetWidth, height: parent.offsetHeight, bubbles };
    if (!sameGeometry(this._geometry, geometry)) this._geometry = geometry;
  }

  protected render() {
    const g = this._geometry;
    if (!g) return nothing;
    return html`<svg viewBox="0 0 ${g.width} ${g.height}" xmlns="http://www.w3.org/2000/svg">
      ${this.lines.map((line) => {
        const d = linePath(line.key, g.bubbles);
        if (!d) return nothing;
        const id = `pfcp-flow-${line.key}`;
        return svg`<path
            id="${id}"
            class="line ${line.zeroStyle}"
            style="stroke: ${line.color}"
            d="${d}"
          ></path>
          ${line.dots.map(
            (dot) => svg`<circle class="dot" r="2.5" style="fill: ${dot.color}">
                <animateMotion
                  dur="${dot.dur}s"
                  repeatCount="indefinite"
                  calcMode="linear"
                  keyPoints="${dot.reverse ? "1;0" : "0;1"}"
                  keyTimes="0;1"
                >
                  <mpath href="#${id}"></mpath>
                </animateMotion>
              </circle>`
          )}`;
      })}
      ${(Object.entries(this.badges) as [BubbleKey, string][]).map(([key, color]) => {
        const b = g.bubbles[key];
        if (!b) return nothing;
        // On the border at the top-right (45 degrees), straddling it like a notification badge.
        const cx = b.x + b.r * Math.SQRT1_2;
        const cy = b.y - b.r * Math.SQRT1_2;
        const r = b.r * 0.2;
        return svg`<g class="badge">
            <circle cx="${cx}" cy="${cy}" r="${r}" style="fill: ${color}"></circle>
            <text x="${cx}" y="${cy}" font-size="${r * 1.5}">!</text>
          </g>`;
      })}
    </svg>`;
  }

  static styles = css`
    :host {
      /* Above the bubbles so badges aren't hidden under a ring; lines only meet the borders. */
      z-index: 3;
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .line {
      fill: none;
      stroke-width: 1;
    }
    .line.transparency {
      opacity: calc(calc(100 - var(--transparency, 0)) / 100);
    }
    .badge circle {
      stroke: var(--card-background-color, #fff);
      stroke-width: 1.5;
    }
    .badge text {
      fill: #fff;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: central;
      font-family: inherit;
    }
    .line.grey {
      stroke: var(--greyed-out--line-color, #bdbdbd) !important;
    }
  `;
}

if (!customElements.get("pfcp-flow-lines")) {
  customElements.define("pfcp-flow-lines", PfcpFlowLines);
}
