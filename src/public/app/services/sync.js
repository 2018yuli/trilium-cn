import server from './server.js';
import toastService from "./toast.js";

async function syncNow() {
    const result = await server.post('sync/now');

    if (result.success) {
        toastService.showMessage("同步已成功完成。");
    }
    else {
        if (result.message.length > 100) {
            result.message = result.message.substr(0, 100);
        }

        toastService.showError("同步失败： " + result.message);
    }
}

async function forceNoteSync(noteId) {
    await server.post('sync/force-note-sync/' + noteId);

    toastService.showMessage("笔记已添加到同步队列。");
}

export default {
    syncNow,
    forceNoteSync
};
