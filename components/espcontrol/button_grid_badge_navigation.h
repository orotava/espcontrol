#pragma once

// Badge destinations use the subpage's stable configuration slot, so renaming
// its label or rearranging the home screen does not break the shortcut.
inline bool badge_open_subpage(int slot) {
  if (!grid_phase2_complete() || screen_lock_enabled() || alarm_display_takeover_active()) return false;
  const auto *page = navigation_find_slot(slot);
  if (!page || !page->screen) {
    ESP_LOGW("badge", "Subpage destination %d is no longer available", slot);
    return false;
  }
  navigation_hide_modals();
  lv_scr_load_anim(page->screen, LV_SCR_LOAD_ANIM_NONE, 0, 0, false);
  refresh_visible_image_cards();
  return true;
}
