// ===== ゲーム定数 =====

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;

// ゲームプレイエリア（左側）
export const GAME = {
    x: 32,
    y: 16,
    width: 384,
    height: 448,
    get right() { return this.x + this.width; },
    get bottom() { return this.y + this.height; },
    get centerX() { return this.x + this.width / 2; },
    get centerY() { return this.y + this.height / 2; },
};

// プレイヤー設定
export const PLAYER = {
    speed: 4.5,
    focusSpeed: 1.8,
    hitboxRadius: 3,
    grazeRadius: 18,
    shotInterval: 4,
    shotSpeed: 14,
    shotDamage: 10,
    bombDuration: 180,
    initLives: 3,
    initBombs: 3,
    invincibleTime: 180,
    respawnDelay: 45,
};

// 弾の種類
export const BULLET_TYPES = {
    SMALL:  { radius: 3,  renderSize: 6  },
    MEDIUM: { radius: 5,  renderSize: 10 },
    LARGE:  { radius: 8,  renderSize: 16 },
    RICE:   { radius: 3,  renderSize: 8,  shape: 'rice' },
    DOT:    { radius: 2,  renderSize: 4  },
    ORB:    { radius: 10, renderSize: 20 },
};

// 弾の色パレット
export const COLORS = {
    RED:    { core: '#ff4444', glow: 'rgba(255,68,68,0.4)',   outer: '#ff8888' },
    BLUE:   { core: '#4488ff', glow: 'rgba(68,136,255,0.4)',  outer: '#88bbff' },
    CYAN:   { core: '#44ddff', glow: 'rgba(68,221,255,0.4)',  outer: '#88eeff' },
    GREEN:  { core: '#44ff88', glow: 'rgba(68,255,136,0.4)',  outer: '#88ffbb' },
    YELLOW: { core: '#ffdd44', glow: 'rgba(255,221,68,0.4)',  outer: '#ffee88' },
    PURPLE: { core: '#cc44ff', glow: 'rgba(204,68,255,0.4)',  outer: '#dd88ff' },
    PINK:   { core: '#ff66cc', glow: 'rgba(255,102,204,0.4)', outer: '#ff99dd' },
    WHITE:  { core: '#ffffff', glow: 'rgba(255,255,255,0.3)', outer: '#cccccc' },
    ORANGE: { core: '#ff8844', glow: 'rgba(255,136,68,0.4)',  outer: '#ffaa77' },
};

// ボス設定
export const BOSS_PHASES = [
    // Phase 0: 通常弾幕1
    {
        type: 'nonspell',
        hp: 1600,
        time: 30 * 60, // 30秒 (60fps)
        pattern: 'circleAimed',
    },
    // Phase 1: スペルカード1
    {
        type: 'spell',
        name: '幻符「夢幻の花弾」',
        hp: 2400,
        time: 40 * 60,
        pattern: 'flowerSpiral',
    },
    // Phase 2: 通常弾幕2
    {
        type: 'nonspell',
        hp: 2000,
        time: 30 * 60,
        pattern: 'denseRings',
    },
    // Phase 3: スペルカード2
    {
        type: 'spell',
        name: '時符「時空の螺旋」',
        hp: 3000,
        time: 45 * 60,
        pattern: 'doubleSpiral',
    },
    // Phase 4: 通常弾幕3
    {
        type: 'nonspell',
        hp: 2400,
        time: 30 * 60,
        pattern: 'starBurst',
    },
    // Phase 5: 最終スペルカード
    {
        type: 'spell',
        name: '禁弾「紅蓮の大嵐」',
        hp: 4000,
        time: 60 * 60,
        pattern: 'finalStorm',
    },
];
