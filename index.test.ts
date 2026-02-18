import { afterEach, describe, expect, it, jest } from "bun:test"
import { BmClient } from "./bm-client.ts"
import plugin from "./index.ts"

describe("plugin service lifecycle", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("starts MCP client, ensures project path, and stops cleanly", async () => {
    const startSpy = jest
      .spyOn(BmClient.prototype, "start")
      .mockResolvedValue(undefined)
    const ensureProjectSpy = jest
      .spyOn(BmClient.prototype, "ensureProject")
      .mockResolvedValue(undefined)
    const stopSpy = jest
      .spyOn(BmClient.prototype, "stop")
      .mockResolvedValue(undefined)

    const services: Array<{
      id: string
      start: (ctx: { workspaceDir?: string }) => Promise<void>
      stop: () => Promise<void>
    }> = []

    const api = {
      pluginConfig: {
        project: "test-project",
        projectPath: "memory/",
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      registerTool: jest.fn(),
      registerCommand: jest.fn(),
      registerCli: jest.fn(),
      registerService: jest.fn((service: any) => {
        services.push(service)
      }),
      on: jest.fn(),
    }

    plugin.register(api as any)

    expect(services).toHaveLength(1)

    await services[0].start({ workspaceDir: "/tmp/workspace" })

    expect(startSpy).toHaveBeenCalledWith({ cwd: "/tmp/workspace" })
    expect(ensureProjectSpy).toHaveBeenCalledWith("/tmp/workspace/memory")

    await services[0].stop()

    expect(stopSpy).toHaveBeenCalledTimes(1)
  })
})
