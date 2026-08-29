import { expect, test } from "@playwright/test"

test("directs a fresh device to mobile course creation", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("CVC Helper")
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Crea corso" })).toBeDisabled()
  await expect(
    page.getByText("I dati operativi restano su questo dispositivo."),
  ).toBeVisible()
})
