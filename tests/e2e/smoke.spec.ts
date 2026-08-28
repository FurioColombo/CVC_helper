import { expect, test } from "@playwright/test"

test("loads the mobile-first CVC foundation shell", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("CVC Helper")
  await expect(page.getByRole("heading", { name: "CVC Helper" })).toBeVisible()
  await expect(page.getByText("Archivio locale pronto")).toBeVisible()
  await expect(
    page.getByText("I dati operativi restano su questo dispositivo."),
  ).toBeVisible()
})
