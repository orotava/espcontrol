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
  renderSelectedBadgeBar(container: HTMLElement): boolean;
  clearSelection(): void;
  hasSelection(): boolean;
  load(): Promise<void>;
}

export function createBadgeRowFeature(deps: {
  document: Document; runtime: UiRuntimeState; cards: CardRegistry;
  native: NativePanelConfigController; deviceProfile: string;
  fields: ControlsFieldsFeature; iconPicker: ButtonSettingsIconPickerFeature;
  entities: Pick<EntityStateFeature, "entityInput">;
  shell: Pick<ControlsShellFeature, "isConfigLocked" | "showBanner" | "createActionButton">;
  renderPreview(): void;
  prepareBadgeSelection(): void;
}): BadgeRowFeature {
  const { document, fields, runtime, shell } = deps;
  const els = runtime.els;
  let row: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let modal: HTMLElement | null = null;
  let config: HTMLElement | null = null;
  let draft: { page: number; index: number; button: CardConfig } | null = null;
  let selectedBadge: { page: number; index: number } | null = null;
  let saving = false;
  let draggedIndex = -1;
  let loadGeneration = 0;
  const pageIndex = () => state.editingSubpage || 0;
  const badges = (page = pageIndex()) => state.badgeRows[String(page)] || [];

  function currentSelection() {
    if (!selectedBadge || selectedBadge.page !== pageIndex() || selectedBadge.index >= badges().length) {
      selectedBadge = null;
      return null;
    }
    return selectedBadge;
  }

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
    els.previewScreen.classList.toggle("sp-has-badge-row", state.badgeRowsSupported && state.badgeRowsReady);
    row.hidden = !state.badgeRowsSupported || !state.badgeRowsReady;
    const group = document.createElement("div");
    group.className = "sp-badge-row-items";
    row.appendChild(group);
    const colors = PREVIEW_THEME_COLORS[previewEffectiveTheme(state)];
    const selection = currentSelection();
    items.forEach((config, index) => {
      const preview = deps.cards.definitions.badge!.renderPreview!(config, { escHtml }) as { buttonClass: string; iconHtml: string };
      const selected = selection?.page === pageIndex() && selection.index === index;
      const item = button("", () => selectBadge(index), "sp-btn " + preview.buttonClass + (selected ? " sp-selected" : ""));
      item.innerHTML = preview.iconHtml;
      item.style.backgroundColor = "#" + colors.surfaceCard;
      item.setAttribute("data-badge-index", String(index));
      item.setAttribute("aria-label", "Select badge " + (config.label || index + 1));
      item.draggable = !saving && !shell.isConfigLocked();
      item.disabled = saving || shell.isConfigLocked();
      bindDrag(item, index);
      group.appendChild(item);
    });
    const add = button("", addBadge, "sp-btn sp-badge-add", "plus", "Add badge");
    add.disabled = saving || shell.isConfigLocked() || items.length >= MAX_ROW_BADGES;
    add.addEventListener("dragover", event => {
      if (draggedIndex < 0 || saving || shell.isConfigLocked()) return;
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      add.classList.add("sp-drop-target");
    });
    add.addEventListener("dragleave", () => add.classList.remove("sp-drop-target"));
    add.addEventListener("drop", event => {
      if (draggedIndex < 0 || saving || shell.isConfigLocked()) return;
      event.preventDefault();
      add.classList.remove("sp-drop-target");
      reorderBadge(draggedIndex, items.length - 1);
      draggedIndex = -1;
    });
    group.appendChild(add);
  }

  function selectBadge(index: number) {
    selectedBadge = { page: pageIndex(), index };
    deps.prepareBadgeSelection();
    deps.renderPreview();
  }

  function addBadge() {
    selectedBadge = null;
    deps.prepareBadgeSelection();
    deps.renderPreview();
    chooseType();
  }

  function bindDrag(item: HTMLButtonElement, index: number) {
    item.addEventListener("dragstart", event => {
      if (saving || shell.isConfigLocked()) { event.preventDefault(); return; }
      draggedIndex = index;
      event.dataTransfer && (event.dataTransfer.effectAllowed = "move");
      event.dataTransfer && event.dataTransfer.setData("text/plain", String(index));
      item.classList.add("sp-dragging");
    });
    item.addEventListener("dragover", event => {
      if (draggedIndex < 0 || draggedIndex === index || saving || shell.isConfigLocked()) return;
      event.preventDefault();
      event.dataTransfer && (event.dataTransfer.dropEffect = "move");
      item.classList.add("sp-drop-target");
    });
    item.addEventListener("dragleave", () => item.classList.remove("sp-drop-target"));
    item.addEventListener("drop", event => {
      if (draggedIndex < 0 || saving || shell.isConfigLocked()) return;
      event.preventDefault();
      item.classList.remove("sp-drop-target");
      const bounds = item.getBoundingClientRect();
      const insertion = event.clientX < bounds.left + bounds.width / 2 ? index : index + 1;
      const destination = draggedIndex < insertion ? insertion - 1 : insertion;
      reorderBadge(draggedIndex, Math.min(badges().length - 1, destination));
      draggedIndex = -1;
    });
    item.addEventListener("dragend", () => {
      draggedIndex = -1;
      item.classList.remove("sp-dragging");
      row?.querySelectorAll(".sp-drop-target").forEach(target => target.classList.remove("sp-drop-target"));
    });
  }

  function reorderBadge(from: number, to: number) {
    const page = pageIndex();
    const next = badges(page).map(cloneCardConfig);
    to = Math.min(to, next.length - 1);
    if (from < 0 || from >= next.length || to < 0 || from === to) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    if (selectedBadge?.page === page) {
      if (selectedBadge.index === from) selectedBadge.index = to;
      else if (from < selectedBadge.index && selectedBadge.index <= to) selectedBadge.index--;
      else if (to <= selectedBadge.index && selectedBadge.index < from) selectedBadge.index++;
    }
    void save(next, page, false);
  }

  function clearSelection() {
    selectedBadge = null;
  }

  function hasSelection() {
    return currentSelection() !== null;
  }

  function renderSelectedBadgeBar(container: HTMLElement) {
    const selected = currentSelection();
    if (!selected) return false;
    const badge = badges(selected.page)[selected.index]!;
    const label = document.createElement("span");
    label.className = "sp-selection-label";
    label.textContent = (badge.label || badge.sensor || "Badge " + (selected.index + 1)) + " selected";
    container.appendChild(label);
    const actions = document.createElement("div");
    actions.className = "sp-selection-actions";
    actions.appendChild(button("Edit", () => edit(selected.index), "sp-selection-btn sp-selection-btn-primary", "pencil"));
    actions.appendChild(button("", deleteSelectedBadge, "sp-selection-btn", "trash-can-outline", "Delete"));
    container.appendChild(actions);
    return true;
  }

  function deleteSelectedBadge() {
    const selected = currentSelection();
    if (!selected) return;
    const next = badges(selected.page).map(cloneCardConfig);
    next.splice(selected.index, 1);
    selectedBadge = null;
    void save(next, selected.page, false);
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

  async function save(next: CardConfig[], page: number, closeEditor: boolean) {
    if (saving || shell.isConfigLocked()) return;
    let value: string;
    try { value = serializeBadgeRow(next); }
    catch (error) { shell.showBanner((error as Error).message, "error"); return; }
    saving = true;
    if (closeEditor) {
      modal?.setAttribute("aria-busy", "true");
      modal?.querySelectorAll("button,input,select").forEach(input => (input as HTMLInputElement).disabled = true);
    }
    const result = await deps.native.schedule(current => updateNativePanelConfigDocument(current, deps.deviceProfile, "settings", badgeRowKey(page), value));
    saving = false;
    if (closeEditor) {
      const closeButton = modal?.querySelector(".sp-settings-close") as HTMLButtonElement | null;
      if (closeButton) closeButton.disabled = false;
      modal?.removeAttribute("aria-busy");
    }
    if (result === "saved") {
      state.badgeRows[String(page)] = next;
      if (closeEditor) close();
      else deps.renderPreview();
    } else {
      shell.showBanner("Could not save badge rows. Check the connection and firmware, then try again.", "error");
      if (draft) renderEditor();
      else deps.renderPreview();
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
      const next = badges(current.page).map(cloneCardConfig); next[current.index] = cloneCardConfig(current.button); void save(next, current.page, true);
    }, "sp-action-btn sp-save-btn");
    if (current.index < badges(current.page).length) {
      actions.classList.add("sp-has-delete");
      const management = document.createElement("div"); management.className = "sp-badge-management";
      management.appendChild(button("", () => { const next = badges(current.page).map(cloneCardConfig); next.splice(current.index, 1); void save(next, current.page, true); }, "sp-action-btn sp-delete-btn", "trash-can-outline", "Delete"));
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
  return { render, renderSelectionControl, renderSelectedBadgeBar, clearSelection, hasSelection, load };
}
