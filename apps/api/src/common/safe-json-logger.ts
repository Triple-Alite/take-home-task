import { LoggerService } from '@nestjs/common';

const SENSITIVE_KEY = /(authorization|token|password|secret|cookie|email|credential)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(entry)]));
  }
  return value;
}

export class SafeJsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string): void {
    const entry = redact({ timestamp: new Date().toISOString(), level, context, message });
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }

  log(message: unknown, context?: string): void { this.write('info', message, context); }
  error(message: unknown, _stack?: string, context?: string): void { this.write('error', message, context); }
  warn(message: unknown, context?: string): void { this.write('warn', message, context); }
  debug(message: unknown, context?: string): void { this.write('debug', message, context); }
  verbose(message: unknown, context?: string): void { this.write('debug', message, context); }
  fatal(message: unknown, context?: string): void { this.write('fatal', message, context); }
}
