import { type BubbleKey } from "@flixlix-cards/shared/components/pfcp/flow-lines";
import { type BaseConfigEntity } from "@flixlix-cards/shared/types";
import { type HomeAssistant } from "custom-card-helpers";
import { html } from "lit";

export type BubbleAlertConfig = NonNullable<BaseConfigEntity["alert"]>;
export type ActiveAlert = { text?: string; color: string };

/** States that mean "no alert" for the watched entity (compared lower-case, trimmed). */
const INACTIVE = new Set(["", "off", "false", "0", "none", "unknown", "unavailable"]);
/** States that mean "alert" but carry no wording of their own. */
const BARE = new Set(["on", "true"]);

const DEFAULT_COLOR = "var(--error-color, #db4437)";

/** A user-supplied CSS colour, or undefined if absent or not a single plain value. */
const safeColor = (color?: string) => (color && !/[;{}<>]/.test(color) ? color.trim() : undefined);

/**
 * Whether a bubble's `alert` is active. The decision lives in HA (a template sensor, helper or
 * binary_sensor): the card only reads the entity's state. Any state other than off/empty/unknown
 * is an alert; a text state such as "plug in" doubles as the message unless `message` is set.
 */
export const bubbleAlert = (
  hass: HomeAssistant,
  alert?: BubbleAlertConfig
): ActiveAlert | undefined => {
  if (!alert?.entity) return undefined;
  const raw = hass.states[alert.entity]?.state;
  if (raw === undefined) return undefined;
  const state = String(raw).trim();
  if (INACTIVE.has(state.toLowerCase())) return undefined;
  const text = alert.message ?? (BARE.has(state.toLowerCase()) ? undefined : state);
  return { text: text || undefined, color: safeColor(alert.color) ?? DEFAULT_COLOR };
};

/** The bubble's label, with " (message)" appended in the alert colour while an alert is active. */
export const bubbleLabel = (
  hass: HomeAssistant,
  alert: BubbleAlertConfig | undefined,
  name: string | undefined
) => {
  const active = bubbleAlert(hass, alert);
  if (!active?.text) return html`<span class="label">${name}</span>`;
  return html`<span class="label pfcp-label-alert"
    >${name}<span class="pfcp-alert-text" style="color: ${active.color}">
      (${active.text})</span
    ></span
  >`;
};

/** Badge colours for the bubbles whose alert is active, keyed like `data-pfcp-bubble`. */
export const alertBadges = (
  hass: HomeAssistant,
  fields: Partial<Record<BubbleKey, { alert?: BubbleAlertConfig } | undefined>>
): Partial<Record<BubbleKey, string>> => {
  const badges: Partial<Record<BubbleKey, string>> = {};
  for (const [key, field] of Object.entries(fields) as [BubbleKey, (typeof fields)[BubbleKey]][]) {
    const active = bubbleAlert(hass, field?.alert);
    if (active) badges[key] = active.color;
  }
  return badges;
};
