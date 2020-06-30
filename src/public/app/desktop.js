import appContext from "./services/app_context.js";
import utils from './services/utils.js';
import noteTooltipService from './services/note_tooltip.js';
import bundleService from "./services/bundle.js";
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import contextMenu from "./services/context_menu.js";
import DesktopMainWindowLayout from "./layouts/desktop_main_window_layout.js";
import glob from "./services/glob.js";
import DesktopExtraWindowLayout from "./layouts/desktop_extra_window_layout.js";
import zoomService from './services/zoom.js';

glob.setupGlobs();

if (utils.isElectron()) {
    utils.dynamicRequire('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        appContext.triggerCommand(actionName);
    });
}

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

macInit.init();

bundleService.getWidgetBundlesByParent().then(widgetBundles => {
    const layout = window.glob.isMainWindow
        ? new DesktopMainWindowLayout(widgetBundles)
        : new DesktopExtraWindowLayout(widgetBundles);

    appContext.setLayout(layout);
    appContext.start();
});

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();

if (utils.isElectron()) {
    const electron = utils.dynamicRequire('electron');
    const {webContents} = electron.remote.getCurrentWindow();

    webContents.on('context-menu', (event, params) => {
        const {editFlags} = params;
        const hasText = params.selectionText.trim().length > 0;
        const isMac = process.platform === "darwin";
        const platformModifier = isMac ? 'Meta' : 'Ctrl';

        const items = [];

        if (params.misspelledWord) {
            for (const suggestion of params.dictionarySuggestions) {
                items.push({
                    title: suggestion,
                    command: "replaceMisspelling",
                    spellingSuggestion: suggestion,
                    uiIcon: "empty"
                });
            }

            items.push({
                title: `添加 "${params.misspelledWord}" 到字典`,
                uiIcon: "plus",
                handler: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            });

            items.push({ title: `----` });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canCut && hasText,
                title: `剪切 <kbd>${platformModifier}+X`,
                uiIcon: "cut",
                handler: () => webContents.cut()
            });
        }

        if (params.isEditable || hasText) {
            items.push({
                enabled: editFlags.canCopy && hasText,
                title: `复制 <kbd>${platformModifier}+C`,
                uiIcon: "copy",
                handler: () => webContents.copy()
            });
        }

        if (!["", "javascript:", "about:blank#blocked"].includes(params.linkURL) && params.mediaType === 'none') {
            items.push({
                title: `复制链接`,
                uiIcon: "copy",
                handler: () => {
                    electron.clipboard.write({
                        bookmark: params.linkText,
                        text: params.linkURL
                    });
                }
            });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canPaste,
                title: `粘贴 <kbd>${platformModifier}+V`,
                uiIcon: "paste",
                handler: () => webContents.paste()
            });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canPaste,
                title: `转贴为纯文本 <kbd>${platformModifier}+Shift+V`,
                uiIcon: "paste",
                handler: () => webContents.pasteAndMatchStyle()
            });
        }

        if (hasText) {
            const shortenedSelection = params.selectionText.length > 15
                ? (params.selectionText.substr(0, 13) + "…")
                : params.selectionText;

            items.push({
                enabled: editFlags.canPaste,
                title: `使用 百度 检索 "${shortenedSelection}" `,
                uiIcon: "search-alt",
                handler: () => electron.shell.openExternal(`https://www.baidu.com/?wd=${encodeURIComponent(params.selectionText)}`)
            });
        }

        if (items.length === 0) {
            return;
        }

        const zoomLevel = zoomService.getCurrentZoom();

        contextMenu.show({
            x: params.x / zoomLevel,
            y: params.y / zoomLevel,
            items,
            selectMenuItemHandler: ({command, spellingSuggestion}) => {
                if (command === 'replaceMisspelling') {
                    webContents.insertText(spellingSuggestion);
                }
            }
        });
    });
}
