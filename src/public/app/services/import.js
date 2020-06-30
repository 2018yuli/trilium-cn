import toastService from "./toast.js";
import server from "./server.js";
import ws from "./ws.js";
import utils from "./utils.js";
import appContext from "./app_context.js";

export async function uploadFiles(parentNoteId, files, options) {
    if (files.length === 0) {
        return;
    }

    const taskId = utils.randomString(10);
    let noteId;
    let counter = 0;

    for (const file of files) {
        counter++;

        const formData = new FormData();
        formData.append('upload', file);
        formData.append('taskId', taskId);
        formData.append('last', counter === files.length ? "true" : "false");

        for (const key in options) {
            formData.append(key, options[key]);
        }

        ({noteId} = await $.ajax({
            url: baseApiUrl + 'notes/' + parentNoteId + '/import',
            headers: server.getHeaders(),
            data: formData,
            dataType: 'json',
            type: 'POST',
            timeout: 60 * 60 * 1000,
            contentType: false, // NEEDED, DON'T REMOVE THIS
            processData: false, // NEEDED, DON'T REMOVE THIS
        }));
    }
}

function makeToast(id, message) {
    return {
        id: id,
        title: "导入状态",
        message: message,
        icon: "plus"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'import') {
        return;
    }

    if (message.type === 'task-error') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'task-progress-count') {
        toastService.showPersistent(makeToast(message.taskId, "正在导入： " + message.progressCount));
    } else if (message.type === 'task-succeeded') {
        const toast = makeToast(message.taskId, "导入成功完成。");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);

        if (message.result.importedNoteId) {
            await appContext.tabManager.getActiveTabContext().setNote(message.result.importedNoteId);
        }
    }
});

export default {
    uploadFiles
}