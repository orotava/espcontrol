---
title: Badge Rows
description: Compact icon-and-label or live-value controls for EspControl.
---

# Badge

A Badge shows one icon beside a label or live value in a rounded pill. Use it
for a room shortcut, temperature reading, light switch, or compact slider.
Each page has its own optional, short badge row above the existing card grid.
Badges have a separate list and do not occupy card slots. Adding a row reduces
the height of the grid while keeping its columns, card count and positions.
The row stays one badge high; swipe horizontally if the badges do not all fit.

## Set Up a Badge

1. Open the home screen or subpage in the web editor and click the **+** at the
   end of the badge row. Use **Show badges** if the row is hidden. Each page
   supports up to eight badges.
2. Choose a type from the same picker used for cards. Availability follows
   your panel's supported card types.
3. Configure the entity and controls as you would for that card. For example,
   Light and Fan badges offer their existing control modes and modal settings.
   **Badge Settings** contains the icon and other settings for that type.
   **Badge Display** defaults to **Card display**, following the card's own
   label or status setting. Choose **Label** to keep the badge's name visible,
   or **Live value** for types with a reading. Changing this choice does not
   change the card's control mode or modal settings.
4. For a Subpage badge, enter a label and choose **Edit Subpage** to open its
   own card grid immediately. This saves the badge and its unique page together.
   **Save** also creates the page, ready to open from the badge later.
5. Sliders show whole numbers, using the entity's unit automatically or a
   percentage for brightness and fan speed. Their Home Assistant range and
   step still determine the values sent to the entity.

Click a badge to select it, then choose **Edit** in the edit bar. Right-click
a badge or use the bar's **…** menu to edit, duplicate, copy, cut or delete it.
Drag a badge into a gap, or to the start or end of the row, to reorder it.
A blue insertion line shows where it will go; the **+** stays at the end. **Save** writes badge
settings independently of card settings. The empty row keeps its **+** in the
editor so you can add badges again.

Use **Ctrl-click** or **Cmd-click** to add or remove badges from the selection,
or **Shift-click** to select a range. Choose **Edit** to change the selected
badges together. Only fields you change are applied; mixed values, entities
and each badge's unique subpage link stay intact when left untouched. Selecting
badges of the same type and mode also lets you edit their Home Assistant Entity together. Local
sensors and local actions keep their individual sources. The context
menu's copy, duplicate, cut and delete actions apply to the whole selection.

Close the dialog or choose **Cancel** to discard unsaved edits.

Badge rows require firmware that supports them. They are included in exported
configuration backups; update older panels before restoring a backup that
contains rows.

Badges support the same types and modes as cards: switches, actions, lights,
fans, climate, media, sensors, presence, doors and windows, covers, locks,
garage doors, gates, alarms, vacuum cleaners, lawn mowers, timers, selectors,
numeric sliders, dates, times, weather, images, Wi-Fi QR codes, webhooks,
screen locks and panel-specific internal controls. Each badge owns its control
settings, live state and modal; it does not need a matching card in the grid.
The compact surface shows an icon beside the card's label or reading:

| Type | Compact content and interaction |
| --- | --- |
| Switch, action, internal control, push button, webhook, selector | Card label or configured state; tap runs the same action or opens the same controls. |
| Light, fan, climate | Card label or status; control modes open their own full-size modal. Brightness, temperature and speed modes use an inline slider. |
| Numeric slider, cover position or tilt | Whole-number reading and the card's native range and step; drag to adjust. Cover button modes keep their own actions. |
| Media | Playback buttons follow their configured label or status. Volume shows a percentage, now-playing and cover-art modes show the track, and seek modes use an inline slider. |
| Sensor, local sensor, presence, door/window | Numeric readings, text or icon states follow the chosen card mode. |
| Lock, garage, gate, alarm, vacuum, lawn mower, timer | Card status or configured label; tap uses the card's action, confirmation or modal. |
| Calendar, clock, timezone, weather | Date, time or weather content follows the chosen card mode. |
| Image, Wi-Fi QR, screen lock | Compact icon and label; tap uses the card's normal viewer or controls. |
| Subpage | Label and a link to its own editable page of cards. |

A Subpage badge owns a unique page. Its **Edit Subpage** button uses the same
card-grid editor as a Subpage card. Reopening or renaming the badge preserves
its destination and page contents. Existing badge links to ordinary card
subpages remain supported. Duplicating or pasting a Subpage badge creates a
separate copy of its page, including its cards and nested badge rows. Cutting
keeps those contents for pasting. Deleting a badge removes its unused private
pages, while pages still linked elsewhere remain available.

The additional **Modal** type retains the option to open an existing control
card on the panel, including cards inside a subpage. Badges created with the
previous Sensor, Switch, Button and Slider setup remain readable and editable.
For an existing Slider badge, **Display: Label** shows its name even while
dragging; **Live value** shows its own reading as a whole number. This choice
also works when editing several existing slider badges together.
There is no separate Label badge type.

Slider badges fit their icon and displayed text, including padding, and resize
as the live value changes instead of reserving a fixed-width track.
Both the panel and web preview use the smaller label font, extra padding at the
right end of each pill, and a solid primary-colour slider fill.

Unknown or unavailable readings show `--`. Controls follow the corresponding
card's availability and Home Assistant capabilities; numeric sliders also
wait for valid range information. Home Assistant actions must be enabled
for controls, as with cards. Opening a control modal uses the full modal size.

The web editor uses sample values to preview the layout. Test live values and
touch interactions on the physical panel.
