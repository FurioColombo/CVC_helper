import { expect, test } from "@playwright/test"

test("creates and restores the active course with the required shell", async ({
  page,
}) => {
  await page.goto("/")

  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  const proposedLabel = page.getByText(/^D2 \d{1,2} \d{4}$/)
  await expect(proposedLabel).toBeVisible()
  const label = await proposedLabel.textContent()

  await page.getByRole("button", { name: "Crea corso" }).click()
  await expect(page.getByRole("heading", { name: label ?? "" })).toBeVisible()

  const navigation = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await expect(navigation.getByRole("button")).toHaveText([
    "Avarie",
    "Home",
    "Equipaggi",
  ])
  await expect(page.getByRole("button", { name: "Allievi" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Barche" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Comandate" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Valutazioni" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Volontari" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Equipaggi" })).toHaveCount(2)

  await page.getByRole("button", { name: "Impostazioni" }).click()
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible()
  await navigation.getByRole("button", { name: "Home" }).click()

  await page.reload()
  await expect(page.getByRole("heading", { name: label ?? "" })).toBeVisible()

  await navigation.getByRole("button", { name: "Avarie" }).click()
  await expect(page.getByRole("heading", { name: "Avarie" })).toBeVisible()
  await navigation.getByRole("button", { name: "Equipaggi" }).click()
  await expect(page.getByRole("heading", { name: "Equipaggi" })).toBeVisible()
  await navigation.getByRole("button", { name: "Home" }).click()
  await expect(page.getByRole("heading", { name: label ?? "" })).toBeVisible()
})
