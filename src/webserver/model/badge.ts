import type { CardConfig } from "../contracts/types";
import { configOptionEnabled, configOptionValue, preserveCardColorOptions, setConfigOptionValue } from "./config_primitives";
import { badgeCardType } from "./badge_card";

export const BADGE_ACTIONS = ["display", "subpage", "modal", "toggle", "button", "slider", "card"] as const;
export type BadgeAction = typeof BADGE_ACTIONS[number];

export const BADGE_SUBTYPES = [
  { key: "sensor", label: "Sensor", icon: "thermometer", defaultIcon: "Thermometer", description: "Show an entity's live reading." },
  { key: "subpage", label: "Subpage", icon: "view-grid-plus", defaultIcon: "Home", description: "Open another page." },
  { key: "switch", label: "Switch", icon: "toggle-switch", defaultIcon: "Lightbulb", description: "Toggle a light, switch or fan." },
  { key: "button", label: "Button", icon: "gesture-tap", defaultIcon: "Gesture Tap", description: "Press a Home Assistant button." },
  { key: "slider", label: "Slider", icon: "volume-high", defaultIcon: "Volume High", description: "Adjust brightness, volume or a number." },
  { key: "modal", label: "Modal", icon: "card-outline", defaultIcon: "Home", description: "Open an existing control modal." },
] as const;
export type BadgeSubtype = typeof BADGE_SUBTYPES[number]["key"] | "card";

export function badgeSubtype(button: Partial<CardConfig>): BadgeSubtype {
  const action = badgeAction(button);
  if (action === "display") return "sensor";
  return action === "toggle" ? "switch" : action;
}

export function setBadgeSubtype(button: CardConfig, subtype: BadgeSubtype): void {
  const action = subtype === "switch" ? "toggle" : subtype === "sensor" ? "display" : subtype;
  button.options = setConfigOptionValue(button.options, "badge_action", action === "display" ? "" : action);
  if (subtype === "sensor" || subtype === "slider") button.precision = "value";
  else if (subtype === "button") button.precision = "label";
  normalizeBadgeConfig(button);
}

export function badgeAction(button: Partial<CardConfig>): BadgeAction {
  const value = configOptionValue(button.options || "", "badge_action");
  return BADGE_ACTIONS.includes(value as BadgeAction) ? value as BadgeAction : "display";
}

export function normalizeBadgeConfig(button: CardConfig): void {
  const cardType = badgeCardType(button);
  if (cardType !== null) {
    button.type = "badge";
    button.options = setConfigOptionValue(button.options, "badge_action", cardType === "subpage" ? "subpage" : "card");
    const page = configOptionValue(button.options, "badge_page");
    if (cardType !== "subpage" || !/^[1-9]\d?$/.test(page) || Number(page) > 32) {
      button.options = setConfigOptionValue(button.options, "badge_page", "");
    }
    return;
  }
  const source = button.options || "";
  const action = badgeAction(button);
  let options = action === "display" ? "" : setConfigOptionValue("", "badge_action", action);
  if (action === "subpage") {
    const page = configOptionValue(source, "badge_page");
    if (/^[1-9]\d?$/.test(page) && Number(page) <= 32) options = setConfigOptionValue(options, "badge_page", page);
  }
  for (const key of action === "slider" ? [] : ["badge_attribute", "badge_decimals"]) {
    const value = configOptionValue(source, key).trim();
    if (key === "badge_attribute" ? !!value : value === "0" || value === "2") {
      options = setConfigOptionValue(options, key, value);
    }
  }
  if (action !== "button" && configOptionEnabled(source, "active_color")) options += (options ? "," : "") + "active_color";
  button.options = preserveCardColorOptions(source, options);
  button.precision = button.precision === "value" ? "value" : "label";
  if (action === "slider") {
    button.sensor = "";
    button.unit = "";
  }
  button.icon_on = "Auto";
}
