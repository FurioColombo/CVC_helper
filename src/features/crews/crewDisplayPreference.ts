const STORAGE_KEY = "cvc-helper.crew-display-columns"

/** Number of selected student names shown in each row of the crew display. */
export function getCrewDisplayColumns(): 2 | 3 {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "2" ? 2 : 3
  } catch {
    // A blocked storage API must not prevent Settings or crews from opening.
    return 3
  }
}

export function setCrewDisplayColumns(value: 2 | 3): void {
  if (value !== 2 && value !== 3) return

  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // The preference is optional; a storage failure must not break the app.
  }
}
