type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 50;
  private listeners: Set<() => void> = new Set();

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  }

  private addLog(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Also log to console with formatting
    const prefix = `[${this.formatTime(entry.timestamp)}] [${level.toUpperCase()}]`;
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    
    if (data !== undefined) {
      consoleMethod(`${prefix} ${message}`, data);
    } else {
      consoleMethod(`${prefix} ${message}`);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener());
  }

  info(message: string, data?: unknown) {
    this.addLog("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.addLog("warn", message, data);
  }

  error(message: string, data?: unknown) {
    this.addLog("error", message, data);
  }

  debug(message: string, data?: unknown) {
    this.addLog("debug", message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const logger = new Logger();

