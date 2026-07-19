import { afterEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runSetupScript } from "./slash.ts"

describe("runSetupScript", () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it("runs paths containing shell syntax as literal arguments", () => {
    const directory = mkdtempSync(join(tmpdir(), "bm-setup-"))
    temporaryDirectories.push(directory)

    const quotedDirectory = join(directory, 'path"; exit 7; #')
    mkdirSync(quotedDirectory)
    const scriptPath = join(quotedDirectory, "setup.sh")
    writeFileSync(scriptPath, 'printf "setup complete\\n"\n')

    expect(runSetupScript(scriptPath)).toBe("setup complete\n")
  })
})
