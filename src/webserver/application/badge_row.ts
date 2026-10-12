import { state } from "../state/app_instance";
import type { CardConfig } from "../contracts/types";
import { cardContractDefaultConfig } from "../generated/card_contract";
import { cloneCardConfig } from "../model/card";
import { BADGE_SUBTYPES, badgeSubtype, setBadgeSubtype, type BadgeSubtype } from "../model/badge";
import { badgeRowKey, badgeRowsFromSettings, MAX_ROW_BADGES, serializeBadgeRow } from "../model/badge_row";
import { updateNativePanelConfigDocument } from "../features/native_panel_config";
import { PREVIEW_THEME_COLORS, previewEffectiveTheme } from "../state/preview_theme";
import { escHtml, mdiIcon } from "./ui_primitives";
import { createSettingsModal } from "../components/settings_modal";
import type { NativePanelConfigController } from "../controllers/native_panel_config_controller";
import type { CardRegistry } from "./card_registry";
import type { ControlsFieldsFeature } from "./controls_fields";
import type { ButtonSettingsIconPickerFeature } from "./button_settings_icon_picker";
import type { EntityStateFeature } from "./entity_state";
import type { ControlsShellFeature } from "./controls_shell";
import type { UiRuntimeState } from "./state";

export interface BadgeRowFeature {
  render(): void;
  renderSelectionControl(container: HTMLElement): void;
  load(): Promise<void>;
}

