type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};
  private component: string;

  constructor(component: string, initialContext: LogContext = {}) {
    this.component = component;
    this.context = initialContext;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx = { ...this.context, ...context };
    const contextStr = Object.keys(ctx).length > 0 ? ` | ${JSON.stringify(ctx)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext) {
    console.debug(this.formatMessage('debug', message, context));
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, contextOrError?: LogContext | Error, error?: Error) {
    // Support both signatures: (message, context, error) and (message, context)
    let ctx: LogContext = {};
    let err: Error | undefined;
    
    if (contextOrError instanceof Error) {
      err = contextOrError;
    } else if (contextOrError) {
      ctx = contextOrError;
      err = error;
    }
    
    const errorContext = err 
      ? { error: err.message, stack: err.stack, ...ctx }
      : ctx;
    console.warn(this.formatMessage('warn', message, errorContext));
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error) {
    // Support both signatures: (message, context, error) and (message, error, context)
    let ctx: LogContext = {};
    let err: Error | undefined;
    
    if (contextOrError instanceof Error) {
      err = contextOrError;
      ctx = error as any || {};
    } else if (contextOrError) {
      ctx = contextOrError;
      err = error;
    }
    
    const errorContext = err 
      ? { error: err.message, stack: err.stack, ...ctx }
      : ctx;
    console.error(this.formatMessage('error', message, errorContext));
  }

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  child(childComponent: string, additionalContext?: LogContext): Logger {
    return new Logger(
      `${this.component}:${childComponent}`,
      { ...this.context, ...additionalContext }
    );
  }

  // Custom methods for backward compatibility with DocumentUpload
  documentUploadStart(fileName: string, fileSize: number, groupId: string, userId: string) {
    this.info('Document upload started', { fileName, fileSize, groupId, userId });
  }

  documentUploadSuccess(documentId: string, fileName: string, status: string) {
    this.info('Document upload successful', { documentId, fileName, status });
  }

  documentUploadError(fileName: string, error: Error, context: LogContext) {
    this.error('Document upload failed', { fileName, ...context }, error);
  }

  // Custom methods for backward compatibility with SearchPage
  searchQueryStarted(query: string, groupId: string) {
    this.info('Search query started', { query, groupId });
  }

  searchQueryCompleted(query: string, resultCount: number, duration: number, groupId: string) {
    this.info('Search query completed', { query, resultCount, duration, groupId });
  }

  searchError(query: string, error: Error, groupId: string) {
    this.error('Search error', { query, groupId }, error);
  }

  searchFilterToggled(entityType: string, isActive: boolean, groupId: string) {
    this.info('Search filter toggled', { entityType, isActive, groupId });
  }

  searchResultClicked(entityType: string, entityId: string, query: string, rank: number, groupId: string) {
    this.info('Search result clicked', { entityType, entityId, query, rank, groupId });
  }
}

export function createLogger(component: string, context?: LogContext): Logger {
  return new Logger(component, context);
}

export default Logger;
