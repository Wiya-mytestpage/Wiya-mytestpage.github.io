// ===== 弾幕システム =====
import { GAME, BULLET_TYPES, COLORS } from './constants.js';

export class Bullet {
    constructor(x, y, vx, vy, type, color, id = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;       // BULLET_TYPES のキー
        this.color = color;     // COLORS のキー
        this.id = id;           // グレイズ重複チェック用
        this.age = 0;
        this.active = true;
        // 曲がる弾用
        this.accelX = 0;
        this.accelY = 0;
        this.angularVel = 0;    // 回転速度
    }

    update() {
        this.vx += this.accelX;
        this.vy += this.accelY;

        if (this.angularVel !== 0) {
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const angle = Math.atan2(this.vy, this.vx) + this.angularVel;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.age++;

        // 画面外判定（余裕を持つ）
        const margin = 40;
        if (this.x < GAME.x - margin || this.x > GAME.right + margin ||
            this.y < GAME.y - margin || this.y > GAME.bottom + margin) {
            this.active = false;
        }
    }
}

export class BulletManager {
    constructor() {
        this.bullets = [];
        this.nextId = 1;
    }

    clear() {
        this.bullets = [];
    }

    /** 弾を追加 */
    add(x, y, vx, vy, typeName = 'SMALL', colorName = 'RED') {
        const b = new Bullet(x, y, vx, vy,
            BULLET_TYPES[typeName] || BULLET_TYPES.SMALL,
            COLORS[colorName] || COLORS.RED,
            this.nextId++
        );
        this.bullets.push(b);
        return b;
    }