export function createBadgeRowFeature(deps: {
  document: Document; runtime: UiRuntimeState; cards: CardRegistry;
  native: NativePanelConfigController; deviceProfile: string;
  fields: ControlsFieldsFeature; iconPicker: ButtonSettingsIconPickerFeature;
  entities: Pick<EntityStateFeature, "entityInput">;
  shell: Pick<ControlsShellFeature, "isConfigLocked" | "showBanner" | "createActionButton">;
  renderPreview(): void;
}): BadgeRowFeature {
  const { document, fields, runtime, shell } = deps;
  const els = runtime.els;
  let row: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let modal: HTMLElement | null = null;
  let config: HTMLElement | null = null;
  let draft: { page: number; index: number; button: CardConfig } | null = null;
  let saving = false;
  let loadGeneration = 0;
  const pageIndex = () => state.editingSubpage || 0;
  const badges = (page = pageIndex()) => state.badgeRows[String(page)] || [];

  function button(label: string, action: () => void, className = "sp-action-btn", icon?: string, ariaLabel?: string): HTMLButtonElement {
    const element = shell.createActionButton(className, label, icon, ariaLabel) as HTMLButtonElement;
    element.type = "button";
    element.addEventListener("click", () => { if (!saving && !shell.isConfigLocked()) action(); });
    return element;
  }
  function close() { if (saving) return; draft = null; overlay?.classList.remove("sp-visible"); deps.renderPreview(); }

  function ensureUi() {
    if (row || !els.previewScreen) return;
    row = document.createElement("div");
    row.className = "sp-badge-row";
    row.setAttribute("aria-label", "Page badges");
    els.previewScreen.appendChild(row);
    const settings = createSettingsModal(document, close, "Close badge settings");
    overlay = settings.overlay;
    modal = settings.modal;
    config = settings.config;
    overlay.classList.add("sp-badge-settings-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Page badges");
    overlay.setAttribute("aria-modal", "true");
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    els.screenPage.appendChild(overlay);
  }

  function render() {
    ensureUi();
    if (!row) return;
    row.replaceChildren();
    const items = badges().map(cloneCardConfig);
    if (draft && draft.page === pageIndex()) items[draft.index] = draft.button;
    els.previewScreen.classList.toggle("sp-has-badge-row", items.length > 0);
    row.hidden = items.length === 0;
    const group = document.createElement("div");
    group.className = "sp-badge-row-items";
    row.appendChild(group);
    const colors = PREVIEW_THEME_COLORS[previewEffectiveTheme(state)];
    items.forEach((config, index) => {
      const preview = deps.cards.definitions.badge!.renderPreview!(config, { escHtml }) as { buttonClass: string; iconHtml: string };
      const item = button("", () => edit(index), "sp-btn " + preview.buttonClass);
      item.innerHTML = preview.iconHtml;
      item.style.backgroundColor = "#" + colors.surfaceCard;
      item.setAttribute("data-badge-index", String(index));
      item.setAttribute("aria-label", "Edit badge " + (config.label || index + 1));
      item.disabled = shell.isConfigLocked();
      group.appendChild(item);
    });
  }

  function renderSelectionControl(container: HTMLElement) {
    ensureUi();
    if (!state.badgeRowsSupported) return;
    const control = button("Badges", () => openList(), "sp-selection-btn", "view-grid-plus", "Manage badge bar");
    control.disabled = !state.badgeRowsReady || shell.isConfigLocked();
    container.appendChild(control);
  }

  function header(title: string) {
    config!.replaceChildren();
    modal!.classList.remove("sp-card-type-picker-open");
    const heading = document.createElement("div"); heading.className = "sp-section-title"; heading.textContent = title;
    config!.appendChild(heading);
    overlay!.classList.add("sp-visible");
  }

  function openList() {
    draft = null;
    header(pageIndex() ? "Subpage Badges" : "Home Badges");
    const panel = document.createElement("div"); panel.className = "sp-panel sp-badge-list";
    if (!badges().length) {
      const hint = document.createElement("p"); hint.className = "sp-hint"; hint.textContent = "Add an icon with a label or live value above the card grid."; panel.appendChild(hint);
    }
    badges().forEach((badge, index) => panel.appendChild(button(badge.label || badge.sensor || "Badge " + (index + 1), () => edit(index))));
    const add = button("Add badge", chooseType);
    add.disabled = badges().length >= MAX_ROW_BADGES;
    panel.appendChild(add);
    const actions = document.createElement("div"); actions.className = "sp-btn-row sp-btn-row--save";
    actions.appendChild(button("Done", close, "sp-action-btn sp-save-btn"));
    config!.append(panel, actions);
  }

  function chooseType() {
    header("Choose Badge Type");
    modal!.classList.add("sp-card-type-picker-open");
    const grid = document.createElement("div"); grid.className = "sp-card-type-grid";
    for (const type of BADGE_SUBTYPES) {
      const item = button("", () => edit(badges().length, type.key), "sp-card-type-option");
      item.setAttribute("data-badge-type", type.key);
      item.setAttribute("aria-label", type.label + " badge type");
      item.innerHTML = '<span class="sp-card-type-icon mdi mdi-' + type.icon + '"></span><span class="sp-card-type-copy"><span class="sp-card-type-title">' + escHtml(type.label) + '</span><span class="sp-card-type-description">' + escHtml(type.description) + '</span></span>';
      grid.appendChild(item);
    }
    config!.appendChild(grid);
    const actions = document.createElement("div"); actions.className = "sp-btn-row sp-btn-row--save";
    actions.appendChild(button("Cancel", close, "sp-action-btn sp-cancel-btn"));
    config!.appendChild(actions);
  }

  async function save(next: CardConfig[]) {
    if (!draft || saving || shell.isConfigLocked()) return;
    const page = draft.page;
    let value: string;
    try { value = serializeBadgeRow(next); }
    catch (error) { shell.showBanner((error as Error).message, "error"); return; }
    saving = true;
    modal!.setAttribute("aria-busy", "true");
    modal!.querySelectorAll("button,input,select").forEach(input => (input as HTMLInputElement).disabled = true);
    const result = await deps.native.schedule(current => updateNativePanelConfigDocument(current, deps.deviceProfile, "settings", badgeRowKey(page), value));
    saving = false;
    (modal!.querySelector(".sp-settings-close") as HTMLButtonElement).disabled = false;
    modal!.removeAttribute("aria-busy");
    if (result === "saved") {
      state.badgeRows[String(page)] = next;
      close();
    } else {
      shell.showBanner("Could not save badge rows. Check the connection and firmware, then try again.", "error");
      renderEditor();
    }
  }

  function edit(index: number, subtype?: BadgeSubtype) {
    if (index >= MAX_ROW_BADGES) return;
    config!.replaceChildren();
    draft = { page: pageIndex(), index, button: cloneCardConfig(badges()[index] || cardContractDefaultConfig("badge")) };
    if (subtype) {
      setBadgeSubtype(draft.button, subtype);
      draft.button.icon = BADGE_SUBTYPES.find(type => type.key === subtype)!.defaultIcon;
    }
    renderEditor(); deps.renderPreview();
  }

  function renderEditor() {
    if (!draft) return;
    const settingsOpen = config!.querySelector("#sp-badge-inp-card-settings")?.getAttribute("aria-expanded") === "true";
    header(BADGE_SUBTYPES.find(type => type.key === badgeSubtype(draft!.button))!.label + " Badge");
    const current = draft;
    const panel = document.createElement("div"); panel.className = "sp-panel";
    const required: Array<{ input: HTMLInputElement; valid: () => boolean; message: string }> = [];
    const helpers = {
      ...fields, idPrefix: "sp-badge-inp-", entityInput: deps.entities.entityInput,
      saveField: () => deps.renderPreview(), renderBadgeSettings: renderEditor,
      bindField(input: HTMLInputElement, field: keyof CardConfig) {
        input.addEventListener("input", () => { current.button[field] = input.value; deps.renderPreview(); });
        input.addEventListener("change", () => { current.button[field] = input.value; deps.renderPreview(); });
      },
      requireField(input: HTMLInputElement, message: string) {
        required.push({ input, message, valid: () => Boolean(input.value.trim()) });
      },
      requireEntityDomain(input: HTMLInputElement, domains: string[], message: string) {
        required.push({ input, message, valid: () => domains.includes(input.value.split(".")[0] || "") });
      },
      iconPickerField(pickerId: string, inputId: string, value: string, onSelect: (value: string) => void, label: string) {
        const wrapper = document.createElement("div"); wrapper.className = "sp-field";
        wrapper.appendChild(fields.fieldLabel(label, inputId));
        const picker = document.createElement("div"); picker.id = pickerId; picker.className = "sp-icon-picker";
        picker.appendChild(mdiIcon(value, "sp-icon-picker-preview mdi"));
        const input = fields.textInput(inputId, value, "Search icons…"); input.className = "sp-icon-picker-input";
        picker.appendChild(input);
        const dropdown = document.createElement("div"); dropdown.className = "sp-icon-dropdown"; picker.appendChild(dropdown);
        wrapper.appendChild(picker); deps.iconPicker.init(picker, value, onSelect); return wrapper;
      },
    };
    deps.cards.definitions.badge!.renderSettings!(panel, current.button, current.index, helpers);
    const settings = fields.groupCardSettingsFields(panel, "sp-badge-inp-", "Badge Settings");
    if (settingsOpen) settings?.button.click();
    const actions = document.createElement("div"); actions.className = "sp-btn-row sp-btn-row--save";
    const saveButton = button("Save", () => {
      const invalid = required.find(rule => !rule.valid());
      if (invalid) {
        const section = invalid.input.closest(".sp-disclosure:not(.sp-open)");
        (section?.querySelector(".sp-disclosure-button") as HTMLButtonElement | null)?.click();
        shell.showBanner(invalid.message, "error"); invalid.input.focus(); return;
      }
      const next = badges(current.page).map(cloneCardConfig); next[current.index] = cloneCardConfig(current.button); void save(next);
    }, "sp-action-btn sp-save-btn");
    if (current.index < badges(current.page).length) {
      actions.classList.add("sp-has-delete");
      const management = document.createElement("div"); management.className = "sp-badge-management";
      management.appendChild(button("", () => { const next = badges(current.page).map(cloneCardConfig); next.splice(current.index, 1); void save(next); }, "sp-action-btn sp-delete-btn", "trash-can-outline", "Delete"));
      const reorder = (direction: number) => {
        const next = badges(current.page).map(cloneCardConfig); const destination = current.index + direction;
        next[current.index] = cloneCardConfig(current.button);
        [next[current.index], next[destination]] = [next[destination]!, next[current.index]!]; void save(next);
      };
      if (current.index > 0) management.appendChild(button("", () => reorder(-1), "sp-action-btn sp-delete-btn", "arrow-left", "Move left"));
      if (current.index + 1 < badges(current.page).length) management.appendChild(button("", () => reorder(1), "sp-action-btn sp-delete-btn", "arrow-right", "Move right"));
      actions.appendChild(management);
    }
    const rightGroup = document.createElement("div"); rightGroup.className = "sp-btn-group-right";
    rightGroup.appendChild(saveButton); actions.appendChild(rightGroup);
    panel.appendChild(actions); config!.appendChild(panel);
  }

  async function load() {
    const generation = ++loadGeneration;
    try {
      if (await deps.native.waitForDiscovery() !== true) return;
      state.badgeRowsSupported = deps.native.client?.badgeRowsSupported() || false;
      if (!state.badgeRowsSupported) return;
      const document = await deps.native.client!.read();
      if (generation !== loadGeneration || saving || draft) return;
      state.badgeRows = badgeRowsFromSettings(document.settings);
      state.badgeRowsReady = true;
      deps.renderPreview();
    } catch { shell.showBanner("Could not load badge rows. Reload to try again.", "error"); }
  }
  return { render, renderSelectionControl, load };
}
