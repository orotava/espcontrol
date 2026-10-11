import type { CardConfig } from "../contracts/types";
import { configOptionEnabled, configOptionValue, preserveCardColorOptions, setConfigOptionValue } from "./config_primitives";

export const BADGE_ACTIONS = ["display", "subpage", "modal", "toggle", "slider"] as const;
export type BadgeAction = typeof BADGE_ACTIONS[number];

export function badgeAction(button: Partial<CardConfig>): BadgeAction {
  const value = configOptionValue(button.options || "", "badge_action");
  return BADGE_ACTIONS.includes(value as BadgeAction) ? value as BadgeAction : "display";
}

export function normalizeBadgeConfig(button: CardConfig): void {
  const source = button.options || "";
  const action = badgeAction(button);
  let options = action === "display" ? "" : setConfigOptionValue("", "badge_action", action);
  if (action === "subpage") {
    const page = configOptionValue(source, "badge_page");
    if (/^[1-9]\d?$/.test(page) && Number(page) <= 25) options = setConfigOptionValue(options, "badge_page", page);
  }
  for (const key of ["badge_attribute", "badge_decimals"]) {
    const value = configOptionValue(source, key).trim();
    if (key === "badge_attribute" ? !!value : value === "0" || value === "2") {
      options = setConfigOptionValue(options, key, value);
    }
  }
  if (configOptionEnabled(source, "active_color")) options += (options ? "," : "") + "active_color";
  button.options = preserveCardColorOptions(source, options);
  button.precision = button.precision === "value" ? "value" : "label";
  button.icon_on = "Auto";
}
