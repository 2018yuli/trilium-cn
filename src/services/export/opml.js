"use strict";

const repository = require("../repository");
const utils = require('../utils');

async function exportToOpml(taskContext, branch, version, res) {
    if (!['1.0', '2.0'].includes(version)) {
        throw new Error("Unrecognized OPML version " + version);
    }

    const opmlVersion = parseInt(version);

    const note = await branch.getNote();

    async function exportNoteInner(branchId) {
        const branch = await repository.getBranch(branchId);
        const note = await branch.getNote();

        if (await note.hasOwnedLabel('excludeFromExport')) {
            return;
        }

        const title = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title;

        if (opmlVersion === 1) {
            const preparedTitle = escapeXmlAttribute(title);
            const preparedContent = note.isStringNote() ? prepareText(await note.getContent()) : '';

            res.write(`<outline title="${preparedTitle}" text="${preparedContent}">\n`);
        }
        else if (opmlVersion === 2) {
            const preparedTitle = escapeXmlAttribute(title);
            const preparedContent = note.isStringNote() ? escapeXmlAttribute(await note.getContent()) : '';

            res.write(`<outline text="${preparedTitle}" _note="${preparedContent}">\n`);
        }
        else {
            throw new Error("Unrecognized OPML version " + opmlVersion);
        }

        taskContext.increaseProgressCount();

        for (const child of await note.getChildBranches()) {
            await exportNoteInner(child.branchId);
        }

        res.write('</outline>');
    }


    const filename = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title + ".opml";

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', 'text/x-opml');

    res.write(`<?xml version="1.0" encoding="UTF-8"?>
<opml version="${version}">
<head>
<title>Trilium export</title>
</head>
<body>`);

    await exportNoteInner(branch.branchId);

    res.write(`</body>
</opml>`);
    res.end();

    taskContext.taskSucceeded();
}

function prepareText(text) {
    const newLines = text.replace(/(<p[^>]*>|<br\s*\/?>)/g, '\n')
        .replace(/&nbsp;/g, ' '); // nbsp isn't in XML standard (only HTML)

    const stripped = utils.stripTags(newLines);

    const escaped = escapeXmlAttribute(stripped);

    return escaped.replace(/\n/g, '&#10;');
}

function escapeXmlAttribute(text) {
    return text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    exportToOpml
};