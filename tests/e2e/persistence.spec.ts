import { expect, test } from "@playwright/test"

test("persists a representative local write across reload", async ({
  page,
}) => {
  await page.goto("/")
  const verifyButton = page.getByRole("button", {
    name: "Verifica persistenza",
  })
  await expect(verifyButton).toBeEnabled()

  await verifyButton.click()
  await expect(page.getByText("Verifiche persistenti: 1")).toBeVisible()

  await page.reload()
  await expect(page.getByText("Verifiche persistenti: 1")).toBeVisible()

  await verifyButton.click()
  await expect(page.getByText("Verifiche persistenti: 2")).toBeVisible()
})