    update() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update();
            if (!this.bullets[i].active) {
                this.bullets.splice(i, 1);
            }
        }
    }

    /** プレイヤーとの当たり判定 */
    checkCollision(player, effects) {
        if (!player.isAlive || player.isInvincible) return false;

        const hitR = player.focused ? 2 : 3; // ヒットボックス半径

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            const dx = b.x - player.x;
            const dy = b.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const collR = b.type.radius + hitR;

            if (dist < collR) {
                // 被弾！
                this.bullets.splice(i, 1);
                return true;
            }

            // グレイズ判定
            if (dist < b.type.radius + 18 && !player.grazeSet.has(b.id)) {
                player.grazeSet.add(b.id);
                player.graze++;
                player.score += 100;
                effects.graze(b.x, b.y);
            }
        }
        return false;
    }

    /** ボムで弾消し */
    clearInRadius(x, y, radius, effects) {
        let count = 0;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            const dx = b.x - x;
            const dy = b.y - y;
            if (dx * dx + dy * dy < radius * radius) {
                effects.bulletDestroy(b.x, b.y, b.color.core);
                this.bullets.splice(i, 1);
                count++;
            }
        }
        return count;
    }

    /** 全弾消し（フェーズ移行時） */
    clearAll(effects) {
        for (const b of this.bullets) {
            if (Math.random() < 0.3) {
                effects.bulletDestroy(b.x, b.y, b.color.core);
            }
        }
        this.bullets = [];
    }

    /** 弾の数 */
    get count() {
        return this.bullets.length;
    }

    // ===== 描画 =====
    render(ctx) {
        for (const b of this.bullets) {
            this._renderBullet(ctx, b);
        }
    }

    _renderBullet(ctx, b) {
        const { type, color } = b;
        const s = type.renderSize;

        ctx.save();
        ctx.translate(b.x, b.y);

        // グロー
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.2);
        grd.addColorStop(0, color.glow);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
        ctx.fill();

        if (type.shape === 'rice') {
            // ライス弾（細長い楕円）
            const angle = Math.atan2(b.vy, b.vx);
            ctx.rotate(angle);
            ctx.fillStyle = color.outer;
            ctx.beginPath();
            ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color.core;
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 丸弾
            ctx.fillStyle = color.outer;
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // 明るいコア
            ctx.fillStyle = color.core;
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // ハイライト
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(-s * 0.1, -s * 0.1, s * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ===== 弾幕パターン生成器 =====
export class PatternGenerator {
    constructor(bulletManager) {
        this.bm = bulletManager;
        this.timer = 0;
    }

    resetTimer() {
        this.timer = 0;
    }

    // --- 基本パターン ---

    /** 全方向均等発射 */
    circleShot(x, y, count, speed, colorName, typeName = 'SMALL', angleOffset = 0) {
        for (let i = 0; i < count; i++) {
            const angle = angleOffset + (i / count) * Math.PI * 2;
            this.bm.add(x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                typeName, colorName
            );
        }
    }

    /** 自機狙い弾 */
    aimedShot(x, y, targetX, targetY, speed, colorName, typeName = 'SMALL') {
        const angle = Math.atan2(targetY - y, targetX - x);
        this.bm.add(x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            typeName, colorName
        );
    }

    /** 扇形発射 */
    fanShot(x, y, targetX, targetY, count, spreadAngle, speed, colorName, typeName = 'SMALL') {
        const baseAngle = Math.atan2(targetY - y, targetX - x);
        const startAngle = baseAngle - spreadAngle / 2;
        const step = count > 1 ? spreadAngle / (count - 1) : 0;

        for (let i = 0; i < count; i++) {
            const angle = startAngle + step * i;
            this.bm.add(x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                typeName, colorName
            );
        }
    }

    /** リング弾（同心円状に広がる） */
    ringShot(x, y, count, speed, colorName, typeName = 'MEDIUM', angleOffset = 0) {
        this.circleShot(x, y, count, speed, colorName, typeName, angleOffset);
    }

    // --- 複合パターン（ボスの攻撃で使用） ---

    /** パターン: 円形 + 自機狙い */
    pattern_circleAimed(x, y, playerX, playerY) {
        this.timer++;

        // 円形弾幕（40フレームごと）
        if (this.timer % 40 === 0) {
            const offset = (this.timer / 40) * 0.15;
            this.circleShot(x, y, 20, 2.2, 'BLUE', 'SMALL', offset);
        }

        // 自機狙い（25フレームごと）
        if (this.timer % 25 === 0) {
            this.fanShot(x, y, playerX, playerY, 3, 0.3, 3.5, 'RED', 'RICE');
        }
    }

    /** パターン: 花弾螺旋 */
    pattern_flowerSpiral(x, y, _px, _py) {
        this.timer++;
        const petals = 6;
        const baseAngle = this.timer * 0.02;

        // 花弁パターン（8フレームごと）
        if (this.timer % 8 === 0) {
            for (let p = 0; p < petals; p++) {
                const petalAngle = baseAngle + (p / petals) * Math.PI * 2;
                const speed = 1.8 + 0.5 * Math.sin(this.timer * 0.05);
                const b = this.bm.add(x, y,
                    Math.cos(petalAngle) * speed,
                    Math.sin(petalAngle) * speed,
                    'MEDIUM', p % 2 === 0 ? 'PURPLE' : 'PINK'
                );
                b.angularVel = 0.015 * (p % 2 === 0 ? 1 : -1);
            }
        }

        // 背景の散り弾（20フレームごと）
        if (this.timer % 20 === 0) {
            this.circleShot(x, y, 12, 1.5, 'CYAN', 'DOT', baseAngle * 2);
        }
    }

    /** パターン: 密集リング */
    pattern_denseRings(x, y, playerX, playerY) {
        this.timer++;

        // 二重リング（30フレームごと）
        if (this.timer % 30 === 0) {
            const offset = (this.timer / 30) * 0.2;
            this.circleShot(x, y, 24, 2.0, 'GREEN', 'SMALL', offset);
            this.circleShot(x, y, 24, 2.4, 'CYAN', 'SMALL', offset + Math.PI / 24);
        }

        // 自機狙い大玉（50フレームごと）
        if (this.timer % 50 === 0) {
            this.aimedShot(x, y, playerX, playerY, 2.5, 'YELLOW', 'LARGE');
        }
    }

    /** パターン: 二重螺旋 */
    pattern_doubleSpiral(x, y, _px, _py) {
        this.timer++;

        if (this.timer % 4 === 0) {
            const arms = 8;
            const baseAngle = this.timer * 0.035;

            for (let a = 0; a < arms; a++) {
                const angle = baseAngle + (a / arms) * Math.PI * 2;
                const speed = 2.0;
                const colorName = a % 2 === 0 ? 'BLUE' : 'RED';
                this.bm.add(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    'SMALL', colorName
                );
            }
        }

        // 逆回転の外側リング（50フレームごと）
        if (this.timer % 50 === 0) {
            const offset = -this.timer * 0.03;
            this.circleShot(x, y, 16, 1.5, 'YELLOW', 'MEDIUM', offset);
        }
    }

    /** パターン: 星形バースト */
    pattern_starBurst(x, y, playerX, playerY) {
        this.timer++;

        // 星形パターン（35フレームごと）
        if (this.timer % 35 === 0) {
            const points = 5;
            const layers = 3;
            const baseAngle = (this.timer / 35) * 0.3;

            for (let l = 0; l < layers; l++) {
                const speed = 1.5 + l * 0.5;
                for (let p = 0; p < points; p++) {
                    const angle = baseAngle + (p / points) * Math.PI * 2;
                    // 星の頂点
                    this.bm.add(x, y,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        'MEDIUM', 'ORANGE'
                    );
                    // 星の谷
                    const midAngle = angle + Math.PI / points;
                    this.bm.add(x, y,
                        Math.cos(midAngle) * speed * 0.6,
                        Math.sin(midAngle) * speed * 0.6,
                        'SMALL', 'YELLOW'
                    );
                }
            }
        }

        // 自機狙いライス弾（20フレームごと）
        if (this.timer % 20 === 0) {
            this.fanShot(x, y, playerX, playerY, 5, 0.6, 3.0, 'RED', 'RICE');
        }
    }

    /** パターン: 最終弾幕 - 紅蓮の大嵐 */
    pattern_finalStorm(x, y, playerX, playerY) {
        this.timer++;

        // メイン螺旋（3フレームごと）
        if (this.timer % 3 === 0) {
            const arms = 6;
            const baseAngle = this.timer * 0.04;
            for (let a = 0; a < arms; a++) {
                const angle = baseAngle + (a / arms) * Math.PI * 2;
                const speed = 2.2;
                const colors = ['RED', 'ORANGE', 'YELLOW', 'PINK', 'PURPLE', 'BLUE'];
                this.bm.add(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    'SMALL', colors[a % colors.length]
                );
            }
        }

        // 拡散リング（45フレームごと）
        if (this.timer % 45 === 0) {
            this.circleShot(x, y, 32, 1.8, 'WHITE', 'MEDIUM', Math.random() * Math.PI);
        }

        // 自機狙い（30フレームごと）
        if (this.timer % 30 === 0) {
            this.fanShot(x, y, playerX, playerY, 7, 0.8, 2.8, 'RED', 'RICE');
        }

        // 曲がる弾（60フレームごと）
        if (this.timer % 60 === 0) {
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const b = this.bm.add(x, y,
                    Math.cos(angle) * 1.5,
                    Math.sin(angle) * 1.5,
                    'LARGE', 'PURPLE'
                );
                b.angularVel = 0.02 * (i % 2 === 0 ? 1 : -1);
            }
        }
    }

    /** パターンを名前で呼び出し */
    executePattern(patternName, x, y, playerX, playerY) {
        switch (patternName) {
            case 'circleAimed':   this.pattern_circleAimed(x, y, playerX, playerY); break;
            case 'flowerSpiral':  this.pattern_flowerSpiral(x, y, playerX, playerY); break;
            case 'denseRings':    this.pattern_denseRings(x, y, playerX, playerY); break;
            case 'doubleSpiral':  this.pattern_doubleSpiral(x, y, playerX, playerY); break;
            case 'starBurst':     this.pattern_starBurst(x, y, playerX, playerY); break;
            case 'finalStorm':    this.pattern_finalStorm(x, y, playerX, playerY); break;
        }
    }
}
