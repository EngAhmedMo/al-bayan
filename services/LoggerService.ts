import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

class LoggerServiceInterface {
    private LOG_DIR = 'logs';
    private MAX_LOG_AGE_DAYS = 2;
    private isInitialized = false;
    private originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug,
    };

    /**
     * Initialize the logger: create directory and intercept console
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Ensure log directory exists
            await this.ensureLogDirectory();

            // Prune old logs on startup
            this.pruneOldLogs();

            // Intercept console methods
            this.interceptConsole();

            this.isInitialized = true;
            this.log('system', 'LoggerService initialized');
        } catch (error) {
            console.error('Failed to initialize LoggerService:', error);
        }
    }

    private async ensureLogDirectory() {
        try {
            await Filesystem.mkdir({
                path: this.LOG_DIR,
                directory: Directory.Data,
                recursive: true,
            });
        } catch (e) {
            // Ignore if exists
        }
    }

    private interceptConsole() {
        const formatMessage = (args: any[]) => {
            return args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
        };

        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.log('INFO', formatMessage(args));
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.log('WARN', formatMessage(args));
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.log('ERROR', formatMessage(args));
        };

        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.log('INFO', formatMessage(args));
        };

        console.debug = (...args) => {
            this.originalConsole.debug(...args);
            this.log('DEBUG', formatMessage(args));
        };
    }

    private getLogFileName(date = new Date()): string {
        const isoDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        return `${this.LOG_DIR}/app-log-${isoDate}.txt`;
    }

    private async log(level: string, message: string) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;

        try {
            await Filesystem.appendFile({
                path: this.getLogFileName(),
                data: logEntry,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });
        } catch (e) {
            // If append fails, fallback to original console (which might loop if not careful, 
            // but we are calling originalConsole inside interceptConsole, so this catch is just for filesystem errors)
            this.originalConsole.error('Failed to write to log file:', e);
        }
    }

    /**
     * Delete logs older than MAX_LOG_AGE_DAYS
     */
    private async pruneOldLogs() {
        try {
            const result = await Filesystem.readdir({
                path: this.LOG_DIR,
                directory: Directory.Data,
            });

            const now = new Date();
            const msPerDay = 24 * 60 * 60 * 1000;

            for (const file of result.files) {
                // Expected format: app-log-YYYY-MM-DD.txt
                const match = file.name.match(/app-log-(\d{4}-\d{2}-\d{2})\.txt/);
                if (match) {
                    const fileDate = new Date(match[1]);
                    const ageInMs = now.getTime() - fileDate.getTime();
                    const ageInDays = ageInMs / msPerDay;

                    if (ageInDays > this.MAX_LOG_AGE_DAYS) {
                        await Filesystem.deleteFile({
                            path: `${this.LOG_DIR}/${file.name}`,
                            directory: Directory.Data,
                        });
                        this.originalConsole.log(`Deleted old log file: ${file.name}`);
                    }
                }
            }
        } catch (e) {
            this.originalConsole.error('Error pruning logs:', e);
        }
    }

    /**
     * Reads all log files from the last 7 days and combines them into one string/file for export
     */
    async getCombinesLogFilePath(): Promise<string> {
        try {
            const result = await Filesystem.readdir({
                path: this.LOG_DIR,
                directory: Directory.Data,
            });

            // Filter and sort files
            const logFiles = result.files
                .filter(f => f.name.startsWith('app-log-') && f.name.endsWith('.txt'))
                .sort((a, b) => a.name.localeCompare(b.name));

            let combinedParams = "--- DEVICE INFO ---\n";
            combinedParams += `UserAgent: ${navigator.userAgent}\n`;
            combinedParams += `Time: ${new Date().toISOString()}\n`;
            combinedParams += "-------------------\n\n";

            for (const file of logFiles) {
                try {
                    const contents = await Filesystem.readFile({
                        path: `${this.LOG_DIR}/${file.name}`,
                        directory: Directory.Data,
                        encoding: Encoding.UTF8,
                    });
                    combinedParams += `\n=== START LOG: ${file.name} ===\n`;
                    combinedParams += contents.data;
                    combinedParams += `\n=== END LOG: ${file.name} ===\n`;
                } catch (err) {
                    combinedParams += `\n[Error reading ${file.name}]\n`;
                }
            }

            // Write to a temporary export file
            const exportFileName = 'al-bayan-debug-report.txt';
            // Check if we can write to Cache, often better for sharing temporarily
            // But Directory.Data is safer for availability. Let's use Directory.Cache if possible, 
            // fallback to Data. Capacitor Share plugin works well with Cache.

            await Filesystem.writeFile({
                path: exportFileName,
                data: combinedParams,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });

            // Get the full URI
            const uriResult = await Filesystem.getUri({
                path: exportFileName,
                directory: Directory.Cache
            });

            return uriResult.uri;

        } catch (e) {
            this.originalConsole.error('Error exporting logs:', e);
            throw e;
        }
    }

    /**
     * Manually clear all log files
     */
    async clearLogs(): Promise<void> {
        try {
            const result = await Filesystem.readdir({
                path: this.LOG_DIR,
                directory: Directory.Data,
            });

            for (const file of result.files) {
                if (file.name.startsWith('app-log-') && file.name.endsWith('.txt')) {
                    await Filesystem.deleteFile({
                        path: `${this.LOG_DIR}/${file.name}`,
                        directory: Directory.Data,
                    });
                }
            }

            this.log('system', 'Logs were manually cleared by user.');
        } catch (e) {
            this.originalConsole.error('Failed to clear logs:', e);
            throw e;
        }
    }
}

export const LoggerService = new LoggerServiceInterface();
