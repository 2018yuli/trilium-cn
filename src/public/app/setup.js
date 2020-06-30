import utils from "./services/utils.js";
import macInit from './services/mac_init.js';

macInit.init();

function SetupModel() {
    if (syncInProgress) {
        setInterval(checkOutstandingSyncs, 1000);
    }

    const serverAddress = location.protocol + '//' + location.host;

    $("#current-host").html(serverAddress);

    this.step = ko.observable(syncInProgress ? "sync-in-progress" : "setup-type");
    this.setupType = ko.observable();

    this.setupNewDocument = ko.observable(false);
    this.setupSyncFromDesktop = ko.observable(false);
    this.setupSyncFromServer = ko.observable(false);

    this.username = ko.observable();
    this.password1 = ko.observable();
    this.password2 = ko.observable();

    this.theme = ko.observable("white");
    this.theme.subscribe(function(newTheme) {
        const $body = $("body");

        for (const clazz of Array.from($body[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz.startsWith("theme-")) {
                $body.removeClass(clazz);
            }
        }

        $body.addClass("theme-" + newTheme);
    });

    this.syncServerHost = ko.observable();
    this.syncProxy = ko.observable();

    this.instanceType = utils.isElectron() ? "desktop" : "server";

    this.setupTypeSelected = () => !!this.setupType();

    this.selectSetupType = () => {
        this.step(this.setupType());
    };

    this.back = () => {
        this.step("setup-type");

        this.setupType("");
    };

    this.finish = async () => {
        if (this.setupType() === 'new-document') {
            const username = this.username();
            const password1 = this.password1();
            const password2 = this.password2();
            const theme = this.theme();

            if (!username) {
                showAlert("用户名不能为空");
                return;
            }

            if (!password1) {
                showAlert("密码不能为空");
                return;
            }

            if (password1 !== password2) {
                showAlert("两次输入密码不一致");
                return;
            }

            this.step('new-document-in-progress');

            // not using server.js because it loads too many dependencies
            $.post('api/setup/new-document', {
                username: username,
                password: password1,
                theme: theme
            }).then(() => {
                window.location.replace("./setup");
            });
        }
        else if (this.setupType() === 'sync-from-server') {
            const syncServerHost = this.syncServerHost();
            const syncProxy = this.syncProxy();
            const username = this.username();
            const password = this.password1();

            if (!syncServerHost) {
                showAlert("图灵服务器地址不能为空");
                return;
            }

            if (!username) {
                showAlert("用户名不能为空");
                return;
            }

            if (!password) {
                showAlert("密码不能为空");
                return;
            }

            // not using server.js because it loads too many dependencies
            const resp = await $.post('api/setup/sync-from-server', {
                syncServerHost: syncServerHost,
                syncProxy: syncProxy,
                username: username,
                password: password
            });

            if (resp.result === 'success') {
                this.step('sync-in-progress');

                setInterval(checkOutstandingSyncs, 1000);

                hideAlert();
            }
            else {
                showAlert('同步失败：' + resp.error);
            }
        }
    };
}

async function checkOutstandingSyncs() {
    const { stats, initialized } = await $.get('api/sync/stats');

    if (initialized) {
        const remote = utils.dynamicRequire('electron').remote;
        remote.app.relaunch();
        remote.app.exit(0);
    }
    else {
        const totalOutstandingSyncs = stats.outstandingPushes + stats.outstandingPulls;

        $("#outstanding-syncs").html(totalOutstandingSyncs);
    }
}

function showAlert(message) {
    $("#alert").html(message);
    $("#alert").show();
}

function hideAlert() {
    $("#alert").hide();
}

ko.applyBindings(new SetupModel(), document.getElementById('setup-dialog'));

$("#setup-dialog").show();