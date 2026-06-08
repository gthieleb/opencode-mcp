import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OpenCodeClient } from "../client.js";
import { toolError, toolResult, toolJson, directoryParam, destructive, readOnly } from "../helpers.js";

/** Format a single workspace object into a compact human-readable summary. */
function formatWorkspace(raw: unknown): string {
  const w = raw as Record<string, unknown>;
  if (!w || typeof w !== "object") return JSON.stringify(raw);
  const lines: string[] = [];
  if (w.id) lines.push(`ID: ${w.id}`);
  if (w.name) lines.push(`Name: ${w.name}`);
  if (w.type) lines.push(`Type: ${w.type}`);
  if (w.branch) lines.push(`Branch: ${w.branch}`);
  if (w.directory) lines.push(`Directory: ${w.directory}`);
  if (w.projectID) lines.push(`Project: ${w.projectID}`);
  if (w.timeUsed) lines.push(`Time Used: ${w.timeUsed}`);
  if (w.extra) lines.push(`Extra: ${JSON.stringify(w.extra)}`);
  return lines.length > 0 ? lines.join("\n") : JSON.stringify(raw);
}

export function registerWorkspaceTools(
  server: McpServer,
  client: OpenCodeClient,
) {
  server.tool(
    "opencode_workspace_list",
    "List all workspaces. (experimental)",
    {
      directory: directoryParam,
    },
    readOnly,
    async ({ directory }) => {
      try {
        const raw = await client.get("/experimental/workspace", undefined, directory);
        const workspaces = Array.isArray(raw) ? raw as Array<Record<string, unknown>> : [];
        if (workspaces.length === 0) {
          return toolResult("No workspaces found.");
        }
        const lines = workspaces.map((w) => {
          const name = w.name ?? w.id ?? "(unnamed)";
          const type = w.type ?? "unknown";
          const branch = w.branch ? ` [${w.branch}]` : "";
          return `- ${name} (${type})${branch}`;
        });
        return toolResult(`## Workspaces (${workspaces.length})\n${lines.join("\n")}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_create",
    "Create a new workspace. (experimental)",
    {
      type: z.string().describe("Workspace type"),
      id: z.string().optional().describe("Workspace ID (optional)"),
      branch: z.string().optional().describe("Git branch (optional)"),
      extra: z.string().optional().describe("Extra configuration (optional)"),
      directory: directoryParam,
    },
    async ({ type, id, branch, extra, directory }) => {
      try {
        const body: Record<string, string> = { type };
        if (id) body.id = id;
        if (branch) body.branch = branch;
        if (extra) body.extra = extra;
        const workspace = await client.post("/experimental/workspace", body, { directory });
        return toolResult(`Workspace created.\n\n${formatWorkspace(workspace)}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_remove",
    "Remove a workspace by ID. (experimental)",
    {
      id: z.string().describe("Workspace ID to remove"),
      directory: directoryParam,
    },
    destructive,
    async ({ id, directory }) => {
      try {
        await client.delete(`/experimental/workspace/${id}`, undefined, directory);
        return toolResult(`Workspace ${id} removed.`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_warp",
    "Warp into or detach from a workspace. (experimental)",
    {
      sessionID: z.string().describe("Session ID"),
      id: z.string().optional().describe("Workspace ID (optional)"),
      copyChanges: z.boolean().optional().describe("Copy changes (optional)"),
      directory: directoryParam,
    },
    async ({ sessionID, id, copyChanges, directory }) => {
      try {
        const body: Record<string, unknown> = { sessionID };
        if (id) body.id = id;
        if (copyChanges !== undefined) body.copyChanges = copyChanges;
        const result = await client.post("/experimental/workspace/warp", body, { directory });
        const r = result as Record<string, unknown>;
        const message = r.message ?? (r.detached ? "Detached from workspace." : "Warped into workspace.");
        return toolResult(`${message}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_status",
    "Get status for all workspaces. (experimental)",
    {
      directory: directoryParam,
    },
    readOnly,
    async ({ directory }) => {
      try {
        const raw = await client.get("/experimental/workspace/status", undefined, directory);
        const statuses = raw && typeof raw === "object" && !Array.isArray(raw)
          ? raw as Record<string, unknown>
          : {};
        const entries = Object.entries(statuses);
        if (entries.length === 0) {
          return toolResult("No workspace status available.");
        }
        const lines = entries.map(([workspaceID, status]) => `- ${workspaceID}: ${status}`);
        return toolResult(`## Workspace Status (${entries.length})\n${lines.join("\n")}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_sync_list",
    "Synchronize workspace adapters. (experimental)",
    {
      directory: directoryParam,
    },
    async ({ directory }) => {
      try {
        await client.post("/experimental/workspace/sync-list", undefined, { directory });
        return toolResult("Workspace adapters synchronized.");
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "opencode_workspace_adapter_list",
    "List all workspace adapters. (experimental)",
    {
      directory: directoryParam,
    },
    readOnly,
    async ({ directory }) => {
      try {
        const raw = await client.get("/experimental/workspace/adapter", undefined, directory);
        const adapters = Array.isArray(raw) ? raw as Array<Record<string, unknown>> : [];
        if (adapters.length === 0) {
          return toolResult("No workspace adapters found.");
        }
        const lines = adapters.map((a) => {
          const type = a.type ?? "unknown";
          const name = a.name ?? "(unnamed)";
          const description = a.description ? ` — ${a.description}` : "";
          return `- ${type}: ${name}${description}`;
        });
        return toolResult(`## Workspace Adapters (${adapters.length})\n${lines.join("\n")}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
