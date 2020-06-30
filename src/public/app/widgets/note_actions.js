import TabAwareWidget from "./tab_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";

const TPL = `
<div class="dropdown note-actions">
    <style>
    .note-actions .dropdown-menu {
        width: 15em;
    }
    
    .note-actions .dropdown-item[disabled], .note-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
        pointer-events: none; /* makes it unclickable */
    }
    
    /* The switch - the box around the slider */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
        float: right;
    }
    
    /* The slider */
    .slider {
        border-radius: 24px;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--more-accented-background-color);
        transition: .4s;
    }
    
    .slider:before {
        border-radius: 50%;
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: var(--main-background-color);
        -webkit-transition: .4s;
        transition: .4s;
    }
    
    .slider.checked {
        background-color: var(--main-text-color);
    }
    
    .slider.checked:before {
        transform: translateX(26px);
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        笔记操作
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <div class="dropdown-item protect-button">
            私密笔记
        
            <span title="此为公开笔记，请单击以转为私密笔记">
                <label class="switch">
                <span class="slider"></span>
            </span>
        </div>
        <div class="dropdown-item unprotect-button">
            公开笔记
        
            <span title="此为私密笔记，请单击以转为公开笔记">
                <label class="switch">
                <span class="slider checked"></span>
            </span>
        </div>
        <a data-trigger-command="showNoteRevisions" class="dropdown-item show-note-revisions-button">修订记录</a>
        <a data-trigger-command="showAttributes" class="dropdown-item show-attributes-button"><kbd data-command="showAttributes"></kbd> 属性</a>
        <a data-trigger-command="showLinkMap" class="dropdown-item show-link-map-button"><kbd data-command="showLinkMap"></kbd> 链接图</a>
        <a data-trigger-command="showNoteSource" class="dropdown-item show-source-button"><kbd data-command="showNoteSource"></kbd> 源码</a>
        <a class="dropdown-item import-files-button">导入</a>
        <a class="dropdown-item export-note-button">导出</a>
        <a data-trigger-command="printActiveNote" class="dropdown-item print-note-button"><kbd data-command="printActiveNote"></kbd> 打印</a>
        <a data-trigger-command="showNoteInfo" class="dropdown-item show-note-info-button"><kbd data-command="showNoteInfo"></kbd> 基本信息</a>
    </div>
</div>`;

export default class NoteActionsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$showSourceButton = this.$widget.find('.show-source-button');

        this.$exportNoteButton = this.$widget.find('.export-note-button');
        this.$exportNoteButton.on("click", () => {
            if (this.$exportNoteButton.hasClass("disabled")) {
                return;
            }

            import('../dialogs/export.js').then(d => d.showDialog(this.tabContext.notePath, 'single'));
        });

        this.$importNoteButton = this.$widget.find('.import-files-button');
        this.$importNoteButton.on("click", () => import('../dialogs/import.js').then(d => d.showDialog(this.noteId)));

        this.$protectButton = this.$widget.find(".protect-button");
        this.$protectButton.on('click', () => protectedSessionService.protectNote(this.noteId, true, false));

        this.$unprotectButton = this.$widget.find(".unprotect-button");
        this.$unprotectButton.on('click', () => protectedSessionService.protectNote(this.noteId, false, false));

        return this.$widget;
    }

    refreshWithNote(note) {
        if (['text', 'relation-map', 'search', 'code'].includes(note.type)) {
            this.$showSourceButton.removeAttr('disabled');
        } else {
            this.$showSourceButton.attr('disabled', 'disabled');
        }

        if (note.type === 'text') {
            this.$exportNoteButton.removeAttr('disabled');
        }
        else {
            this.$exportNoteButton.attr('disabled', 'disabled');
        }

        this.$protectButton.toggle(!note.isProtected);
        this.$unprotectButton.toggle(!!note.isProtected);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}