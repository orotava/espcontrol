"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypescriptTest } = require("./helpers/load_typescript_test");
const { badgeAction, normalizeBadgeConfig } = loadTypescriptTest("src/webserver/model/badge.ts");
const { configOptionValue } = loadTypescriptTest("src/webserver/model/config_primitives.ts");
const { serializeBadgeRow, parseBadgeRow, badgeRowSettings, badgeRowsFromSettings } = loadTypescriptTest("src/webserver/model/badge_row.ts");
const { encodePanelConfig, decodePanelConfig } = loadTypescriptTest("src/webserver/model/panel_config.ts");
const { NativePanelConfigController } = loadTypescriptTest("src/webserver/controllers/native_panel_config_controller.ts");

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

test("badge rows round-trip Unicode and delimiters independently of card slots", () => {
  const source = badge("badge_action=subpage,badge_page=6,badge_attribute=current_temperature");
  source.label = "Kitchen | 21°C, 50% : now";
  source.unit = "°C";
  const rows = { 0: [source], 6: [badge("badge_action=toggle")] };
  const document = { deviceProfile: "panel", buttons: { 1: "light.kitchen;Kitchen" }, subpages: { 6: "B" }, settings: { button_order: "1,6", ...badgeRowSettings(rows) } };
  const decoded = decodePanelConfig(encodePanelConfig(document));
  assert.deepEqual(decoded.buttons, document.buttons);
  assert.equal(decoded.settings.button_order, "1,6");
  const restored = badgeRowsFromSettings(decoded.settings);
  assert.equal(restored[0][0].label, source.label);
  assert.equal(restored[0][0].sensor, source.sensor);
  assert.equal(restored[6][0].entity, source.entity);
  assert.equal(parseBadgeRow(serializeBadgeRow([])).length, 0);
});

test("badge row limits prevent oversized saved rows and reject non-badge entries", () => {
  assert.equal(parseBadgeRow("~|S,sensor.temperature,Temperature").length, 0);
  assert.throws(() => serializeBadgeRow(Array(9).fill(badge(""))), /eight badges/);
  const large = badge(""); large.label = "温".repeat(1000);
  assert.throws(() => serializeBadgeRow([large]), /too large/);
});

test("deleting or replacing a subpage clears its row in the same save while renaming preserves it", async () => {
  let document = { deviceProfile: "panel", buttons: { 1: ";Room;Home;Auto;;;subpage" }, subpages: {}, settings: { button_order: "1", badge_row_0: serializeBadgeRow([badge("")]), badge_row_1: serializeBadgeRow([badge("")]) } };
  const cleared = [];
  const controller = new NativePanelConfigController({
    fetch: async (path, request) => {
      if (request?.method === "PUT") document = decodePanelConfig(request.body);
      return { ok: true, status: 200, headers: { get: () => '"1"' },
        json: async () => ({ configuration: { read: true, write: true, document_versions: [1], badge_rows: true } }),
        arrayBuffer: async () => encodePanelConfig(document).buffer };
    },
    deviceProfile: () => "panel", slotCount: () => 2,
    entityName: key => key, entityNameForSlot: (key, slot) => key + "_" + slot,
    normalizeHexColor: value => value, showBanner() {}, delay: callback => callback(),
    onBadgeRowRemoved: slot => cleared.push(slot),
  });
  assert.equal(await controller.writeText("button_config_1", ";New name;Home;Auto;;;subpage"), "saved");
  assert(document.settings.badge_row_1);
  assert.equal(cleared.length, 0);
  assert.equal(await controller.writeButtonAndOrder(1, "light.kitchen;Kitchen", "1,2"), "saved");
  assert(!document.settings.badge_row_1);
  assert(document.settings.badge_row_0);
  assert.equal(document.settings.button_order, "1,2");
  assert.deepEqual(cleared, [1]);
});
