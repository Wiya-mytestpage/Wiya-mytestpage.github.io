// ===== メインゲーム =====
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME, PLAYER } from './constants.js';
import { InputManager } from './input.js';
import { Player } from './player.js';
import { BulletManager, PatternGenerator } from './bullet.js';
import { Boss } from './boss.js';
import { EffectManager, StarField, AudioManager } from './effects.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        // CSS でキャンバスをスケーリング
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());

        this.input = new InputManager();
        this.audio = new AudioManager();
        this.effects = new EffectManager();
        this.stars = new StarField(GAME);

        this.bulletManager = new BulletManager();
        this.patternGen = new PatternGenerator(this.bulletManager);
        this.player = new Player(this.input, this.audio);
        this.boss = new Boss(this.bulletManager, this.patternGen, this.effects, this.audio);

        this.state = 'title'; // title, playing, gameover, victory
        this.stateTimer = 0;
        this.frame = 0;

        // タイトル画面用の弾幕デモ
        this.demoTimer = 0;
        this.demoBullets = [];

        // ローディング画面を消す
        const loadEl = document.getElementById('loading');
        if (loadEl) loadEl.style.display = 'none';

        // ゲームループ開始
        this._lastTime = performance.now();
        this._accumulator = 0;
        this._frameTime = 1000 / 60;
        requestAnimationFrame((t) => this.loop(t));
    }

    _resizeCanvas() {
        const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const winAspect = winW / winH;

        let w, h;
        if (winAspect > aspect) {
            h = Math.min(winH * 0.95, CANVAS_HEIGHT * 2);
            w = h * aspect;
        } else {
            w = Math.min(winW * 0.95, CANVAS_WIDTH * 2);
            h = w / aspect;
        }

        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
    }

    // ===== ゲームループ =====
    loop(timestamp) {
        const delta = timestamp - this._lastTime;
        this._lastTime = timestamp;
        this._accumulator += delta;

        // 固定60fpsで更新
        while (this._accumulator >= this._frameTime) {
            this.update();
            this._accumulator -= this._frameTime;
        }

        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    update() {
        this.frame++;
        this.stateTimer++;

        switch (this.state) {
            case 'title':
                this._updateTitle();
                break;
            case 'playing':
                this._updatePlaying();
                break;
            case 'gameover':
            case 'victory':
                if (this.input.isPressed('KeyZ') && this.stateTimer > 60) {
                    this._startGame();
                }
                break;
        }

        this.stars.update();
        this.effects.update();
        this.input.update();
    }

    _updateTitle() {
        // タイトル画面のデモ弾幕
        this.demoTimer++;
        if (this.demoTimer % 6 === 0) {
            const cx = GAME.centerX;
            const cy = GAME.centerY - 30;
            const arms = 5;
            const baseAngle = this.demoTimer * 0.025;
            for (let a = 0; a < arms; a++) {
                const angle = baseAngle + (a / arms) * Math.PI * 2;
                this.demoBullets.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * 1.5,
                    vy: Math.sin(angle) * 1.5,
                    color: `hsl(${(a / arms) * 360 + this.demoTimer}, 80%, 65%)`,
                    life: 200,
                    size: 4,
                });
            }
        }

        // デモ弾更新
        for (let i = this.demoBullets.length - 1; i >= 0; i--) {
            const b = this.demoBullets[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            if (b.life <= 0 || b.x < GAME.x - 20 || b.x > GAME.right + 20 ||
                b.y < GAME.y - 20 || b.y > GAME.bottom + 20) {
                this.demoBullets.splice(i, 1);
            }
        }

        if (this.input.isPressed('KeyZ')) {
            this.audio.resume();
            this._startGame();
        }
    }

    _startGame() {
        this.state = 'playing';
        this.stateTimer = 0;
        this.demoBullets = [];
        this.player.reset();
        this.bulletManager.clear();
        this.effects = new EffectManager();
        this.boss.reset();
        this.boss.effects = this.effects;

        // ボス登場（少し間をおいて）
        setTimeout(() => {
            if (this.state === 'playing') {
                this.boss.startEntry();
            }
        }, 500);
    }

    _updatePlaying() {
        // プレイヤー更新
        this.player.update(this.effects);

        // ボス更新
        if (this.boss.active && !this.boss.defeated) {
            this.boss.update(this.player.x, this.player.y);
        }

        // 弾更新
        this.bulletManager.update();

        // ボムの弾消し
        if (this.player.bombing > 0 && this.frame % 2 === 0) {
            const cleared = this.bulletManager.clearInRadius(
                this.player.x, this.player.y, 150, this.effects
            );
            this.player.score += cleared * 200;
        }

        // 弾 → プレイヤー当たり判定
        if (this.player.isAlive && !this.player.isInvincible) {
            const hit = this.bulletManager.checkCollision(this.player, this.effects);
            if (hit) {
                this.player.hit(this.effects);
                if (this.player.lives < 0) {
                    this.state = 'gameover';
                    this.stateTimer = 0;
                }
            }
        }

        // 自弾 → ボス当たり判定
        if (this.boss.active && !this.boss.defeated && !this.boss.invincible) {
            for (let i = this.player.bullets.length - 1; i >= 0; i--) {
                const b = this.player.bullets[i];
                const dx = b.x + b.w / 2 - this.boss.x;
                const dy = b.y + b.h / 2 - this.boss.y;
                if (dx * dx + dy * dy < 24 * 24) {
                    this.boss.takeDamage(b.dmg);
                    this.effects.bossHit(b.x, b.y);
                    this.player.score += 50;
                    this.player.bullets.splice(i, 1);
                    this.audio.play('enemyHit');
                }
            }
        }

        // ボス撃破チェック
        if (this.boss.defeated) {
            this.bulletManager.clearAll(this.effects);
            this.player.score += 50000;
            if (this.stateTimer > 0) {
                this.state = 'victory';
                this.stateTimer = 0;
            }
        }
    }

    // ===== 描画 =====
    render() {
        const ctx = this.ctx;

        // 画面全体を暗くクリア
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 画面シェイク
        const shake = this.effects.getShakeOffset();
        ctx.save();
        ctx.translate(shake.x, shake.y);

        // ゲームエリア背景
        ctx.fillStyle = '#08081a';
        ctx.fillRect(GAME.x, GAME.y, GAME.width, GAME.height);

        // ゲームエリアにクリップ
        ctx.save();
        ctx.beginPath();
        ctx.rect(GAME.x, GAME.y, GAME.width, GAME.height);
        ctx.clip();

        // 背景星空
        this.stars.render(ctx);

        switch (this.state) {
            case 'title':
                this._renderTitle(ctx);
                break;
            case 'playing':
                this._renderPlaying(ctx);
                break;
            case 'gameover':
                this._renderPlaying(ctx);
                this._renderGameOver(ctx);
                break;
            case 'victory':
                this._renderPlaying(ctx);
                this._renderVictory(ctx);
                break;
        }

        // エフェクト（クリップ内）
        this.effects.render(ctx);

        ctx.restore(); // クリップ解除

        // ゲームエリア枠
        ctx.strokeStyle = '#332244';
        ctx.lineWidth = 2;
        ctx.strokeRect(GAME.x, GAME.y, GAME.width, GAME.height);

        // サイドバーUI（クリップ外）
        if (this.state === 'playing' || this.state === 'gameover' || this.state === 'victory') {
            this._renderUI(ctx);
        }

        // 画面フラッシュ
        this.effects.renderFlash(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.restore(); // シェイク解除
    }

    _renderTitle(ctx) {
        // デモ弾幕
        for (const b of this.demoBullets) {
            const alpha = Math.min(1, b.life / 30);
            ctx.save();
            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
            // グロー
            ctx.globalAlpha = alpha * 0.2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const cx = GAME.centerX;
        const cy = GAME.centerY;

        // タイトル背景のグラデーション
        ctx.save();
        ctx.globalAlpha = 0.6;
        const titleGrd = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy - 40, 200);
        titleGrd.addColorStop(0, 'rgba(80, 30, 120, 0.5)');
        titleGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = titleGrd;
        ctx.fillRect(GAME.x, GAME.y, GAME.width, GAME.height);
        ctx.restore();

        // タイトル文字
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // メインタイトル
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#cc66ff';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 32px "Noto Sans JP", sans-serif';
        ctx.fillText('超幻想弾', cx, cy - 60);

        // サブタイトル
        ctx.shadowBlur = 10;
        ctx.font = '14px "Orbitron", sans-serif';
        ctx.fillStyle = '#cc99ff';
        ctx.fillText('~ Super Phantom Barrage ~', cx, cy - 28);

        ctx.shadowBlur = 0;

        // Press Z to Start
        const blink = Math.sin(this.frame * 0.05) * 0.4 + 0.6;
        ctx.globalAlpha = blink;
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS Z TO START', cx, cy + 40);

        ctx.globalAlpha = 1;

        // 操作説明
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#8877aa';
        ctx.fillText('↑↓←→: 移動 | Z: ショット | X: ボム | Shift: 低速', cx, cy + 90);

        ctx.restore();
    }

    _renderPlaying(ctx) {
        // スペルカード背景
        this.boss.renderSpellBg(ctx);

        // 自弾
        this.player.renderBullets(ctx);

        // 敵弾
        this.bulletManager.render(ctx);

        // ボス
        this.boss.render(ctx);
        this.boss.renderHPBar(ctx);
        this.boss.renderSpellName(ctx);

        // プレイヤー
        this.player.render(ctx);
    }

    _renderGameOver(ctx) {
        const alpha = Math.min(1, this.stateTimer / 60);
        ctx.save();
        ctx.globalAlpha = alpha;

        // 暗いオーバーレイ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(GAME.x, GAME.y, GAME.width, GAME.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 28px "Orbitron", sans-serif';
        ctx.fillText('GAME OVER', GAME.centerX, GAME.centerY - 20);

        ctx.shadowBlur = 0;
        if (this.stateTimer > 60) {
            const blink = Math.sin(this.frame * 0.05) * 0.4 + 0.6;
            ctx.globalAlpha = alpha * blink;
            ctx.font = '14px "Orbitron", sans-serif';
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText('PRESS Z TO RETRY', GAME.centerX, GAME.centerY + 25);
        }

        ctx.restore();
    }

    _renderVictory(ctx) {
        const alpha = Math.min(1, this.stateTimer / 60);
        ctx.save();
        ctx.globalAlpha = alpha;

        // 明るいオーバーレイ
        ctx.fillStyle = 'rgba(20, 10, 40, 0.5)';
        ctx.fillRect(GAME.x, GAME.y, GAME.width, GAME.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#ffdd44';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
        ctx.fillText('ALL CLEAR!', GAME.centerX, GAME.centerY - 30);

        ctx.shadowBlur = 0;
        ctx.font = '14px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#ffeeaa';
        ctx.fillText(`SCORE: ${this.player.score.toLocaleString()}`, GAME.centerX, GAME.centerY + 10);

        if (this.stateTimer > 60) {
            const blink = Math.sin(this.frame * 0.05) * 0.4 + 0.6;
            ctx.globalAlpha = alpha * blink;
            ctx.font = '14px "Orbitron", sans-serif';
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText('PRESS Z TO RESTART', GAME.centerX, GAME.centerY + 45);
        }

        ctx.restore();
    }

    // ===== サイドバーUI =====
    _renderUI(ctx) {
        const sx = GAME.right + 16;
        const sy = GAME.y + 8;

        // 背景
        ctx.fillStyle = 'rgba(10, 8, 20, 0.8)';
        ctx.fillRect(GAME.right + 4, GAME.y, CANVAS_WIDTH - GAME.right - 8, GAME.height);

        // タイトル
        ctx.fillStyle = '#cc88ff';
        ctx.font = 'bold 12px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('超幻想弾', sx, sy + 12);

        ctx.fillStyle = '#554466';
        ctx.fillRect(sx, sy + 22, 180, 1);

        // HiScore
        let y = sy + 40;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('HiScore', sx, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Orbitron", monospace';
        const hiScore = Math.max(this.player.score, this.player.hiScore);
        ctx.fillText(hiScore.toLocaleString().padStart(10, ' '), sx, y + 16);

        // Score
        y += 38;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('Score', sx, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Orbitron", monospace';
        ctx.fillText(this.player.score.toLocaleString().padStart(10, ' '), sx, y + 16);

        // 残機
        y += 45;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('Player', sx, y);
        y += 14;
        for (let i = 0; i < this.player.lives; i++) {
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.moveTo(sx + i * 18 + 6, y);
            ctx.lineTo(sx + i * 18, y + 10);
            ctx.lineTo(sx + i * 18 + 6, y + 7);
            ctx.lineTo(sx + i * 18 + 12, y + 10);
            ctx.closePath();
            ctx.fill();
        }

        // ボム
        y += 22;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('Bomb', sx, y);
        y += 14;
        for (let i = 0; i < this.player.bombs; i++) {
            ctx.fillStyle = '#44ff88';
            ctx.beginPath();
            ctx.arc(sx + i * 18 + 6, y + 4, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#88ffaa';
            ctx.beginPath();
            ctx.arc(sx + i * 18 + 6, y + 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // グレイズ
        y += 25;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('Graze', sx, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "Orbitron", monospace';
        ctx.fillText(String(this.player.graze), sx, y + 15);

        // 弾数
        y += 30;
        ctx.fillStyle = '#8877aa';
        ctx.font = '10px "Noto Sans JP", sans-serif';
        ctx.fillText('Bullets', sx, y);
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 12px "Orbitron", monospace';
        ctx.fillText(String(this.bulletManager.count), sx, y + 15);

        // ボス情報
        if (this.boss.active && !this.boss.defeated) {
            y += 40;
            ctx.fillStyle = '#554466';
            ctx.fillRect(sx, y, 180, 1);
            y += 12;

            ctx.fillStyle = '#cc88ff';
            ctx.font = '10px "Noto Sans JP", sans-serif';
            ctx.fillText('Boss Phase', sx, y);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px "Orbitron", monospace';
            ctx.fillText(`${this.boss.phase + 1} / ${this.boss.totalPhases}`, sx, y + 15);

            // タイマー
            y += 30;
            ctx.fillStyle = '#8877aa';
            ctx.font = '10px "Noto Sans JP", sans-serif';
            ctx.fillText('Time', sx, y);
            const secs = Math.ceil(this.boss.timer / 60);
            ctx.fillStyle = secs <= 10 ? '#ff4444' : '#ffffff';
            ctx.font = 'bold 14px "Orbitron", monospace';
            ctx.fillText(`${secs}s`, sx, y + 16);
        }

        // 操作説明（下部）
        const bottomY = GAME.bottom - 60;
        ctx.fillStyle = '#554466';
        ctx.fillRect(sx, bottomY, 180, 1);
        ctx.fillStyle = '#5a4a6a';
        ctx.font = '9px "Noto Sans JP", sans-serif';
        ctx.fillText('↑↓←→  移動', sx, bottomY + 14);
        ctx.fillText('Z  ショット', sx, bottomY + 28);
        ctx.fillText('X  ボム', sx, bottomY + 42);
        ctx.fillText('Shift  低速移動', sx, bottomY + 56);
    }
}

// ===== 起動 =====
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
