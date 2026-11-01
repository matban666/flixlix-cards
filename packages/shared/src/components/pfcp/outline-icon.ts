import { css, html, LitElement, svg } from "lit";
import { property } from "lit/decorators.js";

/**
 * An `icon_path` drawn as an outline (`icon_stroke`). HA's ha-svg-icon can only fill, and an
 * inline SVG in the card would be restyled by the card's broad `path {}` / `.circle svg {}`
 * rules, so the stroke lives in this element's own shadow DOM. Colour is `currentColor`, so the
 * per-bubble icon colour rules and `icon_color` still apply to the host.
 */
export class PfcpOutlineIcon extends LitElement {
  @property({ attribute: false }) public path = "";

  @property({ attribute: false }) public viewBox = "0 0 24 24";

  @property({ attribute: false }) public strokeWidth = 1.5;

  protected render() {
    return html`<svg viewBox=${this.viewBox} xmlns="http://www.w3.org/2000/svg">
      ${svg`<path d="${this.path}" stroke-width="${this.strokeWidth}"></path>`}
    </svg>`;
  }

  static styles = css`
    :host {
      display: inline-block;
      height: var(--mdc-icon-size, 24px);
      width: var(--mdc-icon-size, 24px);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    path {
      fill: none;
      stroke: currentColor;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
  `;
}

if (!customElements.get("pfcp-outline-icon")) {
  customElements.define("pfcp-outline-icon", PfcpOutlineIcon);
}
