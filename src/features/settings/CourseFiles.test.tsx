import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  exportCourseArchive: vi.fn(),
  importCourseArchive: vi.fn(),
  parseCourseArchive: vi.fn(),
  archiveSummary: vi.fn(),
  persistentStorageStatus: vi.fn(),
  announceCourseReplacement: vi.fn(),
  resetAllLocalData: vi.fn(),
}))

vi.mock("@/persistence/courseArchive", () => ({
  exportCourseArchive: mocks.exportCourseArchive,
  importCourseArchive: mocks.importCourseArchive,
}))

vi.mock("@/persistence/courseArchiveFormat", () => ({
  parseCourseArchive: mocks.parseCourseArchive,
  archiveSummary: mocks.archiveSummary,
  CourseArchiveError: class CourseArchiveError extends Error {
    constructor(code: string) {
      super(
        code === "invalid-format"
          ? "Il file non è un archivio valido di CVC Helper."
          : "Dati archivio non validi.",
      )
    }
  },
}))

vi.mock("@/persistence/browserStorage", () => ({
  persistentStorageStatus: mocks.persistentStorageStatus,
}))

vi.mock("@/persistence/localDataOperations", () => ({
  announceCourseReplacement: mocks.announceCourseReplacement,
  resetAllLocalData: mocks.resetAllLocalData,
}))

import {
  CourseFiles,
  FullReset,
  StorageStatus,
} from "@/features/settings/CourseFiles"
import {
  CourseArchiveError,
  type CourseArchive,
} from "@/persistence/courseArchiveFormat"

const archive = { format: "test-archive" } as unknown as CourseArchive

function mockArchiveFile(contents = "archivio valido") {
  const file = new File([contents], "corso.json", { type: "application/json" })
  Object.defineProperty(file, "text", { value: async () => contents })
  return file
}

function uploadTarget(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Archive picker is missing")
  return input
}

