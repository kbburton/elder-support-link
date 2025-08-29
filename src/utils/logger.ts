export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  groupId?: string;
  documentId?: string;
  filename?: string;
  fileSize?: number;
  operation?: string;
  component?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private formatLog(entry: LogEntry): string {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const levelName = levelNames[entry.level];
    
    let logMessage = `[${entry.timestamp}] ${levelName}: ${entry.message}`;
    
    if (entry.context) {
      logMessage += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }
    
    if (entry.error) {
      logMessage += `\nError: ${entry.error.message}`;
      logMessage += `\nStack: ${entry.error.stack}`;
    }
    
    return logMessage;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      error,
    };

    const formattedLog = this.formatLog(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Specialized methods for document operations
  documentUploadStart(filename: string, fileSize: number, groupId: string, userId: string) {
    this.info('Document upload started', {
      operation: 'upload_start',
      component: 'DocumentUpload',
      filename,
      fileSize,
      groupId,
      userId,
    });
  }

  documentUploadSuccess(documentId: string, filename: string, processingStatus: string) {
    this.info('Document upload completed successfully', {
      operation: 'upload_success',
      component: 'DocumentUpload',
      documentId,
      filename,
      processingStatus,
    });
  }

  documentUploadError(filename: string, error: Error, context?: LogContext) {
    this.error('Document upload failed', {
      operation: 'upload_error',
      component: 'DocumentUpload',
      filename,
      ...context,
    }, error);
  }

  storageValidationStart(filename: string, storagePath: string) {
    this.info('Storage validation started', {
      operation: 'storage_validation',
      component: 'DocumentUpload',
      filename,
      storagePath,
    });
  }

  storageValidationSuccess(filename: string, storagePath: string, fileSize: number) {
    this.info('Storage validation successful', {
      operation: 'storage_validation_success',
      component: 'DocumentUpload',
      filename,
      storagePath,
      fileSize,
    });
  }

  storageValidationError(filename: string, storagePath: string, error: Error) {
    this.error('Storage validation failed', {
      operation: 'storage_validation_error',
      component: 'DocumentUpload',
      filename,
      storagePath,
    }, error);
  }

  rollbackStart(filename: string, storagePath: string, attempt: number) {
    this.warn('Rollback initiated', {
      operation: 'rollback_start',
      component: 'DocumentUpload',
      filename,
      storagePath,
      attempt,
    });
  }

  rollbackSuccess(filename: string, storagePath: string) {
    this.info('Rollback completed successfully', {
      operation: 'rollback_success',
      component: 'DocumentUpload',
      filename,
      storagePath,
    });
  }

  // Search operation logging methods
  searchQueryStarted(query: string, groupId: string, userId?: string) {
    this.info('Search query initiated', {
      operation: 'search_query_started',
      component: 'SearchPage',
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      queryLength: query.length,
      groupId,
      userId,
    });
  }

  searchQueryCompleted(query: string, resultCount: number, executionTime: number, groupId: string) {
    this.info('Search query completed', {
      operation: 'search_query_completed',
      component: 'SearchPage',
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      resultCount,
      executionTime,
      groupId,
    });
  }

  searchResultClicked(entityType: string, entityId: string, query: string, resultRank: number, groupId: string) {
    this.info('Search result clicked', {
      operation: 'search_result_clicked',
      component: 'SearchPage',
      entityType,
      entityId,
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      resultRank,
      groupId,
    });
  }

  searchFilterToggled(filterType: string, isActive: boolean, groupId: string) {
    this.info('Search filter toggled', {
      operation: 'search_filter_toggled',
      component: 'SearchPage',
      filterType,
      isActive,
      groupId,
    });
  }

  searchError(query: string, error: Error, groupId: string) {
    this.error('Search query failed', {
      operation: 'search_error',
      component: 'SearchPage',
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      groupId,
    }, error);
  }
}

export const logger = new Logger();

// Set debug level in development
if (import.meta.env.DEV) {
  logger.setLogLevel(LogLevel.DEBUG);
}