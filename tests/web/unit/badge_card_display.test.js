"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const cases = require("../../fixtures/badge_card_display.json");
const { loadTypescriptTest: load } = require("./helpers/load_typescript_test");
const { badgeCardContent, badgeCardDisplay } = load("src/webserver/model/badge_card_display.ts");
const { cardContractCardKeys } = load("src/webserver/generated/card_contract.ts");
const { badgeToCard, updateBadgeFromCard } = load("src/webserver/model/badge_card.ts");
const { serializeBadgeRow, parseBadgeRow } = load("src/webserver/model/badge_row.ts");
test("compact display acceptance cases cover every card type and resolve its intended content", () => {
  const covered = new Set(cases.map(item => item.type));
  for (const type of cardContractCardKeys().filter(type => type !== "badge")) assert(covered.has(type), "Missing badge display acceptance case: " + type);
  for (const item of cases) assert.equal(badgeCardContent({ type: item.type, sensor: item.mode, precision: item.precision }, item.display), item.content, item.name);
});
test("badge display choices survive save and mode changes independently of native settings", () => {
  const card = { entity: "media_player.office", sensor: "position", label: "Sonos", icon: "Volume High", icon_on: "Auto", type: "media", precision: "state", unit: "", options: "media_tabs=controls|volume,label_display=status" };
  const badge = { ...card, type: "badge", options: "badge_card_type=media,badge_display=label" };
  updateBadgeFromCard(badge, card);
  const restored = parseBadgeRow(serializeBadgeRow([badge]))[0];
  assert.equal(badgeCardDisplay(restored), "label");
  assert.deepEqual(badgeToCard(restored), card);
  const changed = { ...card, sensor: "volume", precision: "" };
  updateBadgeFromCard(restored, changed);
  assert.equal(badgeCardDisplay(restored), "label");
  assert.deepEqual(badgeToCard(restored), changed);
  assert.equal(badgeCardDisplay({ options: "badge_display=invalid" }), "card");
});
