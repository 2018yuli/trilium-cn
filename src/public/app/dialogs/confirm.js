const $dialog = $("#confirm-dialog");
const $confirmContent = $("#confirm-dialog-content");
const $okButton = $("#confirm-dialog-ok-button");
const $cancelButton = $("#confirm-dialog-cancel-button");
const $custom = $("#confirm-dialog-custom");

const DELETE_NOTE_BUTTON_ID = "confirm-dialog-delete-note";

let resolve;
let $originallyFocused; // element focused before the dialog was opened so we can return to it afterwards

export function confirm(message) {
    $originallyFocused = $(':focus');

    $custom.hide();

    glob.activeDialog = $dialog;

    if (typeof message === 'string') {
        message = $("<div>").text(message);
    }

    $confirmContent.empty().append(message);

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

export function confirmDeleteNoteBoxWithNote(title) {
    glob.activeDialog = $dialog;

    $confirmContent.text(`是否确认要从关系图删除笔记 "${title}" ？`);

    $custom.empty()
        .append("<br/>")
        .append($("<div>").addClass("form-check")
            .append($("<input>")
                .attr("id", DELETE_NOTE_BUTTON_ID)
                .attr("type", "checkbox")
                .addClass("form-check-input"))
            .append($("<label>")
                .attr("for", DELETE_NOTE_BUTTON_ID)
                .addClass("form-check-label")
                .attr("style", "text-decoration: underline dotted black")
                .attr("title", "如果您选中此项，笔记将只从关系图中删除，但将作为笔记保留。")
                .html("同时删除笔记")));
    $custom.show();

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

export function isDeleteNoteChecked() {
    return $("#" + DELETE_NOTE_BUTTON_ID + ":checked").length > 0;
}

$dialog.on('shown.bs.modal', () => $okButton.trigger("focus"));

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(false);
    }

    if ($originallyFocused) {
        $originallyFocused.trigger('focus');
        $originallyFocused = null;
    }
});

function doResolve(ret) {
    resolve(ret);
    resolve = null;

    $dialog.modal("hide");
}

$cancelButton.on('click', () => doResolve(false));
$okButton.on('click', () => doResolve(true));