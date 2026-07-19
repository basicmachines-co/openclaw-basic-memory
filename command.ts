import { accessSync, constants } from "node:fs"
import { delimiter, isAbsolute, resolve } from "node:path"

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function isCommandAvailable(
  command: string,
  pathValue = process.env.PATH,
): boolean {
  if (command.length === 0) {
    return false
  }

  if (isAbsolute(command) || command.includes("/")) {
    return isExecutable(command)
  }

  if (!pathValue) {
    return false
  }

  for (const directory of pathValue.split(delimiter)) {
    if (isExecutable(resolve(directory, command))) {
      return true
    }
  }

  return false
}
