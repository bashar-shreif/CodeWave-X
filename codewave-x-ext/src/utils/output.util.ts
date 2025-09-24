import * as vscode from "vscode";

let channel: vscode.OutputChannel | null = null;
export const getOutput = () => {
  if (!channel) channel = vscode.window.createOutputChannel("CodeWave");
  return channel;
};

export const log = (msg: string) => {
  const ch = getOutput();
  ch.appendLine(msg);
};
