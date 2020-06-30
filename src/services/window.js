const path = require('path');
const url = require("url");
const port = require('./port');
const optionService = require('./options');
const env = require('./env');
const log = require('./log');
const sqlInit = require('./sql_init');
const cls = require('./cls');
const keyboardActionsService = require('./keyboard_actions');
const {ipcMain} = require('electron');

// Prevent window being garbage collected
/** @type {Electron.BrowserWindow} */
let mainWindow;
/** @type {Electron.BrowserWindow} */
let setupWindow;

async function createExtraWindow(notePath) {
    const {BrowserWindow} = require('electron');
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Trilium Notes',
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            spellcheck: await optionService.getOptionBool('spellCheckEnabled')
        },
        frame: await optionService.getOptionBool('nativeTitleBarVisible'),
        icon: getIcon()
    });

    win.setMenuBarVisibility(false);
    win.loadURL('http://127.0.0.1:' + await port + '/?extra=1#' + notePath);
}

ipcMain.on('create-extra-window', (event, arg) => {
    createExtraWindow(arg.notePath);
});

async function createMainWindow() {
    const windowStateKeeper = require('electron-window-state'); // should not be statically imported

    const mainWindowState = windowStateKeeper({
        // default window width & height so it's usable on 1600 * 900 display (including some extra panels etc.)
        defaultWidth: 1200,
        defaultHeight: 800
    });

    const spellcheckEnabled = await optionService.getOptionBool('spellCheckEnabled');

    const {BrowserWindow} = require('electron'); // should not be statically imported
    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        title: 'Trilium Notes',
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            spellcheck: spellcheckEnabled
        },
        frame: await optionService.getOptionBool('nativeTitleBarVisible'),
        icon: getIcon()
    });

    mainWindowState.manage(mainWindow);

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL('http://127.0.0.1:' + await port);
    mainWindow.on('closed', () => mainWindow = null);

    const {webContents} = mainWindow;

    webContents.on('new-window', (e, url) => {
        if (url !== webContents.getURL()) {
            e.preventDefault();
            require('electron').shell.openExternal(url);
        }
    });

    // prevent drag & drop to navigate away from trilium
    webContents.on('will-navigate', (ev, targetUrl) => {
        const parsedUrl = url.parse(targetUrl);

        // we still need to allow internal redirects from setup and migration pages
        if (!['localhost', '127.0.0.1'].includes(parsedUrl.hostname) || (parsedUrl.path && parsedUrl.path !== '/')) {
            ev.preventDefault();
        }
    });

    if (spellcheckEnabled) {
        const languageCodes = (await optionService.getOption('spellCheckLanguageCode'))
            .split(',')
            .map(code => code.trim());

        webContents.session.setSpellCheckerLanguages(languageCodes);
    }
}

function getIcon() {
    return path.join(__dirname, '../../images/app-icons/png/256x256' + (env.isDev() ? '-dev' : '') + '.png');
}

async function createSetupWindow() {
    const {BrowserWindow} = require('electron'); // should not be statically imported
    setupWindow = new BrowserWindow({
        width: 800,
        height: 800,
        title: 'Trilium Notes Setup',
        icon: getIcon(),
        webPreferences: {
            // necessary for e.g. utils.isElectron()
            nodeIntegration: true
        }
    });

    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadURL('http://127.0.0.1:' + await port);
    setupWindow.on('closed', () => setupWindow = null);
}

function closeSetupWindow() {
    if (setupWindow) {
        setupWindow.close();
    }
}

async function registerGlobalShortcuts() {
    const {globalShortcut} = require('electron');

    await sqlInit.dbReady;

    const allActions = await keyboardActionsService.getKeyboardActions();

    for (const action of allActions) {
        if (!action.effectiveShortcuts) {
            continue;
        }

        for (const shortcut of action.effectiveShortcuts) {
            if (shortcut.startsWith('global:')) {
                const translatedShortcut = shortcut.substr(7);

                const result = globalShortcut.register(translatedShortcut, cls.wrap(async () => {
                    // window may be hidden / not in focus
                    mainWindow.focus();

                    mainWindow.webContents.send('globalShortcut', action.actionName);
                }));

                if (result) {
                    log.info(`Registered global shortcut ${translatedShortcut} for action ${action.actionName}`);
                }
                else {
                    log.info(`Could not register global shortcut ${translatedShortcut}`);
                }
            }
        }
    }
}

module.exports = {
    createMainWindow,
    createSetupWindow,
    closeSetupWindow,
    registerGlobalShortcuts
};