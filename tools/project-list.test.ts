import { beforeEach, describe, expect, it, jest } from "bun:test"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { BmClient } from "../bm-client.ts"
import { registerProjectListTool } from "./project-list.ts"

describe("project list tool", () => {
  let mockApi: OpenClawPluginApi
  let mockClient: BmClient

  beforeEach(() => {
    mockApi = {
      registerTool: jest.fn(),
    } as any

    mockClient = {
      listProjects: jest.fn(),
    } as any
  })

  it("registers bm_project_list with expected shape", () => {
    registerProjectListTool(mockApi, mockClient)

    expect(mockApi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "bm_project_list",
        label: "List Projects",
        description: "List all Basic Memory projects accessible to this agent",
        parameters: expect.objectContaining({
          type: "object",
          properties: {},
        }),
        execute: expect.any(Function),
      }),
      { name: "bm_project_list" },
    )
  })

  it("formats and returns projects with required fields", async () => {
    registerProjectListTool(mockApi, mockClient)
    const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
      .calls[0]
    const execute = registerCall[0].execute

    ;(mockClient.listProjects as jest.MockedFunction<any>).mockResolvedValue([
      {
        name: "alpha",
        path: "/tmp/alpha",
        display_name: "Alpha Project",
        is_private: true,
        is_default: true,
      },
      {
        name: "beta",
        path: "/tmp/beta",
        is_private: false,
      },
    ])

    const result = await execute("call-1", {})

    expect(mockClient.listProjects).toHaveBeenCalledWith()
    expect(result.content[0].text).toContain("Found 2 project(s):")
    expect(result.content[0].text).toContain("**alpha** (default)")
    expect(result.content[0].text).toContain("Display Name: Alpha Project")
    expect(result.content[0].text).toContain("Private: false")
    expect(result.details).toEqual({
      count: 2,
      projects: [
        {
          name: "alpha",
          path: "/tmp/alpha",
          display_name: "Alpha Project",
          is_private: true,
          is_default: true,
        },
        {
          name: "beta",
          path: "/tmp/beta",
          display_name: null,
          is_private: false,
          is_default: false,
        },
      ],
    })
  })

  it("handles empty project list", async () => {
    registerProjectListTool(mockApi, mockClient)
    const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
      .calls[0]
    const execute = registerCall[0].execute

    ;(mockClient.listProjects as jest.MockedFunction<any>).mockResolvedValue([])

    const result = await execute("call-1", {})

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "No Basic Memory projects found.",
        },
      ],
      details: {
        count: 0,
        projects: [],
      },
    })
  })

  it("handles listProjects errors gracefully", async () => {
    registerProjectListTool(mockApi, mockClient)
    const registerCall = (mockApi.registerTool as jest.MockedFunction<any>).mock
      .calls[0]
    const execute = registerCall[0].execute

    ;(mockClient.listProjects as jest.MockedFunction<any>).mockRejectedValue(
      new Error("boom"),
    )

    const result = await execute("call-1", {})

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Failed to list Basic Memory projects. Is Basic Memory running? Check logs for details.",
        },
      ],
    })
  })
})
