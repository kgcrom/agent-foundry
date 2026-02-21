import { spyOn } from "bun:test";

export interface ConsoleCapture {
  logs: string[];
  errors: string[];
  restore: () => void;
}

export function captureConsole(): ConsoleCapture {
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});

  return {
    get logs() {
      return logSpy.mock.calls.map((args) => formatArgs(args as unknown[]));
    },
    get errors() {
      return errorSpy.mock.calls.map((args) => formatArgs(args as unknown[]));
    },
    restore: () => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      return String(arg);
    })
    .join(" ");
}
