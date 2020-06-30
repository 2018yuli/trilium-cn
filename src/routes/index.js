"use strict";

const sourceIdService = require('../services/source_id');
const sql = require('../services/sql');
const attributeService = require('../services/attributes');
const config = require('../services/config');
const optionService = require('../services/options');
const log = require('../services/log');
const env = require('../services/env');

async function index(req, res) {
    const options = await optionService.getOptionsMap();

    let view = req.cookies['trilium-device'] === 'mobile' ? 'mobile' : 'desktop';

    const csrfToken = req.csrfToken();
    log.info(`Generated CSRF token ${csrfToken} with secret ${res.getHeader('set-cookie')}`);

    res.render(view, {
        csrfToken: csrfToken,
        theme: options.theme,
        mainFontSize: parseInt(options.mainFontSize),
        treeFontSize: parseInt(options.treeFontSize),
        detailFontSize: parseInt(options.detailFontSize),
        sourceId: await sourceIdService.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        instanceName: config.General ? config.General.instanceName : null,
        appCssNoteIds: await getAppCssNoteIds(),
        isDev: env.isDev(),
        isMainWindow: !req.query.extra
    });
}

async function getAppCssNoteIds() {
    return (await attributeService.getNotesWithLabels(['appCss', 'appTheme']))
        .map(note => note.noteId);
}

module.exports = {
    index
};
