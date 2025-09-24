import { report } from "process";
import * as vscode from "vscode";

export type UploadCaps = { maxFiles: number; maxBytes: number };

export const getConfig = () => {
  const repo_name = vscode.workspace.workspaceFolders || "none";
  const cfg = vscode.workspace.getConfiguration();
  const baseUrl = process.env.BACKEND_BASE_URL || "http://localhost:3000";
  const projectId = repo_name;
  const caps: UploadCaps = {
    maxFiles: cfg.get<number>("codewave.upload.maxFiles", 100_000),
    maxBytes: cfg.get<number>("codewave.upload.maxBytes", 200_000_000),
  };
  return { baseUrl, projectId, caps };
};
