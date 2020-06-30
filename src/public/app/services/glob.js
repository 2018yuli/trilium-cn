import utils from "./utils.js";
import appContext from "./app_context.js";
import server from "./server.js";
import libraryLoader from "./library_loader.js";
import ws from "./ws.js";
import protectedSessionHolder from "./protected_session_holder.js";
import treeCache from "./tree_cache.js";

function setupGlobs() {
    window.glob.PROFILING_LOG = false;

    window.glob.isDesktop = utils.isDesktop;
    window.glob.isMobile = utils.isMobile;

    window.glob.getComponentByEl = el => appContext.getComponentByEl(el);
    window.glob.getHeaders = server.getHeaders;

    // required for ESLint plugin and CKEditor
    window.glob.getActiveTabNote = () => appContext.tabManager.getActiveTabNote();
    window.glob.requireLibrary = libraryLoader.requireLibrary;
    window.glob.ESLINT = libraryLoader.ESLINT;
    window.glob.appContext = appContext; // for debugging
    window.glob.treeCache = treeCache;

    // for CKEditor integration (button on block toolbar)
    window.glob.importMarkdownInline = async () => {
        const dialog = await import("../dialogs/markdown_import.js");

        dialog.importMarkdownInline();
    };

    window.glob.SEARCH_HELP_TEXT = `
    <strong>检索提示</strong> - 参见 <button class="btn btn-sm" type="button" data-help-page="Search">有关检索的完整帮助</button>
    <p>
    <ul>
        <li>输入任何文本都会执行全文搜索</li>
        <li><code>@abc</code> - 返回有 abc 标签的笔记</li>
        <li><code>@year=2019</code> - 匹配带标记 <code>year</code> 且标记值为 <code>2019</code> 的笔记</li>
        <li><code>@rock @pop</code> - 匹配带标记 <code>rock</code> 和 <code>pop</code> 的笔记</li>
        <li><code>@rock or @pop</code> - 匹配带标记 <code>rock</code> 或者 <code>pop</code> 的笔记</li>
        <li><code>@year&lt;=2000</code> - 数字比较 (页可以是 &gt;, &gt;=, &lt;).</li>
        <li><code>@dateCreated>=MONTH-1</code> - 上个月以来创建的笔记</li>
        <li><code>=handler</code> - 将执行 <code>handler<code> 中定义的脚本以获取结果</li>
    </ul>
    </p>`;

    window.onerror = function (msg, url, lineNo, columnNo, error) {
        const string = msg.toLowerCase();

        let message = "错误：";

        if (string.includes("script error")) {
            message += '没有可用的详细信息';
        } else {
            message += [
                '错误消息： ' + msg,
                'URL: ' + url,
                '第： ' + lineNo + '行',
                '第： ' + columnNo + '列',
                '错误对象： ' + JSON.stringify(error),
                '堆栈消息： ' + error && error.stack
            ].join(', ');
        }

        ws.logError(message);

        return false;
    };

    protectedSessionHolder.setProtectedSessionId(null);

    for (const appCssNoteId of glob.appCssNoteIds || []) {
        libraryLoader.requireCss(`api/notes/download/${appCssNoteId}`);
    }

    const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

    $(document).on("click", "button[data-help-page]", e => {
        const $button = $(e.target);

        window.open(wikiBaseUrl + $button.attr("data-help-page"), '_blank');
    });

    $("body").on("click", "a.external", function () {
        window.open($(this).attr("href"), '_blank');
    });
}

export default {
    setupGlobs
}
