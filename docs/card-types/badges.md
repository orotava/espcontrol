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

1. Open the home screen or subpage in the web editor, choose **Badges**, then
   **Add badge**. Each page supports up to eight badges.
2. Choose an **Icon** and **Display**: **Label** or **Live value**.
3. Choose an **Interaction** from the table below.
4. For a live value, choose a **Display Entity**. Optionally select an attribute,
   unit and decimal places. For a Slider, leave Display Entity blank to show
   the slider's own value.
5. Turn on **Lit When Active** if you want the badge to use the active colour.

Click a badge in the preview to edit it. Use **Move left**, **Move right**, or
**Delete** in its settings to manage the row. **Save** writes badge settings
independently of card settings. Deleting the last badge removes the row and
returns its height to the grid.

Badge rows require firmware that supports them. They are included in exported
configuration backups; update older panels before restoring a backup that
contains rows.

| Interaction | Behaviour |
| --- | --- |
| Display only | Shows a label or reading without an action. |
| Open subpage | Opens the subpage you select. Renaming or moving that Subpage card keeps the link. Deleting it requires choosing a new destination. |
| Open control modal | Opens a supported control card already configured on this panel, including one inside a subpage. Closing it returns to the current page. |
| Toggle | Toggles a light, switch, input boolean, or fan. |
| Slider | Drag horizontally to adjust light brightness, fan speed, media volume, a number, or an input number. Sends the new value when you release. |

The Display Entity can differ from the Control Entity. For example, a badge
can show a room temperature while opening that room's thermostat modal.
Numeric helpers use their Home Assistant minimum, maximum and step. Media
sliders require support for setting volume directly.

Unknown or unavailable readings show `--`. Toggle and slider controls are
disabled until their control entity is available; numeric sliders also wait
for valid range information. An unavailable display sensor does not prevent
opening a subpage. Home Assistant actions must be enabled for toggles and
sliders, as with the other control cards.

The web editor uses sample values to preview the layout. Test live values and
touch interactions on the physical panel.
