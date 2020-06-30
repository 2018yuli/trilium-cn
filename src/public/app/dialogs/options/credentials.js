import server from "../../services/server.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";
import toastService from "../../services/toast.js";

const TPL = `
<h3>用户名</h3>

<p>你的用户名为 <strong id="credentials-username"></strong>.</p>

<h3>修改密码</h3>
<form id="change-password-form">
    <div class="form-group">
        <label for="old-password">旧密码</label>
        <input class="form-control" id="old-password" type="password">
    </div>

    <div class="form-group">
        <label for="new-password1">新密码</label>
        <input class="form-control" id="new-password1" type="password">
    </div>

    <div class="form-group">
        <label for="new-password2">确认密码</label>
        <input class="form-control" id="new-password2" type="password">
    </div>

    <button class="btn btn-primary">修改密码</button>
</form>`;

export default class ChangePasswordOptions {
    constructor() {
        $("#options-credentials").html(TPL);

        this.$username = $("#credentials-username");
        this.$form = $("#change-password-form");
        this.$oldPassword = $("#old-password");
        this.$newPassword1 = $("#new-password1");
        this.$newPassword2 = $("#new-password2");

        this.$form.on('submit', () => this.save());
    }

    optionsLoaded(options) {
        this.$username.text(options.username);
    }

    save() {
        const oldPassword = this.$oldPassword.val();
        const newPassword1 = this.$newPassword1.val();
        const newPassword2 = this.$newPassword2.val();

        this.$oldPassword.val('');
        this.$newPassword1.val('');
        this.$newPassword2.val('');

        if (newPassword1 !== newPassword2) {
            alert("两次密码输入不一致。");
            return false;
        }

        server.post('password/change', {
            'current_password': oldPassword,
            'new_password': newPassword1
        }).then(result => {
            if (result.success) {
                alert("密码已更改。图聆将在您确认修改后重新加载。");

                // password changed so current protected session is invalid and needs to be cleared
                protectedSessionHolder.resetProtectedSession();
            }
            else {
                toastService.showError(result.message);
            }
        });

        return false;
    }
}