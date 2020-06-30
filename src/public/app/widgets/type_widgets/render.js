import renderService from "../../services/render.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-render note-detail-printable">
    <style>
        .note-detail-render {
            height: 100%;
        }
    </style>

    <div class="note-detail-render-help alert alert-warning" style="margin: 50px; padding: 20px;">
        <p><strong>之所以显示此帮助说明，是因为此 Render HTML 类型的笔记没能正常工作。</strong></p>

        <p>Render HTML 笔记主要用于<a href="https://github.com/zadam/trilium/wiki/Scripts">脚本</a>。简单的说，你有一个 HTML 代码的笔记（可能还有些 JavaScript 脚本）。为了让其正确的渲染，你需要定义一个叫 renderNote 的属性。然后单击 “渲染” 按钮。</p>
    </div>

    <div class="note-detail-render-content" style="height: 100%; overflow: auto;"></div>
</div>`;

export default class RenderTypeWidget extends TypeWidget {
    static getType() { return "render"; }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailRenderHelp = this.$widget.find('.note-detail-render-help');
        this.$noteDetailRenderContent = this.$widget.find('.note-detail-render-content');

        return this.$widget;
    }

    async doRefresh(note) {
        this.$widget.show();
        this.$noteDetailRenderHelp.hide();

        const renderNotesFound = await renderService.render(note, this.$noteDetailRenderContent);

        if (!renderNotesFound) {
            this.$noteDetailRenderHelp.show();
        }
    }

    cleanup() {
        this.$noteDetailRenderContent.empty();
    }

    renderActiveNoteEvent() {
        if (this.tabContext.isActive()) {
            this.refresh();
        }
    }
}