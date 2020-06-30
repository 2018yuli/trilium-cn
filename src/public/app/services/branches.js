import utils from './utils.js';
import server from './server.js';
import toastService from "./toast.js";
import treeCache from "./tree_cache.js";
import hoistedNoteService from "./hoisted_note.js";
import ws from "./ws.js";

async function moveBeforeBranch(branchIdsToMove, beforeBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);

    if (beforeBranchId === 'root') {
        alert('Cannot move notes before root note.');
        return;
    }

    for (const branchIdToMove of branchIdsToMove) {
        const resp = await server.put(`branches/${branchIdToMove}/move-before/${beforeBranchId}`);

        if (!resp.success) {
            alert(resp.message);
            return;
        }
    }
}

async function moveAfterBranch(branchIdsToMove, afterBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);

    const afterNote = await treeCache.getBranch(afterBranchId).getNote();

    if (afterNote.noteId === 'root' || afterNote.noteId === hoistedNoteService.getHoistedNoteId()) {
        alert('无法移动根下的笔记。');
        return;
    }

    branchIdsToMove.reverse(); // need to reverse to keep the note order

    for (const branchIdToMove of branchIdsToMove) {
        const resp = await server.put(`branches/${branchIdToMove}/move-after/${afterBranchId}`);

        if (!resp.success) {
            alert(resp.message);
            return;
        }
    }
}

async function moveToParentNote(branchIdsToMove, newParentBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);

    for (const branchIdToMove of branchIdsToMove) {
        const branchToMove = treeCache.getBranch(branchIdToMove);

        if (branchToMove.noteId === hoistedNoteService.getHoistedNoteId()
            || (await branchToMove.getParentNote()).type === 'search') {
            continue;
        }

        const resp = await server.put(`branches/${branchIdToMove}/move-to/${newParentBranchId}`);

        if (!resp.success) {
            alert(resp.message);
            return;
        }
    }
}

async function deleteNotes(branchIdsToDelete) {
    branchIdsToDelete = filterRootNote(branchIdsToDelete);

    if (branchIdsToDelete.length === 0) {
        return false;
    }

    const $deleteClonesCheckbox = $('<div class="form-check">')
        .append($('<input type="checkbox" class="form-check-input" id="delete-clones-checkbox">'))
        .append($('<label for="delete-clones-checkbox">')
                    .text("同时删除所有笔记的克隆")
                    .attr("title", "所选笔记的所有克隆都将被删除，因此整个笔记也将被删除。"));

    const $nodeTitles = $("<ul>");

    for (const branchId of branchIdsToDelete) {
        const note = await treeCache.getBranch(branchId).getNote();

        $nodeTitles.append($("<li>").text(note.title));
    }

    const $confirmText = $("<div>")
        .append($("<p>").text('这将删除以下笔记及其子笔记：'))
        .append($nodeTitles)
        .append($deleteClonesCheckbox);

    const confirmDialog = await import('../dialogs/confirm.js');

    if (!await confirmDialog.confirm($confirmText)) {
        return false;
    }

    const deleteClones = $deleteClonesCheckbox.find("input").is(":checked");

    const taskId = utils.randomString(10);

    let counter = 0;

    for (const branchIdToDelete of branchIdsToDelete) {
        counter++;

        const last = counter === branchIdsToDelete.length;
        const query = `?taskId=${taskId}&last=${last ? 'true' : 'false'}`;

        const branch = treeCache.getBranch(branchIdToDelete);

        if (deleteClones) {
            await server.remove(`notes/${branch.noteId}` + query);
        }
        else {
            await server.remove(`branches/${branchIdToDelete}` + query);
        }
    }

    return true;
}

async function moveNodeUpInHierarchy(node) {
    if (hoistedNoteService.isRootNode(node)
        || hoistedNoteService.isTopLevelNode(node)
        || node.getParent().data.noteType === 'search') {
        return;
    }

    const resp = await server.put('branches/' + node.data.branchId + '/move-after/' + node.getParent().data.branchId);

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    if (!hoistedNoteService.isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
        node.getParent().folder = false;
        node.getParent().renderTitle();
    }
}

function filterRootNote(branchIds) {
    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

    return branchIds.filter(branchId => {
       const branch = treeCache.getBranch(branchId);

        return branch.noteId !== 'root'
            && branch.noteId !== hoistedNoteId;
    });
}

function makeToast(id, message) {
    return {
        id: id,
        title: "删除状态",
        message: message,
        icon: "trash"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'delete-notes') {
        return;
    }

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message.taskId, "正则删除笔记：" + message.progressCount));
    } else if (message.type === 'task-succeeded') {
        const toast = makeToast(message.taskId, "删除成功。");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'undelete-notes') {
        return;
    }

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message.taskId, "正在取消删除笔记：" + message.progressCount));
    } else if (message.type === 'task-succeeded') {
        const toast = makeToast(message.taskId, "笔记撤销删除成功。");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});

async function cloneNoteTo(childNoteId, parentBranchId, prefix) {
    const resp = await server.put(`notes/${childNoteId}/clone-to/${parentBranchId}`, {
        prefix: prefix
    });

    if (!resp.success) {
        alert(resp.message);
    }
}

// beware that first arg is noteId and second is branchId!
async function cloneNoteAfter(noteId, afterBranchId) {
    const resp = await server.put('notes/' + noteId + '/clone-after/' + afterBranchId);

    if (!resp.success) {
        alert(resp.message);
    }
}

export default {
    moveBeforeBranch,
    moveAfterBranch,
    moveToParentNote,
    deleteNotes,
    moveNodeUpInHierarchy,
    cloneNoteAfter,
    cloneNoteTo
};
