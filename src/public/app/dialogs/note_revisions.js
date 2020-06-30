import utils from '../services/utils.js';
import server from '../services/server.js';
import toastService from "../services/toast.js";
import appContext from "../services/app_context.js";

const $dialog = $("#note-revisions-dialog");
const $list = $("#note-revision-list");
const $listDropdown = $("#note-revision-list-dropdown");
const $content = $("#note-revision-content");
const $title = $("#note-revision-title");
const $titleButtons = $("#note-revision-title-buttons");
const $eraseAllRevisionsButton = $("#note-revisions-erase-all-revisions-button");

$listDropdown.dropdown();

$listDropdown.parent().on('hide.bs.dropdown', e => {
    // prevent closing dropdown by clicking outside
    if (e.clickEvent) {
        e.preventDefault();
    }
});

let revisionItems = [];
let note;
let noteRevisionId;

export async function showCurrentNoteRevisions() {
    await showNoteRevisionsDialog(appContext.tabManager.getActiveTabNoteId());
}

export async function showNoteRevisionsDialog(noteId, noteRevisionId) {
    utils.openDialog($dialog);

    await loadNoteRevisions(noteId, noteRevisionId);
}

async function loadNoteRevisions(noteId, noteRevId) {
    $list.empty();
    $content.empty();
    $titleButtons.empty();

    note = appContext.tabManager.getActiveTabNote();
    revisionItems = await server.get(`notes/${noteId}/revisions`);

    for (const item of revisionItems) {
        $list.append(
            $('<a class="dropdown-item" tabindex="0">')
                .text(item.dateLastEdited.substr(0, 16) + ` (${item.contentLength} bytes)`)
                .attr('data-note-revision-id', item.noteRevisionId)
                .attr('title', '上次修订时间 ' + item.dateLastEdited)
        );
    }

    $listDropdown.dropdown('show');

    noteRevisionId = noteRevId;

    if (revisionItems.length > 0) {
        if (!noteRevisionId) {
            noteRevisionId = revisionItems[0].noteRevisionId;
        }
    } else {
        $title.text("此笔记尚未修订...");
        noteRevisionId = null;
    }

    $eraseAllRevisionsButton.toggle(revisionItems.length > 0);
}

$dialog.on('shown.bs.modal', () => {
    $list.find(`[data-note-revision-id="${noteRevisionId}"]`)
        .trigger('focus');
});

async function setContentPane() {
    const noteRevisionId = $list.find(".active").attr('data-note-revision-id');

    const revisionItem = revisionItems.find(r => r.noteRevisionId === noteRevisionId);

    $titleButtons.empty();
    $content.empty();

    $title.html(revisionItem.title);

    const $restoreRevisionButton = $('<button class="btn btn-sm" type="button">从此版本中还原</button>');

    $restoreRevisionButton.on('click', async () => {
        const confirmDialog = await import('../dialogs/confirm.js');
        const text = '是否要还原到此修订版本？这将用此修订版本覆盖当前笔记的标题 / 内容。';

        if (await confirmDialog.confirm(text)) {
            await server.put(`notes/${revisionItem.noteId}/restore-revision/${revisionItem.noteRevisionId}`);

            $dialog.modal('hide');

            toastService.showMessage('笔记修订已还原。');
        }
    });

    const $eraseRevisionButton = $('<button class="btn btn-sm" type="button">删除此修订版本</button>');

    $eraseRevisionButton.on('click', async () => {
        const confirmDialog = await import('../dialogs/confirm.js');
        const text = '是否要删除此修订版本？这将删除此修订版本的内容和标题，但是会保留修订元数据。';

        if (await confirmDialog.confirm(text)) {
            await server.remove(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

            loadNoteRevisions(revisionItem.noteId);

            toastService.showMessage('笔记修订版本已删除。');
        }
    });

    $titleButtons
        .append($restoreRevisionButton)
        .append(' &nbsp; ')
        .append($eraseRevisionButton)
        .append(' &nbsp; ');

    const $downloadButton = $('<button class="btn btn-sm btn-primary" type="button">下载</button>');

    $downloadButton.on('click', () => {
        const url = utils.getUrlForDownload(`api/notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}/download`);

        utils.download(url);
    });

    $titleButtons.append($downloadButton);

    const fullNoteRevision = await server.get(`notes/${revisionItem.noteId}/revisions/${revisionItem.noteRevisionId}`);

    if (revisionItem.type === 'text') {
        $content.html(fullNoteRevision.content);
    }
    else if (revisionItem.type === 'code') {
        $content.html($("<pre>").text(fullNoteRevision.content));
    }
    else if (revisionItem.type === 'image') {
        $content.html($("<img>")
            // reason why we put this inline as base64 is that we do not want to let user to copy this
            // as a URL to be used in a note. Instead if they copy and paste it into a note, it will be a uploaded as a new note
            .attr("src", `data:${note.mime};base64,` + fullNoteRevision.content)
            .css("max-width", "100%")
            .css("max-height", "100%"));
    }
    else if (revisionItem.type === 'file') {
        const $table = $("<table cellpadding='10'>")
            .append($("<tr>").append(
                $("<th>").text("MIME: "),
                $("<td>").text(revisionItem.mime)
            ))
            .append($("<tr>").append(
                $("<th>").text("大小："),
                $("<td>").text(revisionItem.contentLength + " bytes")
            ));

        if (fullNoteRevision.content) {
            $table.append($("<tr>").append(
                $("<th>").text("Preview:"),
                $("<td>").append(
                    $('<pre class="file-preview-content"></pre>')
                        .text(fullNoteRevision.content)
                )
            ));
        }

        $content.html($table);
    }
    else {
        $content.text("此笔记类型不支持预览。");
    }
}

$eraseAllRevisionsButton.on('click', async () => {
    const confirmDialog = await import('../dialogs/confirm.js');
    const text = '是否要删除此笔记的所有修订版本？此操作将删除修订的标题和内容，但仍保留修订版本元数据。';

    if (await confirmDialog.confirm(text)) {
        await server.remove(`notes/${note.noteId}/revisions`);

        $dialog.modal('hide');

        toastService.showMessage('修订版本已删除。');
    }
});

$list.on('click', '.dropdown-item', e => {
   e.preventDefault();
   return false;
});

$list.on('focus', '.dropdown-item', e => {
    $list.find('.dropdown-item').each((i, el) => {
        $(el).toggleClass('active', el === e.target);
    });

    setContentPane();
});