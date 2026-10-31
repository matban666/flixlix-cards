import { getFirstEntityName } from "@flixlix-cards/shared/states/utils/mutli-entity";
import {
  type BaseConfigEntity,
  type CardMainContext,
  offlineStr,
} from "@flixlix-cards/shared/types";
import { isNumberValue, round } from "@flixlix-cards/shared/utils/utils";
import { formatNumber } from "custom-card-helpers";
import { html, nothing, type TemplateResult } from "lit";

type BubbleIconOptions = {
  main: CardMainContext;
  /** Element id used by the existing per-bubble icon styles, e.g. "solar-icon". */
  id: string;
  /** Resolved HA icon name; " " means the user hid the icon. */
  icon: string;
  fieldConfig?: Pick<BaseConfigEntity, "icon_path" | "tertiary_info">;
  /** Rendered tertiary_info.template result, if a template is configured. */
  tertiaryTemplate?: string;
  /** When false, icon_path is ignored so a state-driven icon (e.g. grid outage) still shows. */
  allowIconPath?: boolean;
};

const tertiaryValue = (
  main: CardMainContext,
  tertiary: NonNullable<BaseConfigEntity["tertiary_info"]>
): string | undefined => {
  if (typeof tertiary.entity !== "string") return undefined;
  const stateObj = main.hass.states[getFirstEntityName(tertiary.entity)];
  if (!stateObj || offlineStr.includes(stateObj.state)) return undefined;

  const state = stateObj.state;
  if (!isNumberValue(state)) return state;

  const num = Number(state);
  const toleranceSet = tertiary.display_zero_tolerance ?? 0;
  const belowTolerance = tertiary.accept_negative ? false : Math.abs(num) < toleranceSet;
  if (tertiary.display_zero !== true && (num === 0 || belowTolerance)) return undefined;

  const shown = tertiary.accept_negative ? num : Math.abs(num);
  const formatted = formatNumber(
    tertiary.decimals === undefined ? shown : round(shown, tertiary.decimals),
    main.hass.locale
  );
  const unit = tertiary.unit_of_measurement ?? stateObj.attributes.unit_of_measurement;
  if (!unit) return formatted;
  return `${formatted}${tertiary.unit_white_space === false ? "" : " "}${unit}`;
};

const tertiarySpan = (
  main: CardMainContext,
  fieldConfig: BubbleIconOptions["fieldConfig"],
  template?: string
) => {
  const tertiary = fieldConfig?.tertiary_info;
  if (!tertiary) return nothing;
  const value = template || tertiaryValue(main, tertiary);
  if (!value) return nothing;

  const entityId = typeof tertiary.entity === "string" ? tertiary.entity : undefined;
  const actions = {
    tap_action: tertiary.tap_action,
    hold_action: tertiary.hold_action,
    double_tap_action: tertiary.double_tap_action,
  };
  // Stop propagation so tapping the metric opens its own entity, not the bubble's.
  return html`<span
    class="tertiary-info"
    @click=${(e: MouseEvent) => {
      e.stopPropagation();
      main.onEntityClick(e, actions, entityId);
    }}
    @dblclick=${(e: MouseEvent) => {
      e.stopPropagation();
      main.onEntityDoubleClick(e, actions, entityId);
    }}
    @pointerdown=${(e: PointerEvent) => {
      e.stopPropagation();
      main.onEntityPointerDown(e, actions, entityId);
    }}
    @pointerup=${(e: PointerEvent) => {
      e.stopPropagation();
      main.onEntityPointerUp(e);
    }}
    @pointercancel=${(e: PointerEvent) => {
      e.stopPropagation();
      main.onEntityPointerUp(e);
    }}
    >${tertiary.icon
      ? html`<ha-icon class="small" .icon=${tertiary.icon}></ha-icon>`
      : nothing}${value}</span
  >`;
};

/**
 * Renders a bubble's icon: an SVG path (`icon_path`) when configured, otherwise the HA icon,
 * with an optional `tertiary_info` metric centred over it. With neither option set the
 * output is the same bare `<ha-icon>` the card has always rendered.
 */
export const bubbleIcon = ({
  main,
  id,
  icon,
  fieldConfig,
  tertiaryTemplate,
  allowIconPath = true,
}: BubbleIconOptions): TemplateResult | typeof nothing => {
  const iconPath = allowIconPath ? fieldConfig?.icon_path : undefined;
  const iconEl = iconPath
    ? html`<ha-svg-icon id=${id} class="bubble-icon" .path=${iconPath}></ha-svg-icon>`
    : icon !== " "
      ? html`<ha-icon id=${id} .icon=${icon}></ha-icon>`
      : nothing;
  const tertiary = tertiarySpan(main, fieldConfig, tertiaryTemplate);

  if (tertiary === nothing) return iconEl;
  return html`<div class="icon-container">${iconEl}${tertiary}</div>`;
};

export type TertiaryBubble = "grid" | "solar" | "battery" | "home" | "nonFossilFuel";

/** Key for a bubble's tertiary_info template result in TemplatesObj.tertiary and the card's subscriptions. */
export const tertiaryTemplateKey = (bubble: TertiaryBubble | { individual: string }): string =>
  typeof bubble === "string" ? `${bubble}Tertiary` : `individual:${bubble.individual}:Tertiary`;
