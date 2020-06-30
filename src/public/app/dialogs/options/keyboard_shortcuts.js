import server from "../../services/server.js";
import utils from "../../services/utils.js";

const TPL = `
<h4>快捷方式</h4>

<p>同一操作的多个快捷键可以用逗号分隔。</p>

<div class="form-group">
    <input type="text" class="form-control" id="keyboard-shortcut-filter" placeholder="键入文本以筛选快捷方式 ...">
</div>

<div style="overflow: auto; height: 500px;">
    <table id="keyboard-shortcut-table" cellpadding="10">
    <thead>
        <tr>
            <th>动作名称</th>
            <th>快捷键</th>
            <th>默认</th>
            <th>描述</th>
        </tr>
    </thead>
    <tbody></tbody>
    </table>
</div>

<div style="display: flex; justify-content: space-between">
    <button class="btn btn-primary" id="options-keyboard-shortcuts-reload-app">重新加载应用程序以应用更改</button>
    
    <button class="btn" id="options-keyboard-shortcuts-set-all-to-default">重置所有快捷键为默认</button>
</div>
`;

let globActions;

export default class KeyboardShortcutsOptions {
    constructor() {
        $("#options-keyboard-shortcuts").html(TPL);

        $("#options-keyboard-shortcuts-reload-app").on("click", () => utils.reloadApp());

        const $table = $("#keyboard-shortcut-table tbody");

        server.get('keyboard-actions').then(actions => {
            globActions = actions;

            for (const action of actions) {
                const $tr = $("<tr>");

                if (action.separator) {
                    $tr.append(
                        $('<td colspan="4">')
                            .attr("style","background-color: var(--accented-background-color); font-weight: bold;")
                            .text(action.separator)
                    )
                }
                else {
                    $tr.append($("<td>").text(action.actionName))
                        .append($("<td>").append(
                            $(`<input type="text" class="form-control">`)
                                .val(action.effectiveShortcuts.join(", "))
                                .attr('data-keyboard-action-name', action.actionName)
                                .attr('data-default-keyboard-shortcuts', action.defaultShortcuts.join(", "))
                            )
                        )
                        .append($("<td>").text(action.defaultShortcuts.join(", ")))
                        .append($("<td>").text(action.description));
                }

                $table.append($tr);
            }
        });

        $table.on('change', 'input.form-control', e => {
            const $input = $(e.target);
            const actionName = $input.attr('data-keyboard-action-name');
            const shortcuts = $input.val()
                              .replace('+,', "+Comma")
                              .split(",")
                              .map(shortcut => shortcut.replace("+Comma", "+,"))
                              .filter(shortcut => !!shortcut);

            const opts = {};
            opts['keyboardShortcuts' + actionName] = JSON.stringify(shortcuts);

            server.put('options', opts);
        });

        $("#options-keyboard-shortcuts-set-all-to-default").on('click', async () => {
            const confirmDialog = await import('../confirm.js');

            if (!await confirmDialog.confirm("是否确实要将所有键盘快捷键重置为默认值？")) {
                return;
            }

            $table.find('input.form-control').each(function() {
                const defaultShortcuts = $(this).attr('data-default-keyboard-shortcuts');

                if ($(this).val() !== defaultShortcuts) {
                    $(this)
                        .val(defaultShortcuts)
                        .trigger('change');
                }
            });
        });

        const $filter = $("#keyboard-shortcut-filter");

        $filter.on('keyup', () => {
            const filter = $filter.val().trim().toLowerCase();

            $table.find("tr").each((i, el) => {
                if (!filter) {
                    $(el).show();
                    return;
                }

                const actionName = $(el).find('input').attr('data-keyboard-action-name');

                if (!actionName) {
                    $(el).hide();
                    return;
                }

                const action = globActions.find(act => act.actionName === actionName);

                if (!action) {
                    $(el).hide();
                    return;
                }

                $(el).toggle(!!( // !! to avoid toggle overloads with different behavior
                    action.actionName.toLowerCase().includes(filter)
                    || action.defaultShortcuts.some(shortcut => shortcut.toLowerCase().includes(filter))
                    || action.effectiveShortcuts.some(shortcut => shortcut.toLowerCase().includes(filter))
                    || (action.description && action.description.toLowerCase().includes(filter))
                ));
            });
        });
    }
}