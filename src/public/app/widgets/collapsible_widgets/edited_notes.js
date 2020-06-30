import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import treeCache from "../../services/tree_cache.js";

export default class EditedNotesWidget extends CollapsibleWidget {
    get widgetTitle() { return "编辑今天的笔记"; }

    get help() {
        return {
            title: "这包含在这一天内创建或更新的笔记列表。"
        };
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.hasOwnedLabel("dateNote");
    }

    async refreshWithNote(note) {
        // remember which title was when we found the similar notes
        this.title = note.title;
        let editedNotes = await server.get('edited-notes/' + note.getLabelValue("dateNote"));

        editedNotes = editedNotes.filter(n => n.noteId !== note.noteId);

        if (editedNotes.length === 0) {
            this.$body.text("今天还没有笔记 ...");
            return;
        }

        const noteIds = editedNotes.flatMap(n => n.noteId);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<ul>');

        for (const editedNote of editedNotes) {
            const $item = $("<li>");

            if (editedNote.isDeleted) {
                $item.append($("<i>").text(editedNote.title + " (deleted)"));
            }
            else {
                $item.append(editedNote.notePath ? await linkService.createNoteLink(editedNote.notePath.join("/"), {showNotePath: true}) : editedNote.title);
            }

            $list.append($item);
        }

        this.$body.empty().append($list);
    }
}