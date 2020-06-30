import BasicWidget from "./basic_widget.js";
import HistoryNavigationWidget from "./history_navigation.js";
import protectedSessionService from "../services/protected_session.js";

const TPL = `
<div class="standard-top-widget">
    <style>
    .standard-top-widget {
        background-color: var(--header-background-color);
        display: flex;
        align-items: center;
        padding-top: 4px;
    }
    
    .standard-top-widget button {
        padding: 1px 5px 1px 5px;
        font-size: smaller;
        margin-bottom: 2px;
        margin-top: 2px;
        margin-right: 8px;
        border-color: transparent !important;
    }
    
    .standard-top-widget button.btn-sm .bx {
        position: relative;
        top: 1px;
    }
    
    .standard-top-widget button:hover {
        border-color: var(--button-border-color) !important;
    }
    </style>

    <div style="flex-grow: 100; display: flex;">
        <button class="btn btn-sm jump-to-note-dialog-button" data-command="jumpToNote">
            <span class="bx bx-crosshair"></span>
            快捷导航
        </button>
    
        <button class="btn btn-sm recent-changes-button" data-command="showRecentChanges">
            <span class="bx bx-history"></span>
    
            近期更改
        </button>
    
        <button class="btn btn-sm enter-protected-session-button"
                title="进入私密会话，以便能够查找和查看私密笔记。">
            <span class="bx bx-log-in"></span>
    
            私密笔记
        </button>
    
        <button class="btn btn-sm leave-protected-session-button"
                title="离开私密会话，这样私密笔记将不再可访问。"
                style="display: none;">
            <span class="bx bx-log-out"></span>
    
            退出私密笔记
        </button>
    </div>
    
    <div id="plugin-buttons"></div>
</div>`;

export default class StandardTopWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        const historyNavigationWidget = new HistoryNavigationWidget();
        this.child(historyNavigationWidget);

        this.$widget.prepend(historyNavigationWidget.render());

        this.$widget.find(".jump-to-note-dialog-button").on('click', () => this.triggerCommand('jumpToNote'));
        this.$widget.find(".recent-changes-button").on('click', () => this.triggerCommand('showRecentChanges'));

        this.$enterProtectedSessionButton = this.$widget.find(".enter-protected-session-button");
        this.$enterProtectedSessionButton.on('click', protectedSessionService.enterProtectedSession);

        this.$leaveProtectedSessionButton = this.$widget.find(".leave-protected-session-button");
        this.$leaveProtectedSessionButton.on('click', protectedSessionService.leaveProtectedSession);

        return this.$widget
    }

    protectedSessionStartedEvent() {
        this.$enterProtectedSessionButton.hide();
        this.$leaveProtectedSessionButton.show();
    }
}