import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4 style="margin-top: 0;">同步</h4>
<button id="force-full-sync-button" class="btn">强制完全同步</button>

<br/>
<br/>

<button id="fill-sync-rows-button" class="btn">增量同步（Fill sync rows）</button>

<br/>
<br/>

<h4>一致性检查</h4>

<button id="find-and-fix-consistency-issues-button" class="btn">查找并修复一致性问题</button><br/><br/>

<h4>创建匿名数据库</h4>

<p>此操作将创建数据库的新副本并对其匿名（删除所有笔记内容并只保留结构和一些非敏感元数据）
    为了调试、共享而不必担心泄露你的个人数据。</p>

<button id="anonymize-button" class="btn">保存匿名数据库</button><br/><br/>

<h4>备份数据库</h4>

<p>图灵有自动备份（每日、每周、每月）功能，但您也可以在这里手动触发备份。</p>

<button id="backup-database-button" class="btn">立即备份数据库</button><br/><br/>

<h4>重建数据库</h4>

<p>通过复制主数据库中的内容到一个临时数据库文件，然后清空主数据库，并从副本中重新载入原始的数据库文件。这消除了空闲页，把表中的数据排列为连续的，另外会清理数据库文件结构。</p>

<button id="vacuum-database-button" class="btn">重建数据库</button>`;

export default class AdvancedOptions {
    constructor() {
        $("#options-advanced").html(TPL);

        this.$forceFullSyncButton = $("#force-full-sync-button");
        this.$fillSyncRowsButton = $("#fill-sync-rows-button");
        this.$anonymizeButton = $("#anonymize-button");
        this.$backupDatabaseButton = $("#backup-database-button");
        this.$vacuumDatabaseButton = $("#vacuum-database-button");
        this.$findAndFixConsistencyIssuesButton = $("#find-and-fix-consistency-issues-button");

        this.$forceFullSyncButton.on('click', async () => {
            await server.post('sync/force-full-sync');

            toastService.showMessage("开始完全同步");
        });

        this.$fillSyncRowsButton.on('click', async () => {
            await server.post('sync/fill-sync-rows');

            toastService.showMessage("增量同步成功");
        });

        this.$anonymizeButton.on('click', async () => {
            const resp = await server.post('database/anonymize');

            if (!resp.success) {
                toastService.showError("无法创建匿名数据库，请检查后端日志以了解详细信息");
            }
            else {
                toastService.showMessage(`创建了匿名数据库，耗时： ${resp.anonymizedFilePath}`, 10000);
            }
        });

        this.$backupDatabaseButton.on('click', async () => {
            const {backupFile} = await server.post('database/backup-database');

            toastService.showMessage("已备份到数据库 " + backupFile, 10000);
        });

        this.$vacuumDatabaseButton.on('click', async () => {
            await server.post('database/vacuum-database');

            toastService.showMessage("数据库已经重建");
        });

        this.$findAndFixConsistencyIssuesButton.on('click', async () => {
            await server.post('database/find-and-fix-consistency-issues');

            toastService.showMessage("一致性问题已解决。");
        });
    }
}
