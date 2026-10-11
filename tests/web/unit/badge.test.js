"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypescriptTest } = require("./helpers/load_typescript_test");
const { badgeAction, normalizeBadgeConfig } = loadTypescriptTest("src/webserver/model/badge.ts");
const { configOptionValue } = loadTypescriptTest("src/webserver/model/config_primitives.ts");

function badge(options) {
  return { entity: "climate.kitchen", sensor: "sensor.kitchen", label: "Kitchen", icon: "Home", icon_on: "Auto", type: "badge", precision: "value", unit: "°C", options };
}

test("badge retains independent display and action targets and a stable page link", () => {
  const button = badge("badge_action=subpage,badge_page=6,card_off_color=112233");
  normalizeBadgeConfig(button);
  assert.equal(button.sensor, "sensor.kitchen");
  assert.equal(button.entity, "climate.kitchen");
  button.label = "Renamed room";
  normalizeBadgeConfig(button);
  assert.equal(configOptionValue(button.options, "badge_page"), "6");
  assert.equal(configOptionValue(button.options, "card_off_color"), "112233");
});

test("badge drops invalid destinations and falls back to display for unknown actions", () => {
  for (const page of ["0", "26", "-1", "6oops", "6.1"]) {
    const button = badge("badge_action=subpage,badge_page=" + page);
    normalizeBadgeConfig(button);
    assert.equal(configOptionValue(button.options, "badge_page"), "");
  }
  const button = badge("badge_action=erase,badge_page=6,unknown=anything");
  normalizeBadgeConfig(button);
  assert.equal(badgeAction(button), "display");
  assert.equal(button.options, "");
});

test("changing away from navigation removes the old destination while preserving value formatting", () => {
  const button = badge("badge_action=slider,badge_page=6,badge_attribute=current_temperature,badge_decimals=2,active_color");
  normalizeBadgeConfig(button);
  assert.equal(configOptionValue(button.options, "badge_page"), "");
  assert.equal(configOptionValue(button.options, "badge_attribute"), "current_temperature");
  assert.equal(configOptionValue(button.options, "badge_decimals"), "2");
  assert.equal(badgeAction(button), "slider");
});
