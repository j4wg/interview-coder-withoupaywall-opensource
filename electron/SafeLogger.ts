import fs from 'fs'
import path from 'path'
import { app } from 'electron'

class SafeLogger {
  private logDir: string
  private mainLogPath: string
  private shortcutLogPath: string

  constructor() {
    // Initialize log directory
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.mainLogPath = path.join(this.logDir, 'main-events.log')
    this.shortcutLogPath = path.join(this.logDir, 'shortcut-events.log')

    // Create logs directory if it doesn't exist
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch (error) {
      // Silently fail - we can't log the error since we're creating the logger
    }
  }

  private formatLogMessage(level: string, source: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    return `[${timestamp}] [${level}] [${source}] ${message}\n`
  }

  private writeToFile(filePath: string, message: string): void {
    try {
      // Check size limit before writing
      this.checkAndClearIfOverLimit()
      fs.appendFileSync(filePath, message, 'utf8')
    } catch (error) {
      // Silently fail - we can't use console.log here as it would cause the same issue
    }
  }

  // Main process logging
  mainLog(...args: any[]): void {
    const message = this.formatLogMessage('INFO', 'MAIN', ...args)
    this.writeToFile(this.mainLogPath, message)
  }

  mainError(...args: any[]): void {
    const message = this.formatLogMessage('ERROR', 'MAIN', ...args)
    this.writeToFile(this.mainLogPath, message)
  }

  mainWarn(...args: any[]): void {
    const message = this.formatLogMessage('WARN', 'MAIN', ...args)
    this.writeToFile(this.mainLogPath, message)
  }

  // Shortcut process logging
  shortcutLog(...args: any[]): void {
    const message = this.formatLogMessage('INFO', 'SHORTCUT', ...args)
    this.writeToFile(this.shortcutLogPath, message)
  }

  shortcutError(...args: any[]): void {
    const message = this.formatLogMessage('ERROR', 'SHORTCUT', ...args)
    this.writeToFile(this.shortcutLogPath, message)
  }

  shortcutWarn(...args: any[]): void {
    const message = this.formatLogMessage('WARN', 'SHORTCUT', ...args)
    this.writeToFile(this.shortcutLogPath, message)
  }

  // Generic logging method
  log(source: string, level: 'INFO' | 'ERROR' | 'WARN', ...args: any[]): void {
    const logPath = source === 'SHORTCUT' ? this.shortcutLogPath : this.mainLogPath
    const message = this.formatLogMessage(level, source, ...args)
    this.writeToFile(logPath, message)
  }

    // Check total log directory size
  private getDirectorySize(): number {
    try {
      let totalSize = 0
      const files = fs.readdirSync(this.logDir)

      files.forEach(file => {
        const filePath = path.join(this.logDir, file)
        const stats = fs.statSync(filePath)
        totalSize += stats.size
      })

      return totalSize
    } catch (error) {
      return 0
    }
  }

  // Clear all logs if size exceeds 1GB
  private checkAndClearIfOverLimit(): void {
    try {
      const sizeLimit = 1024 * 1024 * 1024 // 1GB in bytes
      const currentSize = this.getDirectorySize()

      if (currentSize > sizeLimit) {
        // Clear all log files
        const files = fs.readdirSync(this.logDir)
        files.forEach(file => {
          const filePath = path.join(this.logDir, file)
          try {
            fs.unlinkSync(filePath)
          } catch (error) {
            // Silently fail for individual file deletion
          }
        })

        // Log the cleanup action
        const message = this.formatLogMessage('INFO', 'SYSTEM', `Log directory cleared due to size limit (${(currentSize / 1024 / 1024).toFixed(2)}MB exceeded 1GB limit)`)
        this.writeToFile(this.mainLogPath, message)
      }
    } catch (error) {
      // Silently fail
    }
  }
}

// Create singleton instance
export const safeLogger = new SafeLogger()

// Convenience functions for backward compatibility
export const safeLog = (...args: any[]) => safeLogger.mainLog(...args)
export const safeError = (...args: any[]) => safeLogger.mainError(...args)
export const safeWarn = (...args: any[]) => safeLogger.mainWarn(...args)