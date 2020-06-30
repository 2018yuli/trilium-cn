import treeService from './tree.js';
import treeCache from "./tree_cache.js";
import hoistedNoteService from './hoisted_note.js';
import clipboard from './clipboard.js';
import protectedSessionHolder from "./protected_session_holder.js";
import appContext from "./app_context.js";
import noteCreateService from "./note_create.js";
import contextMenu from "./context_menu.js";

class TreeContextMenu {
    /**
     * @param {NoteTreeWidget} treeWidget
     * @param {FancytreeNode} node
     */
    constructor(treeWidget, node) {
        this.treeWidget = treeWidget;
        this.node = node;
    }
    
    async show(e) {
        contextMenu.show({
            x: e.pageX,
            y: e.pageY,
            items: await this.getMenuItems(),
            selectMenuItemHandler: (item, e) => this.selectMenuItemHandler(item, e)
        })
    }

    getNoteTypeItems(command) {
        return [
            { title: "类型", command: command, type: "text", uiIcon: "note" },
            { title: "编码", command: command, type: "code", uiIcon: "code" },
            { title: "保存的检索", command: command, type: "search", uiIcon: "file-find" },
            { title: "关系图", command: command, type: "relation-map", uiIcon: "map-alt" },
            { title: "HTML 笔记", command: command, type: "render", uiIcon: "extension" },
            { title: "订阅", command: command, type: "book", uiIcon: "book" }
        ];
    }

    async getMenuItems() {
        const note = await treeCache.getNote(this.node.data.noteId);
        const branch = treeCache.getBranch(this.node.data.branchId);
        const isNotRoot = note.noteId !== 'root';
        const isHoisted = note.noteId === hoistedNoteService.getHoistedNoteId();
        const parentNote = isNotRoot ? await treeCache.getNote(branch.parentNoteId) : null;

        // some actions don't support multi-note so they are disabled when notes are selected
        // the only exception is when the only selected note is the one that was right-clicked, then
        // it's clear what the user meant to do.
        const selNodes = this.treeWidget.getSelectedNodes();
        const noSelectedNotes = selNodes.length === 0
                || (selNodes.length === 1 && selNodes[0] === this.node);

        const notSearch = note.type !== 'search';
        const parentNotSearch = !parentNote || parentNote.type !== 'search';
        const insertNoteAfterEnabled = isNotRoot && !isHoisted && parentNotSearch;

        return [
            { title: '在新选项卡中打开 <kbd>Ctrl+Click</kbd>', command: "openInTab", uiIcon: "empty", enabled: noSelectedNotes },
            { title: '在新窗口中打开', command: "openInWindow", uiIcon: "window-open", enabled: noSelectedNotes },
            { title: '新建同级笔记 <kbd data-command="createNoteAfter"></kbd>', command: "insertNoteAfter", uiIcon: "plus",
                items: insertNoteAfterEnabled ? this.getNoteTypeItems("insertNoteAfter") : null,
                enabled: insertNoteAfterEnabled && noSelectedNotes },
            { title: '新建子笔记 <kbd data-command="createNoteInto"></kbd>', command: "insertChildNote", uiIcon: "plus",
                items: notSearch ? this.getNoteTypeItems("insertChildNote") : null,
                enabled: notSearch && noSelectedNotes },
            { title: '删除 <kbd data-command="deleteNotes"></kbd>', command: "deleteNotes", uiIcon: "trash",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: "----" },
            { title: '在子树中检索 <kbd data-command="searchInSubtree"></kbd>', command: "searchInSubtree", uiIcon: "search",
                enabled: notSearch && noSelectedNotes },
            isHoisted ? null : { title: '挂载的笔记 <kbd data-command="toggleNoteHoisting"></kbd>', command: "toggleNoteHoisting", uiIcon: "empty", enabled: noSelectedNotes && notSearch },
            !isHoisted || !isNotRoot ? null : { title: '未挂载的笔记 <kbd data-command="ToggleNoteHoisting"></kbd>', command: "toggleNoteHoisting", uiIcon: "arrow-up" },
            { title: '编辑前缀 <kbd data-command="editBranchPrefix"></kbd>', command: "editBranchPrefix", uiIcon: "empty",
                enabled: isNotRoot && parentNotSearch && noSelectedNotes},
            { title: "高级", uiIcon: "empty", enabled: true, items: [
                    { title: '展开子级 <kbd data-command="expandSubtree"></kbd>', command: "expandSubtree", uiIcon: "expand", enabled: noSelectedNotes },
                    { title: '折叠子级 <kbd data-command="collapseSubtree"></kbd>', command: "collapseSubtree", uiIcon: "collapse", enabled: noSelectedNotes },
                    { title: "强制同步笔记", command: "forceNoteSync", uiIcon: "refresh", enabled: noSelectedNotes },
                    { title: '排序 <kbd data-command="sortChildNotes"></kbd>', command: "sortChildNotes", uiIcon: "empty", enabled: noSelectedNotes && notSearch },
                    { title: '节点最近修改', command: "recentChangesInSubtree", uiIcon: "history", enabled: noSelectedNotes }
                ] },
            { title: "----" },
            { title: "加密节点", command: "protectSubtree", uiIcon: "check-shield", enabled: noSelectedNotes },
            { title: "公开节点", command: "unprotectSubtree", uiIcon: "shield", enabled: noSelectedNotes },
            { title: "----" },
            { title: '复制 / 克隆 <kbd data-command="copyNotesToClipboard"></kbd>', command: "copyNotesToClipboard", uiIcon: "copy",
                enabled: isNotRoot && !isHoisted },
            { title: '克隆到 ... <kbd data-command="cloneNotesTo"></kbd>', command: "cloneNotesTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted },
            { title: '剪切 <kbd data-command="cutNotesToClipboard"></kbd>', command: "cutNotesToClipboard", uiIcon: "cut",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: '移动到 ... <kbd data-command="moveNotesTo"></kbd>', command: "moveNotesTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: '粘贴到 <kbd data-command="pasteNotesFromClipboard"></kbd>', command: "pasteNotesFromClipboard", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && notSearch && noSelectedNotes },
            { title: '在之后粘贴', command: "pasteNotesAfterFromClipboard", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && isNotRoot && !isHoisted && parentNotSearch && noSelectedNotes },
            { title: "复制一份", command: "duplicateNote", uiIcon: "empty",
                enabled: noSelectedNotes && parentNotSearch && isNotRoot && !isHoisted && (!note.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) },
            { title: "----" },
            { title: "导出", command: "exportNote", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes },
            { title: "导入", command: "importIntoNote", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes }
        ].filter(row => row !== null);
    }

    async selectMenuItemHandler({command, type}) {
        const noteId = this.node.data.noteId;
        const notePath = treeService.getNotePath(this.node);

        if (command === 'openInTab') {
            appContext.tabManager.openTabWithNote(notePath);
        }
        else if (command === "insertNoteAfter") {
            const parentNoteId = this.node.data.parentNoteId;
            const isProtected = await treeService.getParentProtectedStatus(this.node);

            noteCreateService.createNote(parentNoteId, {
                target: 'after',
                targetBranchId: this.node.data.branchId,
                type: type,
                isProtected: isProtected
            });
        }
        else if (command === "insertChildNote") {
            noteCreateService.createNote(noteId, {
                type: type,
                isProtected: this.node.data.isProtected
            });
        }
        else {
            this.treeWidget.triggerCommand(command, {node: this.node, notePath: notePath});
        }
    }
}

export default TreeContextMenu;