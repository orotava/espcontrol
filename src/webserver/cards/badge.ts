import type { CardRegistry, CardUiServices } from "../application/card_registry";
import { state } from "../state/app_instance";
import { cardContractDefaultConfig } from "../generated/card_contract";
import { configOptionEnabled, configOptionValue, setConfigOptionValue } from "../model/config_primitives";
import { badgeAction, normalizeBadgeConfig } from "../model/badge";
import { iconSlug } from "../application/ui_primitives";

export function registerBadgeCardTypes(registry: CardRegistry, cardUi: CardUiServices): void {
  registry.register("badge", {
    label: "Badge",
    isAvailable: () => false,
    allowInSubpage: true,
    hideLabel: true,
    cardMetadata: { preview: { badge: "label" } },
    defaultConfig: () => cardContractDefaultConfig("badge"),
    normalizeConfig: normalizeBadgeConfig,
    onSelect(button) {
      Object.assign(button, cardContractDefaultConfig("badge"));
    },
    renderSettings(panel, button, _slot, helpers) {
      const rerender = () => helpers.renderBadgeSettings ? helpers.renderBadgeSettings() : cardUi.renderButtonSettings();
      const settings = helpers.disclosureSection("Badge Settings", helpers.idPrefix + "badge-settings", true);
      panel.appendChild(settings.panel);
      panel = settings.section;
      const action = badgeAction(button);
      function select(label: string, suffix: string, value: string, choices: Array<[string, string]>, save: (value: string) => void) {
        const field = document.createElement("div");
        field.className = "sp-field";
        const id = helpers.idPrefix + suffix;
        field.appendChild(helpers.fieldLabel(label, id));
        const input = document.createElement("select");
        input.className = "sp-select";
        input.id = id;
        for (const [key, text] of choices) {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = text;
          input.appendChild(option);
        }
        input.value = value;
        input.addEventListener("change", () => save(input.value));
        field.appendChild(input);
        panel.appendChild(field);
        return input;
      }
      function option(key: string, value: string, rerender = false) {
        button.options = setConfigOptionValue(button.options, key, value);
        helpers.saveField("options", button.options);
        if (rerender) helpers.renderBadgeSettings ? helpers.renderBadgeSettings() : cardUi.renderButtonSettings();
      }
      function text(label: string, field: string, placeholder: string, domains?: string[], required = false) {
        const wrapper = document.createElement("div");
        wrapper.className = "sp-field";
        const id = helpers.idPrefix + field;
        wrapper.appendChild(helpers.fieldLabel(label, id));
        const input = domains ? helpers.entityInput(id, button[field], placeholder, domains) : helpers.textInput(id, button[field], placeholder);
        wrapper.appendChild(input);
        panel.appendChild(wrapper);
        helpers.bindField(input, field, true);
        if (domains) helpers.markCardPrimaryField(wrapper, field);
        if (required) helpers.requireField(input, "Choose an entity before saving.");
        return input;
      }
      helpers.renderCardIconPicker(panel, button, helpers, { field: "icon", fallback: "Auto", label: "Icon" });
      select("Display", "badge-display", button.precision || "label", [["label", "Label"], ["value", "Live value"]], value => {
        button.precision = value;
        helpers.saveField("precision", value);
        rerender();
      });
      if (button.precision !== "value") text("Label", "label", "e.g. Kitchen");
      select("Interaction", "badge-action", action, [["display", "Display only"], ["subpage", "Open subpage"], ["modal", "Open control modal"], ["toggle", "Toggle"], ["slider", "Slider"]], value => option("badge_action", value, true));
      if (action === "subpage") {
        const pages: Array<[string, string]> = [["", "Choose a subpage…"]];
        state.buttons.forEach((entry, index) => {
          if (entry.type === "subpage") pages.push([String(index + 1), entry.label || "Subpage " + (index + 1)]);
        });
        const current = configOptionValue(button.options, "badge_page");
        if (current && !pages.some(([key]) => key === current)) pages.push([current, "Missing subpage (slot " + current + ")"]);
        const picker = select("Subpage", "badge-page", current, pages, value => option("badge_page", value));
        helpers.requireField(picker, "Choose a subpage before saving.");
      } else if (action !== "display") {
        const domains = action === "slider" ? ["light", "fan", "number", "input_number", "media_player"]
          : action === "toggle" ? ["light", "switch", "input_boolean", "fan"] : [];
        const input = text("Control Entity", "entity", action === "slider" ? "e.g. light.kitchen" : "e.g. light.living_room", domains, true);
        if (domains.length) helpers.requireEntityDomain(input, domains, "Choose a supported entity for this interaction.");
        if (action === "modal") {
          const note = document.createElement("p");
          note.className = "sp-hint";
          note.textContent = "Opens the existing control modal for a card configured on this panel, including cards inside subpages.";
          panel.appendChild(note);
        }
      }
      if (button.precision === "value" || configOptionEnabled(button.options, "active_color")) {
        text("Display Entity", "sensor", action === "slider" ? "Optional: defaults to the slider value" : "e.g. sensor.kitchen_temperature", [], button.precision === "value" && action !== "slider");
      }
      if (button.precision === "value") {
        text("Unit (optional)", "unit", "Auto, e.g. °C");
        const field = document.createElement("div");
        field.className = "sp-field";
        field.appendChild(helpers.fieldLabel("Attribute (optional)", helpers.idPrefix + "badge-attribute"));
        const input = helpers.textInput(helpers.idPrefix + "badge-attribute", configOptionValue(button.options, "badge_attribute"), "Entity state, e.g. current_temperature");
        input.addEventListener("change", () => option("badge_attribute", input.value));
        field.appendChild(input);
        panel.appendChild(field);
        select("Decimal Places", "badge-decimals", configOptionValue(button.options, "badge_decimals") || "1", [["0", "0"], ["1", "1"], ["2", "2"]], value => option("badge_decimals", value));
      }
      const tint = helpers.toggleRow("Lit When Active", helpers.idPrefix + "badge-active", configOptionEnabled(button.options, "active_color"));
      tint.input.addEventListener("change", () => option("active_color", tint.input.checked ? "1" : "", true));
      panel.appendChild(tint.row);
    },
    renderPreview(button, helpers) {
      const action = badgeAction(button);
      const value = button.precision === "value";
      const decimals = configOptionValue(button.options, "badge_decimals") || "1";
      const reading = (21.4).toFixed(Number(decimals));
      const sample = action === "slider" && !button.sensor ? "35%" : reading + (button.unit || "°C");
      const label = value ? sample : button.label || "Badge";
      const icon = iconSlug(button.icon && button.icon !== "Auto" ? button.icon : action === "slider" ? "Volume High" : "Home");
      return {
        buttonClass: "sp-badge-card" + (action === "slider" ? " sp-badge-slider" : ""),
        iconHtml: (action === "slider" ? '<span class="sp-badge-fill"></span>' : "") +
          '<span class="sp-badge-content"><span class="mdi mdi-' + icon + '"></span><span class="sp-badge-text">' + helpers.escHtml(label) + '</span></span>',
        labelHtml: "",
      };
    },
  });
}
