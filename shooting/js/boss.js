// ===== ボスシステム =====
import { GAME, BOSS_PHASES } from './constants.js';

export class Boss {
    constructor(bulletManager, patternGen, effects, audio) {
        this.bm = bulletManager;
        this.patterns = patternGen;
        this.effects = effects;
        this.audio = audio;

        // ボススプライト画像の読み込み
        this.sprite = new Image();
        this.sprite.src = 'img/boss.png';
        this.spriteLoaded = false;
        this.sprite.onload = () => { this.spriteLoaded = true; };

        this.reset();
    }

    reset() {
        this.x = GAME.centerX;
        this.y = GAME.y + 80;
        this.targetX = GAME.centerX;
        this.targetY = GAME.y + 80;
        this.phase = 0;
        this.hp = BOSS_PHASES[0].hp;
        this.maxHp = BOSS_PHASES[0].hp;
        this.timer = BOSS_PHASES[0].time;
        this.active = false;
        this.defeated = false;
        this.entering = false;
        this.enterTimer = 0;
        this.moveTimer = 0;
        this.auraAngle = 0;
        this.spellBgAlpha = 0;
        this.spellNameTimer = 0;
        this.phaseTransition = 0;
        this.totalPhases = BOSS_PHASES.length;
        this.invincible = false;
        this.floatOffset = 0;
    }

    get currentPhase() {
        return BOSS_PHASES[this.phase] || null;
    }

    get isSpell() {
        return this.currentPhase && this.currentPhase.type === 'spell';
    }

    get spellName() {
        return this.isSpell ? this.currentPhase.name : '';
    }

    /** ボス登場開始 */
    startEntry() {
        this.active = true;
        this.entering = true;
        this.enterTimer = 120;
        this.x = GAME.centerX;
        this.y = GAME.y - 40;
        this.targetY = GAME.y + 80;
        this.invincible = true;
    }

    update(playerX, playerY) {
        if (!this.active || this.defeated) return;

        this.auraAngle += 0.03;

        // 登場演出
        if (this.entering) {
            this.enterTimer--;
            this.y += (this.targetY - this.y) * 0.05;
            if (this.enterTimer <= 0) {
                this.entering = false;
                this.invincible = false;
                this.y = this.targetY;
                this._startPhase();
            }
            return;
        }

        // フェーズ移行中
        if (this.phaseTransition > 0) {
            this.phaseTransition--;
            // 移行中は中央に戻る
            this.x += (GAME.centerX - this.x) * 0.05;
            this.y += (GAME.y + 80 - this.y) * 0.05;
            if (this.phaseTransition <= 0) {
                this.invincible = false;
                this._startPhase();
            }
            return;
        }

        // タイマー
        this.timer--;
        if (this.timer <= 0) {
            this._nextPhase();
            return;
        }

        // 移動
        this.moveTimer++;
        if (this.moveTimer % 180 === 0) {
            this._pickNewPosition();
        }
        this.x += (this.targetX - this.x) * 0.02;
        this.y += (this.targetY - this.y) * 0.02;

        // 攻撃パターン実行
        this.patterns.executePattern(
            this.currentPhase.pattern,
            this.x, this.y,
            playerX, playerY
        );

        // スペルカード名前表示タイマー
        if (this.spellNameTimer > 0) this.spellNameTimer--;

        // スペル背景アルファ
        if (this.isSpell) {
            this.spellBgAlpha = Math.min(1, this.spellBgAlpha + 0.02);
        } else {
            this.spellBgAlpha = Math.max(0, this.spellBgAlpha - 0.05);
        }
    }

