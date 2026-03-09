// ===== プレイヤー =====
import { GAME, PLAYER } from './constants.js';

export class Player {
    constructor(input, audio) {
        this.input = input;
        this.audio = audio;
        this.reset();
    }

    reset() {
        this.x = GAME.centerX;
        this.y = GAME.y + GAME.height - 48;
        this.lives = PLAYER.initLives;
        this.bombs = PLAYER.initBombs;
        this.score = 0;
        this.hiScore = 0;
        this.graze = 0;
        this.shotTimer = 0;
        this.invincible = 0;
        this.bombing = 0;
        this.dead = false;
        this.deathTimer = 0;
        this.focused = false;
        this.bullets = [];
        this.orbAngle = 0;
        this.grazeSet = new Set(); // 同じ弾に2回グレイズしない
    }

    get isAlive() {
        return !this.dead;
    }

    get isInvincible() {
        return this.invincible > 0 || this.bombing > 0;
    }

    update(effects) {
        this.orbAngle += this.focused ? 0.05 : 0.02;

        if (this.dead) {
            this.deathTimer--;
            if (this.deathTimer <= 0) {
                this.respawn();
            }
            return;
        }

        // ----- 移動 -----
        this.focused = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        const speed = this.focused ? PLAYER.focusSpeed : PLAYER.speed;

        let dx = 0, dy = 0;
        if (this.input.isDown('ArrowLeft'))  dx -= 1;
        if (this.input.isDown('ArrowRight')) dx += 1;
        if (this.input.isDown('ArrowUp'))    dy -= 1;
        if (this.input.isDown('ArrowDown'))  dy += 1;

        // 斜め移動の正規化
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.SQRT2;
            dx *= inv;
            dy *= inv;
        }

        this.x += dx * speed;
        this.y += dy * speed;

        // ゲームエリア内にクランプ
        this.x = Math.max(GAME.x + 8, Math.min(GAME.right - 8, this.x));
        this.y = Math.max(GAME.y + 16, Math.min(GAME.bottom - 16, this.y));

        // ----- ショット -----
        if (this.input.isDown('KeyZ')) {
            this.shotTimer--;
            if (this.shotTimer <= 0) {
                this.shoot();
                this.shotTimer = PLAYER.shotInterval;
            }
        } else {
            this.shotTimer = 0;
        }

        // ----- ボム -----
        if (this.input.isPressed('KeyX') && this.bombs > 0 && this.bombing <= 0) {
            this.activateBomb(effects);
        }

        // ボムの持続エフェクト
        if (this.bombing > 0) {
            this.bombing--;
            if (this.bombing % 3 === 0) {
                effects.bombContinuous(this.x, this.y);
            }
        }

        if (this.invincible > 0) this.invincible--;

        // ----- 自弾更新 -----
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.y -= PLAYER.shotSpeed;
            if (b.y < GAME.y - 20) {
                this.bullets.splice(i, 1);
            }
        }
    }

    shoot() {
        this.audio.play('shot');

        if (this.focused) {
            // 集中ショット：前方に集中
            this.bullets.push(
                { x: this.x - 6, y: this.y - 20, w: 3, h: 14, dmg: PLAYER.shotDamage },
                { x: this.x + 3, y: this.y - 20, w: 3, h: 14, dmg: PLAYER.shotDamage },
            );
        } else {
            // 拡散ショット
            this.bullets.push(
                { x: this.x - 10, y: this.y - 16, w: 3, h: 12, dmg: PLAYER.shotDamage * 0.7 },
                { x: this.x - 3,  y: this.y - 20, w: 3, h: 14, dmg: PLAYER.shotDamage },
                { x: this.x + 3,  y: this.y - 20, w: 3, h: 14, dmg: PLAYER.shotDamage },
                { x: this.x + 7,  y: this.y - 16, w: 3, h: 12, dmg: PLAYER.shotDamage * 0.7 },
            );
        }
    }

    activateBomb(effects) {
        this.bombs--;
        this.bombing = PLAYER.bombDuration;
        this.invincible = PLAYER.bombDuration + 30;
        effects.bombActivate(this.x, this.y);
        this.audio.play('bomb');
    }

    /** 被弾処理。trueを返したら実際に死亡 */
    hit(effects) {
        if (this.isInvincible) return false;
        this.lives--;
        this.dead = true;
        this.deathTimer = PLAYER.respawnDelay;
        effects.playerDeath(this.x, this.y);
        this.audio.play('hit');
        this.grazeSet.clear();
        return true;
    }

    respawn() {
        this.dead = false;
        this.x = GAME.centerX;
        this.y = GAME.y + GAME.height - 48;
        this.invincible = PLAYER.invincibleTime;
        this.bombs = Math.max(this.bombs, PLAYER.initBombs);
        this.bullets = [];
    }

    // ----- 描画 -----
    render(ctx) {
        if (this.dead) return;

        // 無敵点滅
        if (this.invincible > 0 && this.bombing <= 0 && Math.floor(this.invincible / 3) % 2 === 0) {
            // 点滅中でもヒットボックスは表示
            if (this.focused) this._drawHitbox(ctx);
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // グロー
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
        grd.addColorStop(0, 'rgba(255, 80, 80, 0.25)');
        grd.addColorStop(1, 'rgba(255, 80, 80, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();

        // オーブ（低速時）
        if (this.focused) {
            for (let i = 0; i < 4; i++) {
                const a = this.orbAngle + (i * Math.PI / 2);
                const ox = Math.cos(a) * 20;
                const oy = Math.sin(a) * 20;
                ctx.fillStyle = 'rgba(255, 150, 150, 0.6)';
                ctx.beginPath();
                ctx.arc(ox, oy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 本体（三角形）
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(-9, 10);
        ctx.lineTo(0, 6);
        ctx.lineTo(9, 10);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ff8888';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 内側のハイライト
        ctx.fillStyle = '#ff8866';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-4, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(4, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // ヒットボックス表示
        if (this.focused) this._drawHitbox(ctx);
    }

    _drawHitbox(ctx) {
        ctx.save();

        // 外側リング
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, PLAYER.grazeRadius, 0, Math.PI * 2);
        ctx.stroke();

        // ヒットボックス（極小の白い点）
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, PLAYER.hitboxRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    renderBullets(ctx) {
        for (const b of this.bullets) {
            // グロー
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(b.x - 2, b.y - 1, b.w + 4, b.h + 2);
            // 弾本体
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(b.x, b.y, b.w, b.h);
        }
    }
}
