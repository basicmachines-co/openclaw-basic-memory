import { describe, expect, it } from "bun:test"
import { basename, dirname } from "node:path"
import { isCommandAvailable } from "./command.ts"

describe("isCommandAvailable", () => {
  const executable = basename(process.execPath)
  const executableDirectory = dirname(process.execPath)

  it("finds an executable by absolute path", () => {
    expect(isCommandAvailable(process.execPath)).toBe(true)
  })

  it("finds an executable on the supplied path", () => {
    expect(isCommandAvailable(executable, executableDirectory)).toBe(true)
  })

  it("rejects missing commands and shell syntax", () => {
    expect(
      isCommandAvailable(`${executable}; exit 0`, executableDirectory),
    ).toBe(false)
  })
})