    /** ダメージを受ける */
    takeDamage(damage) {
        if (this.invincible || !this.active || this.defeated || this.entering) return;

        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this._nextPhase();
        }
    }

    _startPhase() {
        const phase = this.currentPhase;
        if (!phase) return;

        this.hp = phase.hp;
        this.maxHp = phase.hp;
        this.timer = phase.time;
        this.patterns.resetTimer();
        this.moveTimer = 0;

        if (phase.type === 'spell') {
            this.spellNameTimer = 180; // 3秒間表示
            this.effects.spellActivate(this.x, this.y);
            this.audio.play('spellCard');
        }
    }

    _nextPhase() {
        this.bm.clearAll(this.effects);
        this.phase++;

        if (this.phase >= this.totalPhases) {
            // 全フェーズ終了 = 撃破
            this.defeated = true;
            this.effects.bossDefeat(this.x, this.y);
            this.audio.play('defeat');
            return;
        }

        // 次のフェーズへ移行
        this.invincible = true;
        this.phaseTransition = 60;
        this.patterns.resetTimer();
    }

    _pickNewPosition() {
        const margin = 60;
        this.targetX = GAME.x + margin + Math.random() * (GAME.width - margin * 2);
        this.targetY = GAME.y + 50 + Math.random() * 80;
    }

    // ===== 描画 =====

    render(ctx) {
        if (!this.active || this.defeated) return;

        // 浮遊アニメーション
        this.floatOffset = Math.sin(this.auraAngle * 1.5) * 4;

        ctx.save();
        ctx.translate(this.x, this.y + this.floatOffset);

        // オーラ
        for (let i = 0; i < 3; i++) {
            const angle = this.auraAngle + i * (Math.PI * 2 / 3);
            const r = 45 + Math.sin(angle * 2) * 8;
            const grd = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
            grd.addColorStop(0, 'rgba(150, 80, 255, 0.18)');
            grd.addColorStop(1, 'rgba(150, 80, 255, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(
                Math.cos(angle) * 10,
                Math.sin(angle) * 10,
                r, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // 回転する魔法陣（外側）
        ctx.save();
        ctx.rotate(this.auraAngle);
        ctx.strokeStyle = 'rgba(200, 150, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        const points = 6;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            const a = (i / points) * Math.PI * 2;
            const px = Math.cos(a) * 36;
            const py = Math.sin(a) * 36;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // ボス本体（スプライト画像）
        if (this.spriteLoaded) {
            const spriteSize = 64;
            ctx.imageSmoothingEnabled = false; // ドット絵をくっきり表示
            ctx.drawImage(this.sprite,
                -spriteSize / 2, -spriteSize / 2,
                spriteSize, spriteSize
            );
            ctx.imageSmoothingEnabled = true;
        } else {
            // フォールバック（画像未読み込み時）
            const bodyGrd = ctx.createRadialGradient(0, -3, 0, 0, 0, 16);
            bodyGrd.addColorStop(0, '#cc88ff');
            bodyGrd.addColorStop(0.6, '#8844cc');
            bodyGrd.addColorStop(1, '#552299');
            ctx.fillStyle = bodyGrd;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /** HP バー描画（ゲームエリア上部） */
    renderHPBar(ctx) {
        if (!this.active || this.defeated || this.entering) return;

        const barX = GAME.x + 8;
        const barY = GAME.y + 6;
        const barW = GAME.width - 16;
        const barH = 4;

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // 残りフェーズを表すセグメント
        const remaining = this.totalPhases - this.phase;
        const segW = barW / remaining;

        for (let i = 0; i < remaining; i++) {
            if (i === 0) {
                // 現在のフェーズ（HP比率で表示）
                const ratio = this.hp / this.maxHp;
                const color = this.isSpell ? '#cc66ff' : '#44ff88';
                ctx.fillStyle = color;
                ctx.fillRect(barX + i * segW, barY, segW * ratio, barH);
            } else {
                // 未来のフェーズ
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(barX + i * segW + 1, barY, segW - 2, barH);
            }
        }
    }

    /** スペルカード名表示 */
    renderSpellName(ctx) {
        if (this.spellNameTimer <= 0 || !this.isSpell) return;

        const alpha = this.spellNameTimer > 150 ?
            (180 - this.spellNameTimer) / 30 :
            Math.min(1, this.spellNameTimer / 30);

        ctx.save();
        ctx.globalAlpha = alpha;

        // 背景バー
        ctx.fillStyle = 'rgba(50, 0, 80, 0.7)';
        ctx.fillRect(GAME.x, GAME.y + 20, GAME.width, 28);

        // 上下ライン
        ctx.strokeStyle = '#cc88ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(GAME.x, GAME.y + 20);
        ctx.lineTo(GAME.right, GAME.y + 20);
        ctx.moveTo(GAME.x, GAME.y + 48);
        ctx.lineTo(GAME.right, GAME.y + 48);
        ctx.stroke();

        // スペル名
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.spellName, GAME.right - 12, GAME.y + 34);

        // タイマー
        const seconds = Math.ceil(this.timer / 60);
        ctx.textAlign = 'left';
        ctx.font = 'bold 14px "Orbitron", monospace';
        ctx.fillStyle = seconds <= 10 ? '#ff4444' : '#ffffff';
        ctx.fillText(String(seconds), GAME.x + 8, GAME.y + 34);

        ctx.restore();
    }

    /** スペルカード背景エフェクト */
    renderSpellBg(ctx) {
        if (this.spellBgAlpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.spellBgAlpha * 0.15;

        // 回転する魔法陣みたいな背景
        const cx = GAME.centerX;
        const cy = GAME.centerY;

        ctx.translate(cx, cy);
        ctx.rotate(this.auraAngle * 0.5);

        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
        grd.addColorStop(0, '#cc44ff');
        grd.addColorStop(0.5, '#6622aa');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, 200, 0, Math.PI * 2);
        ctx.fill();

        // 六芒星
        ctx.strokeStyle = 'rgba(200, 150, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let s = 0; s < 2; s++) {
            ctx.beginPath();
            for (let i = 0; i <= 3; i++) {
                const a = (i / 3) * Math.PI * 2 + s * (Math.PI / 3);
                const px = Math.cos(a) * 150;
                const py = Math.sin(a) * 150;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }
}
