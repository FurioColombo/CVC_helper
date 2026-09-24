export function closeActiveDialogOnBack() {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"]',
  )
  const dialog = dialogs.item(dialogs.length - 1)
  if (!dialog) return false

  // Back has already moved one history entry before popstate runs. Restore the
  // current screen, then let the dialog's existing Escape handler close it.
  window.history.forward()
  dialog.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Escape",
    }),
  )
  return true
}
