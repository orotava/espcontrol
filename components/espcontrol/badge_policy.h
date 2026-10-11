#pragma once

#include "number_slider_policy.h"
#include <string>

namespace espcontrol::badge {

inline std::string action(const std::string &value) {
  return value == "subpage" || value == "modal" || value == "toggle" ||
         value == "slider" ? value : "display";
}

inline bool toggle_supported(const std::string &entity) {
  return number_slider::has_domain(entity, "light") ||
         number_slider::has_domain(entity, "switch") ||
         number_slider::has_domain(entity, "input_boolean") ||
         number_slider::has_domain(entity, "fan");
}

inline bool slider_supported(const std::string &entity) {
  return number_slider::is_numeric_entity(entity) ||
         number_slider::has_domain(entity, "light") ||
         number_slider::has_domain(entity, "fan") ||
         number_slider::has_domain(entity, "media_player");
}

inline const char *level_attribute(const std::string &entity) {
  if (number_slider::has_domain(entity, "light")) return "brightness";
  if (number_slider::has_domain(entity, "fan")) return "percentage";
  if (number_slider::has_domain(entity, "media_player")) return "volume_level";
  return "";
}

inline double level_percent(const std::string &entity, double value) {
  if (number_slider::has_domain(entity, "light")) value = value * 100.0 / 255.0;
  else if (number_slider::has_domain(entity, "media_player")) value *= 100.0;
  return std::max(0.0, std::min(100.0, value));
}

}  // namespace espcontrol::badge
