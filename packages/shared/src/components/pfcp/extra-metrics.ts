import { type ExtraMetricConfig } from "@flixlix-cards/shared/types";
import { isNumberValue, round } from "@flixlix-cards/shared/utils/utils";
import { formatNumber, type HomeAssistant } from "custom-card-helpers";
import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

/**
 * Small extra readings (icon, value, unit) for otherwise-empty card space: stacked in a free
 * corner or in a single row along the bottom. Own shadow DOM, like the other pfcp elements.
 */

export type ExtraMetric = { entity: string; icon: string; value: string; unit: string };

const OFFLINE = new Set(["unknown", "unavailable", ""]);

const DEVICE_CLASS_ICON: Record<string, string> = {
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
  pressure: "mdi:gauge",
  illuminance: "mdi:brightness-5",
  wind_speed: "mdi:weather-windy",
  precipitation: "mdi:weather-rainy",
  carbon_dioxide: "mdi:molecule-co2",
  battery: "mdi:battery",
  power: "mdi:flash",
  energy: "mdi:lightning-bolt",
};

/** Resolve configured metrics against hass: value, unit and icon, with sensible fallbacks. */
export const extraMetricsData = (
  hass: HomeAssistant,
  items: ExtraMetricConfig[] | undefined
): ExtraMetric[] =>
  (items ?? [])
    .filter((item) => typeof item?.entity === "string")
    .map((item) => {
      const stateObj = hass.states[item.entity];
      const raw = stateObj?.state ?? "";
      const attrs = stateObj?.attributes ?? {};
      let value = "–";
      if (!OFFLINE.has(raw)) {
        value = isNumberValue(raw)
          ? formatNumber(
              item.decimals === undefined ? Number(raw) : round(Number(raw), item.decimals),
              hass.locale
            )
          : raw;
      }
      return {
        entity: item.entity,
        icon:
          item.icon ??
          attrs.icon ??
          DEVICE_CLASS_ICON[attrs.device_class as string] ??
          "mdi:information-outline",
        value,
        unit: OFFLINE.has(raw) ? "" : (item.unit ?? attrs.unit_of_measurement ?? ""),
      };
    });

export class PfcpExtraMetrics extends LitElement {
  @property({ attribute: false }) public items: ExtraMetric[] = [];

  /** "stack": vertical list for a corner slot; "row": one line along the bottom. */
  @property({ reflect: true }) public layout: "stack" | "row" = "stack";

  private _open(entityId: string) {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true })
    );
  }

  protected render() {
    if (!this.items.length) return nothing;
    return html`${this.items.map(
      (m) =>
        html`<button class="metric" title=${m.entity} @click=${() => this._open(m.entity)}>
          <ha-icon .icon=${m.icon}></ha-icon>
          <span class="value">${m.value}</span>${m.unit
            ? html`<span class="unit">${m.unit}</span>`
            : nothing}
        </button>`
    )}`;
  }

  static styles = css`
    :host {
      display: flex;
      gap: 6px;
      color: var(--primary-text-color);
      font-size: 13px;
      line-height: 1;
      --mdc-icon-size: 16px;
    }
    :host([layout="stack"]) {
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
    }
    :host([layout="row"]) {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      column-gap: 16px;
      row-gap: 6px;
    }
    .metric {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    .metric:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
      border-radius: 4px;
    }
    ha-icon {
      color: var(--secondary-text-color);
    }
    .unit {
      color: var(--secondary-text-color);
      font-size: 0.85em;
      margin-left: 1px;
    }
  `;
}

if (!customElements.get("pfcp-extra-metrics")) {
  customElements.define("pfcp-extra-metrics", PfcpExtraMetrics);
}
