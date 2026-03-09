// ===== 入力管理 =====

export class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // ゲームで使うキーのデフォルト動作を防止
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                 'KeyZ', 'KeyX', 'ShiftLeft', 'ShiftRight', 'Escape', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // ウィンドウからフォーカスが外れたらキーをリセット
        window.addEventListener('blur', () => {
            this.keys = {};
        });
    }

    /** キーが押されているか */
    isDown(code) {
        return !!this.keys[code];
    }

    /** キーが今フレーム初めて押されたか */
    isPressed(code) {
        return !!this.keys[code] && !this.prevKeys[code];
    }

    /** フレーム終わりに呼ぶ */
    update() {
        this.prevKeys = { ...this.keys };
    }
}
