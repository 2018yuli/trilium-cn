import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";

export default class WhatLinksHereWidget extends CollapsibleWidget {
    get widgetTitle() { return "被引用"; }

    get help() {
        return {
            title: "此列表包含通过链接和关系链接到此笔记的所有笔记。"
        };
    }

    get headerActions() {
        const $showFullButton = $("<a>").append("查看被引用情况").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const linkMapDialog = await import("../../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async refreshWithNote(note) {
        const targetRelations = note.getTargetRelations();

        if (targetRelations.length === 0) {
            this.$body.text("还没有链接 ...");
            return;
        }

        const $list = $("<ul>");
        let i = 0;

        for (; i < targetRelations.length && i < 50; i++) {
            const rel = targetRelations[i];

            const $item = $("<li>")
                .append(await linkService.createNoteLink(rel.noteId))
                .append($("<span>").text(" (" + rel.name + ")"));

            $list.append($item);
        }

        if (i < targetRelations.length) {
            $list.append($("<li>").text(`${targetRelations.length - i} 更多链接 ...`));
        }

        this.$body.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'relation' && attr.value === this.noteId)) {
            this.refresh();
        }
    }
}