describe("CourseFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.exportCourseArchive.mockResolvedValue(archive)
    mocks.importCourseArchive.mockResolvedValue(undefined)
    mocks.parseCourseArchive.mockReturnValue(archive)
    mocks.archiveSummary.mockReturnValue({
      label: "D2 - 35 | 2026",
      students: 23,
      volunteers: 2,
      boats: 8,
    })
    mocks.persistentStorageStatus.mockResolvedValue("denied")
    mocks.resetAllLocalData.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps import available without a course and warns about personal data before export", () => {
    const { rerender } = render(<CourseFiles hasCourse={false} />)

    expect(
      screen.getByRole("button", { name: "Scegli il file del corso" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Prepara il file del corso" }),
    ).not.toBeInTheDocument()

    rerender(<CourseFiles hasCourse />)

    expect(
      screen.getByText(/Il file contiene i dati personali degli allievi/),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Prepara il file del corso" }),
    ).toBeVisible()
  })

  it("does not offer a share action until the user taps it after preparing the file", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    const oldShare = Object.getOwnPropertyDescriptor(navigator, "share")
    const oldCanShare = Object.getOwnPropertyDescriptor(navigator, "canShare")
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    })
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: canShare,
    })

    try {
      const user = userEvent.setup()
      render(<CourseFiles hasCourse />)

      await user.click(
        screen.getByRole("button", { name: "Prepara il file del corso" }),
      )
      const shareButton = await screen.findByRole("button", {
        name: "Condividi",
      })
      expect(share).not.toHaveBeenCalled()

      await user.click(shareButton)

      expect(share).toHaveBeenCalledOnce()
      expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] })
      // Android Chrome refuses to share JSON files: the shared copy is text.
      const shared = share.mock.calls[0]?.[0].files[0] as File
      expect(shared.name).toMatch(/^cvc-helper-corso-\d{4}-W\d{2}\.txt$/)
      expect(shared.type).toBe("text/plain")
      expect(canShare).toHaveBeenCalledWith({ files: [shared] })
    } finally {
      if (oldShare) Object.defineProperty(navigator, "share", oldShare)
      else Reflect.deleteProperty(navigator, "share")
      if (oldCanShare) Object.defineProperty(navigator, "canShare", oldCanShare)
      else Reflect.deleteProperty(navigator, "canShare")
    }
  })

  it("shows a safe error for an invalid archive and never calls import", async () => {
    const user = userEvent.setup()
    const { container } = render(<CourseFiles hasCourse />)
    mocks.parseCourseArchive.mockImplementation(() => {
      throw new CourseArchiveError("invalid-format")
    })

    await user.upload(
      uploadTarget(container),
      mockArchiveFile("not an archive"),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Il file non è un archivio valido di CVC Helper.",
    )
    expect(mocks.importCourseArchive).not.toHaveBeenCalled()
    expect(screen.queryByText("Corso trovato")).not.toBeInTheDocument()
  })

  it("requires explicit replacement confirmation before importing and announces success", async () => {
    const user = userEvent.setup()
    const { container } = render(<CourseFiles hasCourse />)

    await user.upload(uploadTarget(container), mockArchiveFile())
    expect(await screen.findByText("Corso trovato")).toBeVisible()
    expect(screen.getByText("D2 - 35 | 2026")).toBeVisible()
    const replaceButton = screen.getByRole("button", {
      name: "Sostituisci il corso",
    })
    expect(replaceButton).toBeDisabled()
    expect(mocks.importCourseArchive).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("checkbox", {
        name: "Ho capito: il corso attuale sarà sostituito",
      }),
    )
    await user.click(replaceButton)

    await waitFor(() =>
      expect(mocks.importCourseArchive).toHaveBeenCalledWith(archive),
    )
    expect(mocks.announceCourseReplacement).toHaveBeenCalledOnce()
    expect(
      await screen.findByText(
        "Corso importato. L’app sta caricando i nuovi dati.",
      ),
    ).toBeVisible()
  })

  it("asks for a separate acknowledgement before full local reset", async () => {
    const user = userEvent.setup()
    render(<FullReset courseLabel="D2 - 35 | 2026" />)

    await user.click(
      screen.getByRole("button", { name: "Azzera tutti i dati locali" }),
    )
    const resetButton = screen.getByRole("button", { name: "Azzera i dati" })
    expect(resetButton).toBeDisabled()
    expect(
      screen.getByText(/I file già salvati fuori dall’app resteranno/),
    ).toBeVisible()
    expect(mocks.resetAllLocalData).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("checkbox", {
        name: /corso, preferenze e file offline/,
      }),
    )
    await user.click(resetButton)

    expect(mocks.resetAllLocalData).toHaveBeenCalledOnce()
  })

  it("reports when the browser declined persistent storage", async () => {
    render(<StorageStatus />)

    expect(
      await screen.findByText(/Il browser non garantisce la conservazione/),
    ).toBeVisible()
  })
})

describe("the prepared course file after the owner's phone check", () => {
  it("moves focus to Salva file, offers no close button and shows a failed share as an error", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      )
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    })
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    })
    try {
      const user = userEvent.setup()
      render(<CourseFiles hasCourse />)

      await user.click(
        screen.getByRole("button", { name: "Prepara il file del corso" }),
      )

      const save = await screen.findByRole("button", { name: "Salva file" })
      expect(save).toHaveFocus()
      expect(
        screen.getByText(/File del corso pronto: ora salvalo o condividilo/),
      ).toBeVisible()
      expect(
        screen.queryByRole("button", { name: "Chiudi il file pronto" }),
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Condividi" }))

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent(
        "Condivisione non riuscita. Puoi salvare il file con Salva file.",
      )
      expect(alert.querySelector("svg")).not.toBeNull()
    } finally {
      Reflect.deleteProperty(navigator, "share")
      Reflect.deleteProperty(navigator, "canShare")
    }
  })

  it("accepts the shared text copy when importing", () => {
    const { container } = render(<CourseFiles hasCourse />)
    const accept = uploadTarget(container).getAttribute("accept") ?? ""
    expect(accept.split(",")).toEqual(
      expect.arrayContaining([".json", ".txt", "text/plain"]),
    )
  })

  it("marks an import error with the warning triangle", async () => {
    const user = userEvent.setup()
    const { container } = render(<CourseFiles hasCourse />)
    mocks.parseCourseArchive.mockImplementation(() => {
      throw new CourseArchiveError("invalid-format")
    })

    await user.upload(uploadTarget(container), mockArchiveFile("x"))

    const alert = await screen.findByRole("alert")
    expect(alert.querySelector("svg[aria-hidden='true']")).not.toBeNull()
  })
})
