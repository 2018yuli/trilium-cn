import noteAutocompleteService from '../../services/note_autocomplete.js';
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";

const TPL = `
<div class="note-detail-empty note-detail-printable">
    <div class="form-group">
        <label>通过在下面的输入框中键入笔记标题打开笔记，或在导航树中选择笔记。</label>
        <div class="input-group">
            <input class="form-control note-autocomplete" placeholder="按名称搜索便笺">
        </div>
    </div>
</div>`;

export default class EmptyTypeWidget extends TypeWidget {
    static getType() { return "empty"; }

    doRender() {
        // FIXME: this might be optimized - cleaned up after use since it's always used only for new tab

        this.$widget = $(TPL);
        this.$autoComplete = this.$widget.find(".note-autocomplete");

        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, { hideGoToSelectedNoteButton: true })
            .on('autocomplete:selected', function(event, suggestion, dataset) {
                if (!suggestion.path) {
                    return false;
                }

                appContext.tabManager.getActiveTabContext().setNote(suggestion.path);
            });

        noteAutocompleteService.showRecentNotes(this.$autoComplete);

        return this.$widget;
    }

    doRefresh(note) {
        this.$autoComplete.trigger('focus');
    }
}