import { expect, test } from "@playwright/test"

test("decodes a deterministic audio fixture through the local speech boundary", async ({
  page,
}) => {
  await page.goto("/")

  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/u03SpeechHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runU03SpeechFixtureHarness: () => Promise<{
        audioBytes: number
        decodedPeak: number
        decodedSamples: number
        firstProgress: string[]
        firstText: string
        modelLoads: number
        secondProgress: string[]
        secondText: string
      }>
    }
    return harness.runU03SpeechFixtureHarness()
  })

  expect(result.audioBytes).toBeGreaterThan(6_000)
  expect(result.decodedSamples).toBeGreaterThan(3_000)
  expect(result.decodedPeak).toBeGreaterThan(0.2)
  expect(result.firstText).toBe("virata precisa")
  expect(result.secondText).toBe("virata precisa")
  expect(result.firstProgress).toEqual([
    "loading:unknown",
    "loading:25",
    "loading:100",
    "processing:unknown",
  ])
  expect(result.secondProgress).toEqual(["processing"])
  expect(result.modelLoads).toBe(1)
})
