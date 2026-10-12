#include <cassert>
#include <string>

using lv_obj_t = int;
struct Page { lv_obj_t *screen; };
bool ready = true, locked = false, alarm = false;
int target_slot = 4, opens = 0, modal_closes = 0, image_refreshes = 0;
lv_obj_t screen = 1;
Page page{&screen};
constexpr int LV_SCR_LOAD_ANIM_NONE = 0;
bool grid_phase2_complete() { return ready; }
bool screen_lock_enabled() { return locked; }
bool alarm_display_takeover_active() { return alarm; }
Page *navigation_find_slot(int slot) { return slot == target_slot ? &page : nullptr; }
void navigation_hide_modals() { modal_closes++; }
void lv_scr_load_anim(lv_obj_t *target, int, int, int, bool) { assert(target == &screen); opens++; }
void refresh_visible_image_cards() { image_refreshes++; }
#define ESP_LOGW(...) ((void)0)
#include "button_grid_badge_navigation.h"

int main() {
  // A badge-owned page has a slot and screen, but no visible home-grid card.
  assert(badge_open_subpage(4));
  assert(opens == 1 && modal_closes == 1 && image_refreshes == 1);
  assert(!badge_open_subpage(3));
  locked = true;
  assert(!badge_open_subpage(4));
  locked = false; alarm = true;
  assert(!badge_open_subpage(4));
  alarm = false; ready = false;
  assert(!badge_open_subpage(4));
  ready = true; page.screen = nullptr;
  assert(!badge_open_subpage(4));
  page.screen = &screen;
  assert(badge_open_subpage(4));
  assert(opens == 2 && modal_closes == 2 && image_refreshes == 2);
}
