import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-deleted note-detail-printable">
    <div style="padding: 100px;">
        <div class="alert alert-warning" style="padding: 20px;">
            此笔记已被删除。
        </div>
    </div>
</div>`;

export default class DeletedTypeWidget extends TypeWidget {
    static getType() { return "deleted"; }

    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }
}