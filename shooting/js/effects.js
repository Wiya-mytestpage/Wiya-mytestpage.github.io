// ===== エフェクトシステム =====

export class Particle {
    constructor(x, y, vx, vy, life, color, size, type = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.type = type;
        this.alpha = 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life--;
        this.alpha = this.life / this.maxLife;
        return this.life > 0;
    }

    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (this.type === 'circle') {
            const s = this.size * (0.5 + 0.5 * this.alpha);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'spark') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size * this.alpha;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
            ctx.stroke();
        } else if (this.type === 'ring') {
            const s = this.size * (1 + (1 - this.alpha) * 3);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2 * this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

export class EffectManager {
    constructor() {
        this.particles = [];
        this.screenShake = 0;
        this.screenFlash = 0;
        this.screenFlashColor = '#ffffff';
    }

    update() {
        this.particles = this.particles.filter(p => p.update());
        if (this.screenShake > 0) this.screenShake--;
        if (this.screenFlash > 0) this.screenFlash--;
    }

    render(ctx) {
        for (const p of this.particles) {
            p.render(ctx);
        }
    }

    renderFlash(ctx, width, height) {
        if (this.screenFlash > 0) {
            ctx.save();
            ctx.globalAlpha = this.screenFlash / 20;
            ctx.fillStyle = this.screenFlashColor;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
    }

    getShakeOffset() {
        if (this.screenShake <= 0) return { x: 0, y: 0 };
        const intensity = Math.min(this.screenShake, 8);
        return {
            x: (Math.random() - 0.5) * intensity,
            y: (Math.random() - 0.5) * intensity,
        };
    }

    // --- エフェクト生成 ---

    /** 弾消滅エフェクト */
    bulletDestroy(x, y, color) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                15 + Math.random() * 10,
                color,
                2 + Math.random() * 2,
                'spark'
            ));
        }
    }

    /** プレイヤー死亡エフェクト */
    playerDeath(x, y) {
        this.screenShake = 15;
        this.screenFlash = 15;
        this.screenFlashColor = '#ff4444';

        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                30 + Math.random() * 30,
                Math.random() > 0.5 ? '#ff4444' : '#ffaa44',
                3 + Math.random() * 4,
                'spark'
            ));
        }
        // 衝撃波リング
        this.particles.push(new Particle(x, y, 0, 0, 30, '#ff6666', 10, 'ring'));
        this.particles.push(new Particle(x, y, 0, 0, 40, '#ffaaaa', 8, 'ring'));
    }

    /** ボム発動エフェクト */
    bombActivate(x, y) {
        this.screenFlash = 20;
        this.screenFlashColor = '#ffffff';
        this.screenShake = 10;

        for (let i = 0; i < 3; i++) {
            this.particles.push(new Particle(
                x, y, 0, 0,
                40 + i * 15,
                'rgba(255,255,255,0.6)',
                20 + i * 10,
                'ring'
            ));
        }

        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                40 + Math.random() * 20,
                '#ffffff',
                2 + Math.random() * 3,
                'spark'
            ));
        }
    }

    /** ボムの持続エフェクト */
    bombContinuous(x, y) {
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 100;
            this.particles.push(new Particle(
                x + Math.cos(angle) * dist,
                y + Math.sin(angle) * dist,
                (Math.random() - 0.5) * 2,
                -1 - Math.random() * 2,
                15 + Math.random() * 10,
                Math.random() > 0.5 ? '#aaddff' : '#ffffff',
                2 + Math.random() * 2,
                'circle'
            ));
        }
    }

    /** グレイズエフェクト */
    graze(x, y) {
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 1.5;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                10 + Math.random() * 8,
                '#ffffff',
                1.5 + Math.random(),
                'spark'
            ));
        }
    }

    /** ボス撃破エフェクト */
    bossDefeat(x, y) {
        this.screenShake = 30;
        this.screenFlash = 25;
        this.screenFlashColor = '#ffffff';

        for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 8;
            const colors = ['#ff4444', '#ffaa44', '#ffff44', '#44ff88', '#44aaff', '#cc44ff'];
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                40 + Math.random() * 40,
                colors[Math.floor(Math.random() * colors.length)],
                2 + Math.random() * 4,
                Math.random() > 0.3 ? 'spark' : 'circle'
            ));
        }

        for (let i = 0; i < 5; i++) {
            this.particles.push(new Particle(
                x, y, 0, 0,
                30 + i * 10,
                '#ffffff',
                15 + i * 8,
                'ring'
            ));
        }
    }

    /** スペルカード開始エフェクト */
    spellActivate(x, y) {
        this.screenFlash = 15;
        this.screenFlashColor = '#9944ff';

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const speed = 3 + Math.random() * 2;
            this.particles.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                30 + Math.random() * 15,
                '#cc66ff',
                3 + Math.random() * 2,
                'spark'
            ));
        }
        this.particles.push(new Particle(x, y, 0, 0, 35, '#cc66ff', 20, 'ring'));
    }

    /** ヒットエフェクト（ボスがダメージを受けた時） */
    bossHit(x, y) {
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.particles.push(new Particle(
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                8 + Math.random() * 6,
                '#ffffff',
                2,
                'circle'
            ));
        }
    }
}

// ===== 背景の星空 =====
export class StarField {
    constructor(gameArea) {
        this.stars = [];
        this.gameArea = gameArea;
        for (let i = 0; i < 80; i++) {
            this.stars.push({
                x: gameArea.x + Math.random() * gameArea.width,
                y: gameArea.y + Math.random() * gameArea.height,
                size: 0.5 + Math.random() * 1.5,
                speed: 0.2 + Math.random() * 0.6,
                brightness: 0.3 + Math.random() * 0.7,
                twinkle: Math.random() * Math.PI * 2,
            });
        }
    }

    update() {
        for (const star of this.stars) {
            star.y += star.speed;
            star.twinkle += 0.03;
            if (star.y > this.gameArea.bottom) {
                star.y = this.gameArea.y;
                star.x = this.gameArea.x + Math.random() * this.gameArea.width;
            }
        }
    }

    render(ctx) {
        for (const star of this.stars) {
            const alpha = star.brightness * (0.6 + 0.4 * Math.sin(star.twinkle));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#aabbdd';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// ===== 簡易オーディオ =====
export class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.15;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            switch (type) {
                case 'shot': this._beep(880, 0.03, 'square', 0.05); break;
                case 'bomb': this._sweep(200, 800, 0.5, 0.3); break;
                case 'hit': this._beep(220, 0.15, 'sawtooth', 0.2); break;
                case 'graze': this._beep(1200, 0.02, 'sine', 0.03); break;
                case 'enemyHit': this._beep(600, 0.03, 'square', 0.03); break;
                case 'spellCard': this._sweep(400, 1200, 0.3, 0.25); break;
                case 'defeat': this._sweep(800, 200, 0.8, 0.3); break;
            }
        } catch (e) { /* ignore audio errors */ }
    }

    _beep(freq, duration, type, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    _sweep(freqStart, freqEnd, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}
