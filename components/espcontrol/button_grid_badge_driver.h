#pragma once

#include "badge_policy.h"

// Badge visuals own their context through the content object's delete event.
// The same driver serves the home grid and subpages. Badge navigation resolves
// a page by its stable slot, including pages reserved exclusively for badges.
inline bool espcontrol_open_modal(const std::string &entity_id, bool ui_ready);
inline bool badge_open_subpage(int slot);

namespace espcontrol::cards {

struct BadgeCtx {
  lv_obj_t *button = nullptr;
  lv_obj_t *content = nullptr;
  lv_obj_t *value_label = nullptr;
  lv_obj_t *slider = nullptr;
  std::string action;
  std::string target;
  std::string display_entity;
  std::string display_attribute;
  std::string label;
  std::string display_value;
  std::string unit;
  std::string auto_unit;
  bool show_value = false;
  bool display_available = false;
  bool target_available = false;
  bool target_on = false;
  bool level_known = false;
  bool active_color = false;
  bool fit_width = false;
  bool slider_action = false;
  int line_height = 24;
  int text_width_percent = 100;
  bool dragging = false;
  bool media_absolute = true;
  int page = 0;
  int decimals = 1;
  double level = 0.0;
  CardPadding padding;
  espcontrol::number_slider::Metadata metadata;
  bool metadata_known[3] = {};
};

inline std::vector<BadgeCtx *> &badge_contexts() {
  static std::vector<BadgeCtx *> contexts;
  return contexts;
}

inline BadgeCtx *badge_context(lv_obj_t *owner) {
  for (BadgeCtx *ctx : badge_contexts()) if (ctx->button == owner) return ctx;
  return nullptr;
}

inline bool badge_driver_matches(const Context &context) {
  return context.runtime.driver == card_runtime::CardDriverId::BADGE;
}

inline bool badge_numeric(const BadgeCtx *ctx) {
  return espcontrol::number_slider::is_numeric_entity(ctx->target);
}

inline bool badge_slider_ready(const BadgeCtx *ctx) {
  if (!ctx->target_available || !espcontrol::badge::slider_supported(ctx->target)) return false;
  if (badge_numeric(ctx)) {
    return ctx->level_known && ctx->metadata_known[0] &&
           ctx->metadata_known[1] && ctx->metadata_known[2] &&
           espcontrol::number_slider::metadata_valid(ctx->metadata);
  }
  return ctx->media_absolute && (ctx->level_known ||
    (!ctx->target_on && !espcontrol::number_slider::has_domain(ctx->target, "media_player")));
}

inline std::string badge_slider_text(const BadgeCtx *ctx, int position) {
  if (badge_numeric(ctx)) return espcontrol::badge::slider_value_text(
    espcontrol::number_slider::value_for_position(ctx->metadata, position)) + ctx->auto_unit;
  return std::to_string(position) + "%";
}

inline void badge_update(BadgeCtx *ctx) {
  if (!ctx) return;
  const bool control = ctx->action == "toggle" || ctx->action == "button" || ctx->action == "slider";
  const bool available = ctx->action == "slider" ? badge_slider_ready(ctx)
    : ctx->target_available && (ctx->action == "button"
      ? espcontrol::badge::button_supported(ctx->target) : espcontrol::badge::toggle_supported(ctx->target));
  if (control) {
    set_card_disabled_state(ctx->button, !available);
    if (!available) ctx->dragging = false;
  }
  // Switch badges use the same checked state as toggle cards, so their live
  // on/off state remains visible even when optional sensor active-coloring is off.
  if (ctx->action == "toggle") {
    set_card_checked_state(ctx->button,
      espcontrol::badge::toggle_checked(available, ctx->target_on));
  } else if (ctx->active_color && ctx->display_entity.empty() && ctx->action == "slider") {
    set_card_checked_state(ctx->button,
      ctx->target_available && (badge_numeric(ctx) ? ctx->level > 0.0 : ctx->target_on));
  }
  if (ctx->slider) {
    if (available) lv_obj_add_flag(ctx->slider, LV_OBJ_FLAG_CLICKABLE);
    else lv_obj_clear_flag(ctx->slider, LV_OBJ_FLAG_CLICKABLE);
    if (!ctx->dragging) {
      const int positions = badge_numeric(ctx)
        ? espcontrol::number_slider::slider_position_count(ctx->metadata) : 100;
      lv_slider_set_range(ctx->slider, 0, std::max(1, positions));
      double level = ctx->level;
      if (!badge_numeric(ctx) && !ctx->target_on &&
          !espcontrol::number_slider::has_domain(ctx->target, "media_player")) level = 0.0;
      const int position = badge_numeric(ctx)
        ? espcontrol::number_slider::position_for_value(ctx->metadata, level)
        : static_cast<int>(std::round(level));
      lv_slider_set_value(ctx->slider, available ? position : 0, LV_ANIM_OFF);
    }
  }
  if (ctx->dragging) return;
  std::string text = ctx->label;
  if (ctx->show_value) {
    text = "--";
    if (ctx->display_entity.empty() && ctx->slider && badge_slider_ready(ctx)) {
      const int position = lv_slider_get_value(ctx->slider);
      text = badge_slider_text(ctx, position);
    } else if (ctx->display_available && !ctx->display_value.empty()) {
      double numeric = 0.0;
      if (parse_double_ref(esphome::StringRef(ctx->display_value), numeric) && std::isfinite(numeric)) {
        char buffer[64];
        snprintf(buffer, sizeof(buffer), "%.*f", ctx->decimals, numeric);
        text = buffer;
        text += ctx->unit.empty() ? ctx->auto_unit : ctx->unit;
      } else {
        text = ctx->display_value;
      }
    }
  }
  lv_label_set_display_text(ctx->value_label, text.c_str());
  if (ctx->fit_width && ctx->value_label) {
    const lv_font_t *font = lv_obj_get_style_text_font(ctx->value_label, LV_PART_MAIN);
    lv_point_t text_size{};
    lv_text_get_size(&text_size, text.c_str(), font, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    const int compensated_width = static_cast<int>((static_cast<long long>(text_size.x) * ctx->text_width_percent + 99) / 100);
    lv_obj_set_width(ctx->button, espcontrol::badge::width_for_text(
      ctx->line_height, compensated_width, ctx->slider_action));
  }
}

inline void badge_driver_fit_width(lv_obj_t *button) {
  BadgeCtx *ctx = badge_context(button);
  if (!ctx) return;
  ctx->fit_width = true;
  badge_update(ctx);
}

inline void badge_handle_click(BadgeCtx *ctx) {
  if (!ctx || screen_lock_enabled() || alarm_display_takeover_active()) return;
  if (ctx->action == "subpage") badge_open_subpage(ctx->page);
  else if (ctx->action == "modal") espcontrol_open_modal(ctx->target, grid_phase2_complete());
  else if (ctx->action == "button" && ctx->target_available && espcontrol::badge::button_supported(ctx->target)) {
    ha_send_entity_action(ctx->target, espcontrol::badge::button_action(ctx->target));
  }
  else if (ctx->action == "toggle" && ctx->target_available &&
           espcontrol::badge::toggle_supported(ctx->target)) send_toggle_action(ctx->target);
}

inline bool badge_driver_cleanup(BtnSlot &slot, const ParsedCfg &, const Context &) {
  BadgeCtx *ctx = badge_context(slot.btn);
  if (!ctx) return false;
  lv_obj_remove_local_style_prop(slot.btn, LV_STYLE_HEIGHT, LV_PART_MAIN);
  lv_obj_remove_local_style_prop(slot.btn, LV_STYLE_RADIUS, LV_PART_MAIN);
  lv_obj_remove_local_style_prop(slot.btn, LV_STYLE_GRID_CELL_Y_ALIGN, LV_PART_MAIN);
  lv_obj_remove_local_style_prop(slot.btn, LV_STYLE_GRID_CELL_X_ALIGN, LV_PART_MAIN);
  lv_obj_set_style_pad_left(slot.btn, ctx->padding.left, LV_PART_MAIN);
  lv_obj_set_style_pad_right(slot.btn, ctx->padding.right, LV_PART_MAIN);
  lv_obj_set_style_pad_top(slot.btn, ctx->padding.top, LV_PART_MAIN);
  lv_obj_set_style_pad_bottom(slot.btn, ctx->padding.bottom, LV_PART_MAIN);
  return true;
}

inline bool badge_driver_refresh_layout(BtnSlot &slot, const ParsedCfg &, const Context &context) {
  if (!badge_driver_matches(context)) return false;
  BadgeCtx *ctx = badge_context(slot.btn);
  if (!ctx) return true;
  const lv_font_t *font = lv_obj_get_style_text_font(ctx->value_label, LV_PART_MAIN);
  const lv_coord_t line = font ? font->line_height : 24;
  clock_bar_unregister_responsive_grid_card(slot.btn);
  lv_obj_set_style_grid_cell_x_align(slot.btn, LV_GRID_ALIGN_STRETCH, LV_PART_MAIN);
  lv_obj_set_style_grid_cell_y_align(slot.btn, LV_GRID_ALIGN_CENTER, LV_PART_MAIN);
  lv_obj_set_height(slot.btn, line * 2);
  lv_obj_set_style_radius(slot.btn, LV_RADIUS_CIRCLE, LV_PART_MAIN);
  return true;
}

inline bool badge_driver_setup_visual(BtnSlot &slot, const ParsedCfg &config,
                                     const Context &context, const DisplayProfile &display) {
  if (!badge_driver_matches(context)) return false;
  if (slot.icon_lbl) lv_obj_add_flag(slot.icon_lbl, LV_OBJ_FLAG_HIDDEN);
  if (slot.text_lbl) lv_obj_add_flag(slot.text_lbl, LV_OBJ_FLAG_HIDDEN);
  if (slot.sensor_container) lv_obj_add_flag(slot.sensor_container, LV_OBJ_FLAG_HIDDEN);
  BadgeCtx *ctx = new BadgeCtx();
  ctx->button = slot.btn;
  ctx->padding = capture_card_padding(slot.btn);
  lv_obj_set_style_pad_all(slot.btn, 0, LV_PART_MAIN);
  ctx->action = espcontrol::badge::action(cfg_option_value(config.options, "badge_action"));
  ctx->slider_action = ctx->action == "slider";
  ctx->target = config.entity;
  ctx->label = config.label;
  ctx->display_entity = ctx->slider_action ? "" : config.sensor;
  ctx->display_attribute = ctx->slider_action ? "" : cfg_option_value(config.options, "badge_attribute");
  ctx->unit = ctx->slider_action ? "" : config.unit;
  ctx->show_value = ctx->slider_action || config.precision == "value";
  ctx->page = atoi(cfg_option_value(config.options, "badge_page").c_str());
  ctx->active_color = cfg_option_enabled(config.options, "active_color");
  const std::string decimals = cfg_option_value(config.options, "badge_decimals");
  ctx->decimals = decimals == "0" ? 0 : decimals == "2" ? 2 : 1;

  if (ctx->action == "slider") {
    ctx->slider = lv_slider_create(slot.btn);
    lv_obj_remove_style_all(ctx->slider);
    lv_obj_set_size(ctx->slider, LV_PCT(100), LV_PCT(100));
    lv_obj_center(ctx->slider);
    lv_obj_set_style_radius(ctx->slider, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_radius(ctx->slider, LV_RADIUS_CIRCLE, LV_PART_INDICATOR);
    lv_obj_set_style_bg_color(ctx->slider, lv_color_hex(current_button_primary_color()), LV_PART_INDICATOR);
    lv_obj_set_style_bg_opa(ctx->slider, LV_OPA_30, LV_PART_INDICATOR);
    lv_obj_clear_flag(ctx->slider, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_user_data(ctx->slider, ctx);
    lv_slider_set_range(ctx->slider, 0, 100);
    lv_obj_add_event_cb(ctx->slider, [](lv_event_t *event) {
      auto *state = static_cast<BadgeCtx *>(lv_obj_get_user_data(static_cast<lv_obj_t *>(lv_event_get_target(event))));
      if (!state) return;
      const lv_event_code_t code = lv_event_get_code(event);
      if (code == LV_EVENT_DELETE) { state->slider = nullptr; return; }
      if (code == LV_EVENT_PRESSED) state->dragging = badge_slider_ready(state);
      if (code == LV_EVENT_VALUE_CHANGED && state->dragging && state->show_value && state->display_entity.empty()) {
        const int position = lv_slider_get_value(state->slider);
        const std::string value = badge_slider_text(state, position);
        lv_label_set_display_text(state->value_label, value.c_str());
      }
      if (code == LV_EVENT_RELEASED) {
        if (state->dragging && badge_slider_ready(state) &&
            !screen_lock_enabled() && !alarm_display_takeover_active()) {
          const int position = lv_slider_get_value(state->slider);
          if (badge_numeric(state)) send_numeric_slider_action(state->target,
            espcontrol::number_slider::value_for_position(state->metadata, position), state->metadata);
          else if (espcontrol::number_slider::has_domain(state->target, "media_player")) send_media_volume_action(state->target, position);
          else send_slider_action(state->target, position);
        }
        state->dragging = false;
        badge_update(state);
      }
      if (code == LV_EVENT_PRESS_LOST) {
        state->dragging = false;
        badge_update(state);
      }
    }, LV_EVENT_ALL, ctx);
  }

  ctx->content = lv_obj_create(slot.btn);
  lv_obj_remove_style_all(ctx->content);
  lv_obj_clear_flag(ctx->content, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_clear_flag(ctx->content, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(ctx->content, LV_PCT(100), LV_PCT(100));
  lv_obj_center(ctx->content);
  lv_obj_set_flex_flow(ctx->content, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(ctx->content, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  const lv_font_t *label_font = slot.text_lbl ? lv_obj_get_style_text_font(slot.text_lbl, LV_PART_MAIN) : nullptr;
  const lv_coord_t line = label_font ? label_font->line_height : 24;
  ctx->line_height = line;
  ctx->text_width_percent = display.width.vertical_axis ? 100 : display_text_width_percent(display);
  lv_obj_set_style_pad_left(ctx->content, espcontrol::badge::content_left_padding(line), LV_PART_MAIN);
  lv_obj_set_style_pad_right(ctx->content, espcontrol::badge::content_right_padding(line), LV_PART_MAIN);
  lv_obj_set_style_pad_column(ctx->content, line / 3, LV_PART_MAIN);
  lv_obj_t *icon_box = lv_obj_create(ctx->content);
  lv_obj_remove_style_all(icon_box);
  lv_obj_clear_flag(icon_box, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_clear_flag(icon_box, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(icon_box, line, line);
  lv_obj_t *icon = lv_label_create(icon_box);
  // The main font contains every selectable icon; the smaller climate font
  // only includes climate symbols. Scale the glyph inside a compact box.
  const lv_font_t *icon_font = display_icon_font(display);
  lv_obj_set_style_text_font(icon, icon_font, LV_PART_MAIN);
  const std::string icon_name = config.icon.empty() || config.icon == "Auto"
    ? (ctx->action == "slider" ? "Volume High" : "Home") : config.icon;
  lv_label_set_display_text(icon, find_icon(icon_name.c_str()));
  lv_obj_center(icon);
  const int scale = icon_font && icon_font->line_height > 0
    ? line * 256 / icon_font->line_height : 256;
  lv_obj_set_style_transform_pivot_x(icon, LV_PCT(50), LV_PART_MAIN);
  lv_obj_set_style_transform_pivot_y(icon, LV_PCT(50), LV_PART_MAIN);
  lv_obj_set_style_transform_scale_x(icon, scale, LV_PART_MAIN);
  lv_obj_set_style_transform_scale_y(icon, scale, LV_PART_MAIN);
  ctx->value_label = lv_label_create(ctx->content);
  if (label_font) lv_obj_set_style_text_font(ctx->value_label, label_font, LV_PART_MAIN);
  display_apply_text_width(ctx->value_label, display);
  lv_obj_set_flex_grow(ctx->value_label, 1);
  lv_label_set_long_mode(ctx->value_label, LV_LABEL_LONG_DOT);
  badge_contexts().push_back(ctx);
  lv_obj_add_event_cb(ctx->content, [](lv_event_t *event) {
    auto *state = static_cast<BadgeCtx *>(lv_event_get_user_data(event));
    if (state->slider) lv_obj_set_user_data(state->slider, nullptr);
    ha_release_callbacks_for_owner(state->content);
    auto &contexts = badge_contexts();
    contexts.erase(std::remove(contexts.begin(), contexts.end(), state), contexts.end());
    delete state;
  }, LV_EVENT_DELETE, ctx);
  if (ctx->action == "display" || ctx->action == "slider") lv_obj_clear_flag(slot.btn, LV_OBJ_FLAG_CLICKABLE);
  badge_update(ctx);
  return true;
}

inline bool badge_driver_bind_data(BtnSlot &slot, const ParsedCfg &, const Context &context) {
  if (!badge_driver_matches(context)) return false;
  BadgeCtx *ctx = badge_context(slot.btn);
  if (!ctx) return true;
  // Rebinding after a layout refresh must not duplicate callbacks or retain
  // subscriptions to widgets from an earlier grid.
  ha_release_callbacks_for_owner(ctx->content);
  HaCallbackOwnerScope owner(ctx->content);
  if (!ctx->display_entity.empty()) {
    ha_subscribe_state(ctx->display_entity, [ctx](esphome::StringRef state) {
      ctx->display_available = !ha_state_unavailable_ref(state);
      if (ctx->display_attribute.empty()) ctx->display_value = string_ref_limited(state, HA_SHORT_STATE_MAX_LEN);
      if (ctx->active_color) set_card_checked_state(ctx->button, ctx->display_available && sensor_active_color_state_ref(state, true));
      badge_update(ctx);
    });
    if (!ctx->display_attribute.empty()) ha_subscribe_attribute(ctx->display_entity, ctx->display_attribute, [ctx](esphome::StringRef value) {
      ctx->display_value = ha_state_unavailable_ref(value) ? "" : string_ref_limited(value, HA_SHORT_STATE_MAX_LEN);
      badge_update(ctx);
    });
    ha_subscribe_attribute(ctx->display_entity, "unit_of_measurement", [ctx](esphome::StringRef value) {
      ctx->auto_unit = ha_state_unavailable_ref(value) ? "" : string_ref_limited(value, HA_SHORT_STATE_MAX_LEN);
      badge_update(ctx);
    });
  }
  if (!ctx->target.empty() && (ctx->action == "toggle" || ctx->action == "button" || ctx->action == "slider")) {
    ha_subscribe_state(ctx->target, [ctx](esphome::StringRef state) {
      ctx->target_available = ctx->action == "button"
        ? !ha_entity_state_unavailable_ref(ctx->target, state) : !ha_state_unavailable_ref(state);
      ctx->target_on = is_entity_on_ref(state);
      if (badge_numeric(ctx)) {
        ctx->level_known = ctx->target_available && parse_double_ref(state, ctx->level) && std::isfinite(ctx->level);
        ctx->target_available = ctx->level_known;
      }
      badge_update(ctx);
    });
  }
  if (ctx->slider && espcontrol::badge::slider_supported(ctx->target)) {
    if (badge_numeric(ctx)) {
      for (int field = 0; field < 3; field++) {
        ha_subscribe_attribute(ctx->target, field == 0 ? "min" : field == 1 ? "max" : "step", [ctx, field](esphome::StringRef value) {
          double parsed = 0.0;
          ctx->metadata_known[field] = parse_double_ref(value, parsed) && std::isfinite(parsed);
          if (ctx->metadata_known[field]) {
            if (field == 0) ctx->metadata.minimum = parsed;
            else if (field == 1) ctx->metadata.maximum = parsed;
            else ctx->metadata.step = parsed;
          }
          badge_update(ctx);
        });
      }
      if (ctx->display_entity.empty()) ha_subscribe_attribute(ctx->target, "unit_of_measurement", [ctx](esphome::StringRef value) {
        ctx->auto_unit = ha_state_unavailable_ref(value) ? "" : string_ref_limited(value, HA_SHORT_STATE_MAX_LEN);
        badge_update(ctx);
      });
    } else {
      ha_subscribe_attribute(ctx->target, espcontrol::badge::level_attribute(ctx->target), [ctx](esphome::StringRef value) {
        double parsed = 0.0;
        ctx->level_known = parse_double_ref(value, parsed) && std::isfinite(parsed);
        if (ctx->level_known) ctx->level = espcontrol::badge::level_percent(ctx->target, parsed);
        badge_update(ctx);
      });
      if (espcontrol::number_slider::has_domain(ctx->target, "media_player")) {
        ha_subscribe_attribute(ctx->target, "supported_features", [ctx](esphome::StringRef value) {
          double feature_value = 0.0;
          const bool known = parse_double_ref(value, feature_value) && std::isfinite(feature_value) && feature_value >= 0 && feature_value <= 2147483647.0;
          const int features = known ? static_cast<int>(feature_value) : 0;
          ctx->media_absolute = espcontrol::media::volume_arc_interactive(espcontrol::media::volume_control_mode(known, features));
          badge_update(ctx);
        });
      }
    }
  }
  badge_update(ctx);
  return true;
}

inline bool badge_driver_bind_main(BtnSlot &slot, const ParsedCfg &config, const Context &context) {
  return badge_driver_bind_data(slot, config, context);
}

inline bool badge_driver_bind_subpage(BtnSlot &slot, const ParsedCfg &config, const Context &context,
                                    const std::function<void(const std::string &)> &add_parent_indicator) {
  if (!badge_driver_bind_data(slot, config, context)) return false;
  BadgeCtx *ctx = badge_context(slot.btn);
  if (ctx && !ctx->target.empty() && (ctx->action == "toggle" || ctx->action == "slider") && add_parent_indicator) {
    add_parent_indicator(ctx->target);
  }
  if (ctx && ctx->action != "display" && ctx->action != "slider") {
    lv_obj_add_event_cb(slot.btn, [](lv_event_t *event) {
      badge_handle_click(static_cast<BadgeCtx *>(lv_event_get_user_data(event)));
    }, LV_EVENT_CLICKED, ctx);
  }
  return true;
}

inline bool badge_driver_handle_main_click(const Context &context, const ParsedCfg &, lv_obj_t *button) {
  if (!badge_driver_matches(context)) return false;
  badge_handle_click(badge_context(button));
  return true;
}

}  // namespace espcontrol::cards
