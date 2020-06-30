import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import treeCache from "../../services/tree_cache.js";

export default class SimilarNotesWidget extends CollapsibleWidget {
    get widgetTitle() { return "相似笔记"; }

    get help() {
        return {
            title: "根据笔记标题的文本相似性，此列表包含可能与当前笔记相似的笔记。"
        };
    }

    noteSwitched() {
        const noteId = this.noteId;

        this.$body.empty();

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                this.refresh();
            }
        }, 1000);
    }

    async refreshWithNote(note) {
        // remember which title was when we found the similar notes
        this.title = note.title;

        const similarNotes = await server.get('similar-notes/' + this.noteId);

        if (similarNotes.length === 0) {
            this.$body.text("没有相似的笔记 ...");
            return;
        }

        const noteIds = similarNotes.flatMap(note => note.notePath);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<ul>');

        for (const similarNote of similarNotes) {
            const note = await treeCache.getNote(similarNote.noteId, true);

            if (!note) {
                continue;
            }

            const $item = $("<li>")
                .append(await linkService.createNoteLink(similarNote.notePath.join("/"), {showNotePath: true}));

            $list.append($item);
        }

        this.$body.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (this.note && this.title !== this.note.title) {
            this.rendered = false;

            this.refresh();
        }
    }
}