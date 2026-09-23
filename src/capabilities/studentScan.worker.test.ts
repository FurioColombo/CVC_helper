import { beforeEach, describe, expect, it, vi } from "vitest"

const { createWorkerMock, recognizeMock, setParametersMock } = vi.hoisted(
  () => ({
    createWorkerMock: vi.fn(),
    recognizeMock: vi.fn(),
    setParametersMock: vi.fn(),
  }),
)

vi.mock("tesseract.js", () => ({
  createWorker: createWorkerMock,
  OEM: { LSTM_ONLY: 1 },
  PSM: { AUTO: 3 },
}))

import {
  MIN_FIELD_CONFIDENCE,
  scanStudents,
  TESSERACT_USER_DEFINED_DPI,
} from "@/capabilities/studentScan"

describe("local Tesseract worker setup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWorkerMock.mockResolvedValue({
      recognize: recognizeMock,
      setParameters: setParametersMock,
    })
    recognizeMock.mockResolvedValue({
      data: { confidence: 88, text: "Mario Rossi 12/03/2008", tsv: null },
    })
  })

  it("applies the measured DPI without lowering the field review threshold", async () => {
    await scanStudents(new Blob(["synthetic image bytes"]))

    expect(setParametersMock).toHaveBeenCalledWith({
      tessedit_pageseg_mode: 3,
      user_defined_dpi: String(TESSERACT_USER_DEFINED_DPI),
    })
    expect(TESSERACT_USER_DEFINED_DPI).toBe(180)
    expect(MIN_FIELD_CONFIDENCE).toBe(70)
  })
})
