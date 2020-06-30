import protectedSessionService from '../../services/protected_session.js';
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="protected-session-password-component note-detail-printable">
    <style>
    .protected-session-password-component {
        width: 300px;
        margin: 30px auto auto;
    }
    </style>

    <form class="protected-session-password-form">
        <div class="form-group">
            <label for="protected-session-password-in-detail">显示私密笔记需要输入密码：</label>
            <input class="protected-session-password-in-detail form-control protected-session-password" type="password">
        </div>

        <button class="btn btn-primary">启动私密会话 <kbd>enter</kbd></button>
    </form>
</div>`;

export default class ProtectedSessionTypeWidget extends TypeWidget {
    static getType() { return "protected-session"; }

    doRender() {
        this.$widget = $(TPL);
        this.$passwordForm = this.$widget.find(".protected-session-password-form");
        this.$passwordInput = this.$widget.find(".protected-session-password");

        this.$passwordForm.on('submit', () => {
            const password = this.$passwordInput.val();
            this.$passwordInput.val("");

            protectedSessionService.setupProtectedSession(password);

            return false;
        });
        
        return this.$widget;
    }
}