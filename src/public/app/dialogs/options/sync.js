import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4 style="margin-top: 0px;">同步配置</h4>

<form id="sync-setup-form">
    <div class="form-group">
        <label for="sync-server-host">服务器实例地址</label>
        <input class="form-control" id="sync-server-host" placeholder="https://<host>:<port>">
    </div>

    <div class="form-group">
        <label for="sync-server-timeout">同步超时（毫秒）</label>
        <input class="form-control" id="sync-server-timeout" min="1" max="10000000" type="number" style="text-align: left;">
    </div>

    <div class="form-group">
        <label for="sync-proxy">同步代理服务器（可选）</label>
        <input class="form-control" id="sync-proxy" placeholder="https://<host>:<port>">

        <p><strong>注意：</strong> 如果将代理设置留空，则将使用系统代理（仅适用于桌面/electron版本）</p>
    </div>

    <div style="display: flex; justify-content: space-between;">
        <button class="btn btn-primary">保存</button>

        <button class="btn" type="button" data-help-page="Synchronization">帮助</button>
    </div>
</form>

<br/>

<h4>同步测试</h4>

<p>这将测试与同步服务器的连接和测试数据报。如果同步服务器未初始化，则会将其设置为与本地文档同步。</p>

<button id="test-sync-button" class="btn">测试同步</button>`;

export default class SyncOptions {
    constructor() {
        $("#options-sync-setup").html(TPL);

        this.$form = $("#sync-setup-form");
        this.$syncServerHost = $("#sync-server-host");
        this.$syncServerTimeout = $("#sync-server-timeout");
        this.$syncProxy = $("#sync-proxy");
        this.$testSyncButton = $("#test-sync-button");

        this.$form.on('submit', () => this.save());

        this.$testSyncButton.on('click', async () => {
            const result = await server.post('sync/test');

            if (result.success) {
                toastService.showMessage(result.message);
            }
            else {
                toastService.showError("向服务器发送测试数据失败，错误：" + result.message);
            }
        });
    }

    optionsLoaded(options) {
        this.$syncServerHost.val(options['syncServerHost']);
        this.$syncServerTimeout.val(options['syncServerTimeout']);
        this.$syncProxy.val(options['syncProxy']);
    }

    save() {
        const opts = {
            'syncServerHost': this.$syncServerHost.val(),
            'syncServerTimeout': this.$syncServerTimeout.val(),
            'syncProxy': this.$syncProxy.val()
        };

        server.put('options', opts).then(()  => toastService.showMessage("选项更改已保存。"));

        return false;
    }
}