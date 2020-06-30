import BasicWidget from "./basic_widget.js";
import utils from "../services/utils.js";
import syncService from "../services/sync.js";

const TPL = `
<div class="global-menu-wrapper">
    <style>
    .global-menu-wrapper {
        height: 35px;
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .global-menu button {
        margin-right: 10px;
        height: 33px;
        border: none;
    }
    
    .global-menu .dropdown-menu {
        width: 20em;
    }
    </style>

    <div class="dropdown global-menu">
        <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
            <span class="bx bx-menu"></span>
            Menu
            <span class="caret"></span>
        </button>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item options-button" data-trigger-command="showOptions">
                <span class="bx bx-slider"></span>
                选项
            </a>

            <a class="dropdown-item sync-now-button" title="触发同步">
                <span class="bx bx-refresh"></span>
                立即同步 (<span id="outstanding-syncs-count">0</span>)
            </a>

            <a class="dropdown-item" data-trigger-command="openNewWindow">
                <span class="bx bx-window-open"></span>
                打开新窗口
                <kbd data-command="openNewWindow"></kbd>
            </a>

            <a class="dropdown-item open-dev-tools-button" data-trigger-command="openDevTools">
                <span class="bx bx-terminal"></span>
                打开开发工具
                <kbd data-command="openDevTools"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showSQLConsole">
                <span class="bx bx-data"></span>
                打开SQL控制台
                <kbd data-command="showSQLConsole"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showBackendLog">
                <span class="bx bx-empty"></span>
                显示后端日志
                <kbd data-command="showBackendLog"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="reloadFrontendApp" 
                title="重新加载可以帮助解决一些视图上的问题，而无需重新启动整个应用程序。">
                <span class="bx bx-empty"></span>
                重新加载
                <kbd data-command="reloadFrontendApp"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="toggleZenMode">
                <span class="bx bx-empty"></span>
                切换专注模式
                <kbd data-command="toggleZenMode"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="toggleFullscreen">
                <span class="bx bx-empty"></span>
                切换全屏
                <kbd data-command="toggleFullscreen"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showHelp">
                <span class="bx bx-info-circle"></span>
                显示帮助
                <kbd data-command="showHelp"></kbd>
            </a>

            <a class="dropdown-item show-about-dialog-button">
                <span class="bx bx-empty"></span>
                关于图灵笔记
            </a>

            <a class="dropdown-item logout-button" data-trigger-command="logout">
                <span class="bx bx-log-out"></span>
                注销
            </a>
        </div>
    </div>
</div>
`;

export default class GlobalMenuWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.find(".show-about-dialog-button").on('click',
            () => import("../dialogs/about.js").then(d => d.showDialog()));

        this.$widget.find(".sync-now-button").on('click', () => syncService.syncNow());

        this.$widget.find(".logout-button").toggle(!utils.isElectron());

        this.$widget.find(".open-dev-tools-button").toggle(utils.isElectron());

        return this.$widget;
    }
}
