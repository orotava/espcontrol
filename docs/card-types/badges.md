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
2. Choose a **Badge Type** from the table below.
3. Enter its **Entity** or create its own unique **Subpage**. Open **Badge
   Settings** for the icon and optional display settings, as with card setup.
4. Sensors show their Entity's reading. Sliders always show their own value
   as a whole number, using the entity's unit automatically or a percentage
   for brightness, fan speed and volume. Other types showing a live value
   use a **Display Entity**, with optional attribute, unit and decimal places.
5. Turn on **Lit When Active** if you want the badge to use the active colour.

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
badges of the same type also lets you edit their Entity together. The context
menu's copy, duplicate, cut and delete actions apply to the whole selection.

Close the dialog or choose **Cancel** to discard unsaved edits.

Badge rows require firmware that supports them. They are included in exported
configuration backups; update older panels before restoring a backup that
contains rows.

| Badge Type | Behaviour |
| --- | --- |
| Sensor | Shows an entity's reading without an action. |
| Subpage | Opens its own unique subpage, with a separate editable card grid. |
| Modal | Opens a supported control card already configured on this panel, including one inside a subpage. Closing it returns to the current page. |
| Switch | Toggles a light, switch, input boolean, or fan. |
| Button | Presses a Home Assistant button or input button. |
| Slider | Drag horizontally to adjust light brightness, fan speed, media volume, a number, or an input number. Sends the new value when you release. |

There is no separate Label badge type. Subpage, Switch, Button and Modal
badges can show a label; Sensor and Slider badges show live data. Existing
fixed-text badges remain readable, but editing one requires choosing an entity
or another type.

For badges other than sliders, the Display Entity can differ from the action's
Entity. For example, a badge can show a room temperature while opening that
room's thermostat modal.
Numeric helpers use their Home Assistant minimum, maximum and step. Media
sliders require support for setting volume directly.
Slider badges fit their icon and displayed text, including padding, and resize
as the live value changes instead of reserving a fixed-width track.
Both the panel and web preview use the smaller label font, extra padding at the
right end of each pill, and a solid primary-colour slider fill.

Unknown or unavailable readings show `--`. Toggle and slider controls are
disabled until their control entity is available; numeric sliders also wait
for valid range information. An unavailable display sensor does not prevent
opening a subpage. Home Assistant actions must be enabled for toggles and
sliders, as with the other control cards.

The web editor uses sample values to preview the layout. Test live values and
touch interactions on the physical panel.
