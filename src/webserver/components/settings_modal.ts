/** Shared shell for card and badge settings, including their content margins. */
export function createSettingsModal(document: Document, close: () => void, closeLabel = "Close settings") {
  const overlay = document.createElement("div");
  overlay.className = "sp-settings-overlay";
  const modal = document.createElement("div");
  modal.className = "sp-settings-modal";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "sp-settings-close";
  closeButton.innerHTML = '<svg class="sp-settings-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.3-6.29z"></path></svg>';
  closeButton.setAttribute("aria-label", closeLabel);
  closeButton.addEventListener("click", close);
  const config = document.createElement("div");
  config.className = "sp-config";
  modal.append(closeButton, config);
  overlay.appendChild(modal);
  return { overlay, modal, config };
}
