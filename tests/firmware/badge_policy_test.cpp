#include "badge_policy.h"
#include <cassert>
#include <cmath>

int main() {
  using namespace espcontrol::badge;
  assert(content_left_padding(24) > content_right_padding(24));
  assert(width_for_text(24, 20, false) == 108);
  assert(width_for_text(24, 20, true) == 168);
  assert(width_for_text(24, 150, false) == 218);
  assert(toggle_checked(true, true));
  assert(!toggle_checked(true, false));
  assert(!toggle_checked(false, true));
  assert(action("erase") == "display");
  assert(action("button") == "button");
  assert(button_supported("button.restart"));
  assert(button_supported("input_button.scene"));
  assert(!button_supported("switch.lights"));
  assert(!button_supported("button."));
  assert(std::string(button_action("button.restart")) == "button.press");
  assert(std::string(button_action("input_button.scene")) == "input_button.press");
  assert(toggle_supported("light.kitchen"));
  assert(!toggle_supported("lock.front_door"));
  assert(!toggle_supported("light."));
  assert(slider_supported("input_number.target"));
  assert(!slider_supported("sensor.target"));
  assert(std::fabs(level_percent("light.kitchen", 128) - 50.196078) < 0.001);
  assert(level_percent("light.kitchen", 255) == 100);
  assert(level_percent("media_player.kitchen", 0.35) == 35);
  assert(level_percent("fan.kitchen", 40) == 40);
  assert(level_percent("media_player.kitchen", 1.5) == 100);
  assert(level_percent("light.kitchen", -1) == 0);
  assert(std::string(level_attribute("media_player.kitchen")) == "volume_level");
  assert(std::string(level_attribute("number.target")).empty());
}
