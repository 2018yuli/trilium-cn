import utils from "../../services/utils.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<div>
    <h4>拼写检查</h4>

    <p>这些选项只适用于桌面版本，浏览器将使用自己的本机拼写检查。更改后需要重新启动应用程序。</p>

    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="spell-check-enabled">
        <label class="custom-control-label" for="spell-check-enabled">启用拼写检查</label>
    </div>

    <br/>

    <div class="form-group">
        <label for="spell-check-language-code">语言代码</label>
        <input type="text" class="form-control" id="spell-check-language-code" placeholder="栗如 &quot;en-US&quot;, &quot;de-AT&quot;">
    </div>

    <p>多种语言可以用逗号隔开，例如<code>en-US、de-de、cs</code>。对拼写检查选项的更改将在应用程序重新启动后生效。</p>
    
    <p><strong>可用语言代码：</strong> <span id="available-language-codes"></span></p>
</div>

<div>
    <h4>图像压缩</h4>

    <div class="form-group">
        <label for="image-max-width-height">以像素为单位的图像的最大宽度/高度（如果超过此设置，将调整图像大小）。</label>
        <input class="form-control" id="image-max-width-height" type="number">
    </div>

    <div class="form-group">
        <label for="image-jpeg-quality">JPEG质量（0-最差质量，100-最佳质量，建议50-85）</label>
        <input class="form-control" id="image-jpeg-quality" min="0" max="100" type="number">
    </div>
</div>

<div>
    <h4>笔记删除超时</h4>

    <p>删除的笔记只标记为已删除，并且可以从最近的笔记恢复它们。
    一段时间后，标记删除的笔记将被“删除”，这意味着
    它们的内容不再可恢复。此设置允许您配置笔记从 “标记删除” 到 “真正删除” 之间的时间段。</p>

    <div class="form-group">
        <label for="erase-notes-after-time-in-seconds">多少秒后删除笔记：</label>
        <input class="form-control" id="erase-notes-after-time-in-seconds" type="number" min="0">
    </div>
</div>

<div>
    <h4>私密会话超时</h4>

    <p>私密会话超时是一个时间段，在这段时间之后，私密会话将超期。
        这是从最后一次操作私密笔记开始衡量的。参见 <a href="https://github.com/zadam/trilium/wiki/Protected-notes" class="external">wiki</a> 了解更多信息。</p>

    <div class="form-group">
        <label for="protected-session-timeout-in-seconds">私密会话超时（秒）</label>
        <input class="form-control" id="protected-session-timeout-in-seconds" type="number">
    </div>
</div>

<div>
    <h4>笔记生成修订版本（快照）间隔</h4>

    <p>笔记生成修订版本（快照）间隔，是以秒为单位的时间，在此之后将为注释创建新的注释修订。参见 <a href="https://github.com/zadam/trilium/wiki/Note-revisions" class="external">wiki</a> 了解更多信息。</p>

    <div class="form-group">
        <label for="note-revision-snapshot-time-interval-in-seconds">笔记生成修订版本（快照）时间间隔（秒）</label>
        <input class="form-control" id="note-revision-snapshot-time-interval-in-seconds" type="number">
    </div>
</div>`;

export default class ProtectedSessionOptions {
    constructor() {
        $("#options-other").html(TPL);

        this.$spellCheckEnabled = $("#spell-check-enabled");
        this.$spellCheckLanguageCode = $("#spell-check-language-code");

        this.$spellCheckEnabled.on('change', () => {
            const opts = { 'spellCheckEnabled': this.$spellCheckEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("选项更改已保存。"));

            return false;
        });

        this.$spellCheckLanguageCode.on('change', () => {
            const opts = { 'spellCheckLanguageCode': this.$spellCheckLanguageCode.val() };
            server.put('options', opts).then(() => toastService.showMessage("选项更改已保存。"));

            return false;
        });

        this.$availableLanguageCodes = $("#available-language-codes");

        if (utils.isElectron()) {
            const {webContents} = utils.dynamicRequire('electron').remote.getCurrentWindow();

            this.$availableLanguageCodes.text(webContents.session.availableSpellCheckerLanguages.join(', '));
        }

        this.$eraseNotesAfterTimeInSeconds = $("#erase-notes-after-time-in-seconds");

        this.$eraseNotesAfterTimeInSeconds.on('change', () => {
            const eraseNotesAfterTimeInSeconds = this.$eraseNotesAfterTimeInSeconds.val();

            server.put('options', { 'eraseNotesAfterTimeInSeconds': eraseNotesAfterTimeInSeconds }).then(() => {
                toastService.showMessage("选项更改已保存。");
            });

            return false;
        });

        this.$protectedSessionTimeout = $("#protected-session-timeout-in-seconds");

        this.$protectedSessionTimeout.on('change', () => {
            const protectedSessionTimeout = this.$protectedSessionTimeout.val();

            server.put('options', { 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
                toastService.showMessage("选项更改已保存。");
            });

            return false;
        });

        this.$noteRevisionsTimeInterval = $("#note-revision-snapshot-time-interval-in-seconds");

        this.$noteRevisionsTimeInterval.on('change', () => {
            const opts = { 'noteRevisionSnapshotTimeInterval': this.$noteRevisionsTimeInterval.val() };
            server.put('options', opts).then(() => toastService.showMessage("选项更改已保存。"));

            return false;
        });

        this.$imageMaxWidthHeight = $("#image-max-width-height");
        this.$imageJpegQuality = $("#image-jpeg-quality");

        this.$imageMaxWidthHeight.on('change', () => {
            const opts = { 'imageMaxWidthHeight': this.$imageMaxWidthHeight.val() };
            server.put('options', opts).then(() => toastService.showMessage("选项更改已保存。"));

            return false;
        });

        this.$imageJpegQuality.on('change', () => {
            const opts = { 'imageJpegQuality': this.$imageJpegQuality.val() };
            server.put('options', opts).then(() => toastService.showMessage("选项更改已保存。"));

            return false;
        });
    }

    optionsLoaded(options) {
        this.$spellCheckEnabled.prop("checked", options['spellCheckEnabled'] === 'true');
        this.$spellCheckLanguageCode.val(options['spellCheckLanguageCode']);

        this.$eraseNotesAfterTimeInSeconds.val(options['eraseNotesAfterTimeInSeconds']);
        this.$protectedSessionTimeout.val(options['protectedSessionTimeout']);
        this.$noteRevisionsTimeInterval.val(options['noteRevisionSnapshotTimeInterval']);

        this.$imageMaxWidthHeight.val(options['imageMaxWidthHeight']);
        this.$imageJpegQuality.val(options['imageJpegQuality']);
    }
}
