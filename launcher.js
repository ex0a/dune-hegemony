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

    debug(message) { if (this.level <= LOG_LEVELS.DEBUG) console.log(`[DEBUG] ${message}`); }
    info(message) { if (this.level <= LOG_LEVELS.INFO) console.log(`[INFO] ${message}`); }
    warn(message) { if (this.level <= LOG_LEVELS.WARN) console.warn(`[WARN] ${message}`); }
    error(message) { if (this.level <= LOG_LEVELS.ERROR) console.error(`[ERROR] ${message}`); }
}

const logger = new Logger(LOG_LEVELS.DEBUG);

async function fetchFile(url) {
    logger.info(`Fetching file from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return await response.text();
}

async function computeHash(data) {
    logger.debug('Computing hash');
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256-' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyIntegrity(fileName, content) {
    logger.info(`Verifying integrity of ${fileName}`);
    const computedHash = await computeHash(content);
    const expectedHash = HASHES[fileName];
    logger.info(`Computed: ${computedHash}, Expected: ${expectedHash}`);
    if (computedHash !== expectedHash) throw new Error(`Checksum failed for ${fileName}`);
}

async function downloadAndLaunch() {
    const statusDiv = document.getElementById('status');
    try {
        statusDiv.textContent = 'Downloading files...';
        const filesContent = {};
        for (const [fileName, url] of Object.entries(FILES)) {
            filesContent[fileName] = await fetchFile(url);
            statusDiv.textContent = `Verifying ${fileName}...`;
            await verifyIntegrity(fileName, filesContent[fileName]);
        }

        statusDiv.textContent = 'Launching game...';
        const newWindow = window.open('', '_blank');
        newWindow.document.write(filesContent['index.html']);
        newWindow.document.close();

        const styleElement = newWindow.document.createElement('style');
        styleElement.textContent = filesContent['styles.css'];
        newWindow.document.head.appendChild(styleElement);

        const scriptElement = newWindow.document.createElement('script');
        scriptElement.textContent = filesContent['game.js'];
        newWindow.document.body.appendChild(scriptElement);
    } catch (error) {
        logger.error(`Launch failed: ${error.message}`);
        statusDiv.textContent = `Error: ${error.message}`;
    }
}

downloadAndLaunch();