export interface TerminalProgress {
  start(message: string): void;
  update(message: string): void;
  succeed(message: string): void;
  fail(message: string): void;
}

export interface TerminalProgressOptions {
  enabled: boolean;
  stream?: NodeJS.WriteStream;
  now?: () => number;
  refreshIntervalMs?: number;
  isCi?: boolean;
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

class NoopTerminalProgress implements TerminalProgress {
  start(_message: string): void {}
  update(_message: string): void {}
  succeed(_message: string): void {}
  fail(_message: string): void {}
}

class InteractiveTerminalProgress implements TerminalProgress {
  private message = "";
  private startedAt = 0;
  private frameIndex = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly stream: NodeJS.WriteStream,
    private readonly now: () => number,
    private readonly refreshIntervalMs: number
  ) {}

  start(message: string): void {
    this.stopTimer();
    this.message = message;
    this.startedAt = this.now();
    this.frameIndex = 0;
    this.render();
    this.timer = setInterval(() => this.render(), this.refreshIntervalMs);
    this.timer.unref?.();
  }

  update(message: string): void {
    this.message = message;
    this.render();
  }

  succeed(message: string): void {
    this.complete("✓", message);
  }

  fail(message: string): void {
    this.complete("✗", message);
  }

  private render(): void {
    const frame = frames[this.frameIndex % frames.length];
    this.frameIndex += 1;
    this.write(`\r\u001B[2K${frame} ${this.message} (${formatElapsed(this.now() - this.startedAt)} elapsed)`);
  }

  private complete(symbol: string, message: string): void {
    this.stopTimer();
    this.write(`\r\u001B[2K${symbol} ${message} (${formatElapsed(this.now() - this.startedAt)})\n`);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private write(message: string): void {
    this.stream.write(message);
  }
}

/**
 * Terminal-only feedback for long-running CLI work. It deliberately bypasses
 * Pino and OpenTelemetry so it cannot become an application log or Grafana event.
 */
export function createTerminalProgress({
  enabled,
  stream = process.stderr,
  now = performance.now.bind(performance),
  refreshIntervalMs = 125,
  isCi = process.env.CI !== undefined
}: TerminalProgressOptions): TerminalProgress {
  if (!enabled || isCi || stream.isTTY !== true) return new NoopTerminalProgress();
  return new InteractiveTerminalProgress(stream, now, refreshIntervalMs);
}
