import { describe, expect, it } from "vitest"

import {
  classifyUploadFailure,
  ERASED_COURSE_CODE,
  OUTDATED_WRITER_CODE,
  type UploadOutcome,
} from "@/backup/uploadPolicy"

const retry: UploadOutcome = { kind: "retry" }
const refused = (reason: string) => ({ kind: "refused", reason })

describe("what a failed upload means", () => {
  it.each([
    ["no response (offline)", { status: 0 }, "students", retry],
    ["server error", { status: 503 }, "students", retry],
    ["gateway timeout", { status: 504, code: "" }, "students", retry],
    ["too many requests", { status: 429 }, "students", retry],
    ["request timeout", { status: 408 }, "students", retry],
    ["expired session", { status: 401, code: "PGRST301" }, "students", retry],
    ["serialization failure", { status: 500, code: "40001" }, "crews", retry],
    ["deadlock", { status: 500, code: "40P01" }, "crews", retry],
    ["too many connections", { status: 500, code: "53300" }, "crews", retry],
    ["unknown status", { status: 418 }, "students", retry],
    [
      "app older than the minimum writer",
      { status: 400, code: OUTDATED_WRITER_CODE },
      "students",
      { kind: "outdated" },
    ],
    [
      "course erased from the backup on another device",
      { status: 400, code: ERASED_COURSE_CODE },
      "courses",
      refused("erased"),
    ],
    [
      "course id of another account, updated",
      { status: 403, code: "42501" },
      "courses",
      refused("other-account"),
    ],
    [
      "course id of another account, inserted",
      { status: 409, code: "23505" },
      "courses",
      refused("other-account"),
    ],
    [
      "child of a course this account does not own",
      { status: 403, code: "42501" },
      "students",
      refused("access"),
    ],
    [
      "child before its course",
      { status: 409, code: "23503" },
      "students",
      refused("data"),
    ],
    [
      "missing course id",
      { status: 400, code: "23502" },
      "evaluations",
      refused("data"),
    ],
    [
      "a value of the wrong type",
      { status: 400, code: "22P02" },
      "boats",
      refused("data"),
    ],
    [
      "a column the server does not have",
      { status: 400, code: "PGRST204" },
      "boats",
      refused("data"),
    ],
    [
      "a table the server does not have",
      { status: 404, code: "42P01" },
      "boats",
      refused("data"),
    ],
  ] as const)("%s", (_name, failure, table, expected) => {
    expect(classifyUploadFailure(failure, table)).toEqual(expected)
  })

  it("never refuses for good what may succeed later", () => {
    for (const status of [0, 401, 408, 429, 500, 502, 503, 504])
      expect(classifyUploadFailure({ status }, "students").kind).toBe("retry")
  })
})
