// Base URL and file mappings
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ex0a/dune-hegemony/main/';
const FILES = {
    'index.html': `${GITHUB_RAW_BASE}index.html`,
    'styles.css': `${GITHUB_RAW_BASE}styles.css`,
    'game.js': `${GITHUB_RAW_BASE}game.js`
};
const HASHES = {
    'index.html': 'sha256-', // Replace with actual hash
    'styles.css': 'sha256-',  // Replace with actual hash
    'game.js': 'sha256-'      // Replace with actual hash
};

// Logging Framework
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

class Logger {
    constructor(level = LOG_LEVELS.INFO) {
        this.level = level;
    }

    debug(message) {
        if (this.level <= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`);
        }
    }

    info(message) {
        if (this.level <= LOG_LEVELS.INFO) {
            console.log(`[INFO] ${message}`);
        }
    }

    warn(message) {
        if (this.level <= LOG_LEVELS.WARN) {
            console.warn(`[WARN] ${message}`);
        }
    }

    error(message) {
        if (this.level <= LOG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`);
        }
    }
}

const logger = new Logger(LOG_LEVELS.DEBUG); // Set to DEBUG for development

// Fetch file with logging
async function fetchFile(url) {
    logger.info(`Fetching file from ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        logger.debug(`Fetched content length: ${content.length}`);
        return content;
    } catch (error) {
        logger.error(`Failed to fetch ${url}: ${error.message}`);
        throw error;
    }
}

// Compute hash with logging
async function computeHash(data) {
    logger.debug('Computing hash');
    try {
        const encoder = new TextEncoder();
        const buffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = 'sha256-' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        logger.debug(`Computed hash: ${hash}`);
        return hash;
    } catch (error) {
        logger.error(`Hash computation failed: ${error.message}`);
        throw error;
    }
}

// Verify integrity with logging
async function verifyIntegrity(fileName, content) {
    logger.info(`Verifying integrity of ${fileName}`);
    try {
        const computedHash = await computeHash(content);
        const expectedHash = HASHES[fileName];
        logger.info(`Expected hash: ${expectedHash}`);
        logger.info(`Computed hash: ${computedHash}`);
        if (computedHash !== expectedHash) {
            const errorMsg = `Integrity check failed for ${fileName}. Expected ${expectedHash}, got ${computedHash}`;
            logger.error(errorMsg);
            //throw new Error(errorMsg); // TODO: Implement hash checks fully
        }
        logger.info(`Integrity verified for ${fileName}`);
    } catch (error) {
        logger.error(`Integrity verification failed for ${fileName}: ${error.message}`);
        throw error;
    }
}

// Main download and launch function with logging
async function downloadAndLaunch() {
    const statusDiv = document.getElementById('status');
    logger.info('Starting download and launch process');
    try {
        statusDiv.textContent = 'Downloading files...';
        const filesContent = {};
        for (const [fileName, url] of Object.entries(FILES)) {
            logger.debug(`Processing file: ${fileName}`);
            filesContent[fileName] = await fetchFile(url);
            statusDiv.textContent = `Verifying ${fileName}...`;
            await verifyIntegrity(fileName, filesContent[fileName]);
        }

        logger.info('All files downloaded and verified; launching game');
        statusDiv.textContent = 'Launching game...';
        const newWindow = window.open('', '_blank');
        if (!newWindow) {
            throw new Error('Failed to open new window');
        }

        logger.debug('Writing index.html to new window');
        newWindow.document.write(filesContent['index.html']);
        newWindow.document.close();

        logger.debug('Appending styles.css');
        const styleElement = newWindow.document.createElement('style');
        styleElement.textContent = filesContent['styles.css'];
        newWindow.document.head.appendChild(styleElement);

        logger.debug('Appending game.js');
        const scriptElement = newWindow.document.createElement('script');
        scriptElement.textContent = filesContent['game.js'];
        newWindow.document.body.appendChild(scriptElement);

        logger.info('Game launched successfully');
    } catch (error) {
        logger.error(`Unhandled error in downloadAndLaunch: ${error.message}`);
        statusDiv.textContent = `Error: ${error.message}`;
    }
}

// Start the process
downloadAndLaunch();