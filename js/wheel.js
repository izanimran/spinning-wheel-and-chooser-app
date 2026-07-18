/**
 * Decision Wheel — Realistic roulette with physics-based spinning
 */
const WheelEngine = (function () {
    // --- Summer-inspired segment colors ---
    const SEGMENT_COLORS = [
        '#FF6B6B', // coral
        '#2EC4B6', // teal
        '#F4A261', // warm gold
        '#E76F51', // burnt orange
        '#6C63FF', // soft indigo
        '#FF8C42', // sunset orange
        '#48BFE3', // sky blue
        '#B8A9C9', // lavender
        '#F9C74F', // warm yellow
        '#90BE6D', // sage green
        '#FF6B8A', // warm pink
        '#43AA8B', // deep teal
        '#F8961E', // amber
        '#577590', // steel blue
        '#F3722C', // tangerine
        '#9B5DE5', // violet
        '#00BBF9', // bright cyan
        '#FEE440', // bright yellow
        '#F15BB5', // magenta
        '#80ED99', // mint
    ];

    let canvas, ctx;
    let centerX, centerY, radius;
    let options = ['Option 1', 'Option 2'];
    let currentAngle = 0;        // radians
    let angularVelocity = 0;     // radians per frame
    let isSpinning = false;
    let animFrameId = null;
    let onSpinEnd = null;
    let lastSegmentIndex = -1;   // for tick sound

    // Physics — tuned for ~3.5s natural spin feel
    const FRICTION = 0.976;            // single clean deceleration per frame
    const MIN_VELOCITY = 0.003;        // stop threshold (was 0.0008 — too slow)
    const MIN_SPIN_SPEED = 0.38;       // minimum initial rad/frame
    const MAX_SPIN_SPEED = 0.52;       // maximum initial rad/frame

    // Audio context for tick
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTick() {
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 1800 + Math.random() * 400;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) { /* silent fail */ }
    }

    function playWinSound() {
        try {
            const ctx = getAudioCtx();
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                const t = ctx.currentTime + i * 0.12;
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
            });
        } catch (e) { /* silent fail */ }
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize(); // resize() calls draw() internally when canvas is valid
    }

    function resize() {
        const parent = canvas.parentElement;
        const size = Math.min(parent.clientWidth, parent.clientHeight);
        // Guard: skip if not visible (display:none gives 0 dimensions)
        if (size <= 12) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        centerX = size / 2;
        centerY = size / 2;
        radius = size / 2 - 6;
        draw();
    }

    function setOptions(opts) {
        options = opts.slice(0, 20);
        if (options.length < 2) {
            options = ['Option 1', 'Option 2'];
        }
        draw();
    }

    function draw() {
        // Guard: !(radius > 0) catches undefined, NaN, 0, and negative — all invalid states
        if (!canvas || !(radius > 0)) return;
        const size = canvas.width / (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, size, size);

        const segCount = options.length;
        const segAngle = (Math.PI * 2) / segCount;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(currentAngle);

        // Draw segments
        for (let i = 0; i < segCount; i++) {
            const startAngle = i * segAngle;
            const endAngle = startAngle + segAngle;

            // Segment fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.closePath();

            // Gradient fill for depth
            const midAngle = startAngle + segAngle / 2;
            const gx = Math.cos(midAngle) * radius * 0.5;
            const gy = Math.sin(midAngle) * radius * 0.5;
            const grad = ctx.createRadialGradient(gx * 0.3, gy * 0.3, 0, 0, 0, radius);
            const baseColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            grad.addColorStop(0, lighten(baseColor, 15));
            grad.addColorStop(0.7, baseColor);
            grad.addColorStop(1, darken(baseColor, 20));
            ctx.fillStyle = grad;
            ctx.fill();

            // Segment border
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Text
            ctx.save();
            ctx.rotate(startAngle + segAngle / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';

            const text = options[i] || `Option ${i + 1}`;
            const maxTextWidth = radius * 0.55;

            // Text styling
            const fontSize = segCount <= 4 ? 14 : segCount <= 8 ? 12 : segCount <= 14 ? 10 : 9;
            ctx.font = `600 ${fontSize}px 'Outfit', sans-serif`;

            // Text shadow for readability
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillText(truncate(text, ctx, maxTextWidth), radius - 16, 1.5);

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(truncate(text, ctx, maxTextWidth), radius - 16, 0);
            ctx.restore();
        }

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner metallic rim
        ctx.beginPath();
        ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tick marks on outer edge
        for (let i = 0; i < segCount; i++) {
            const angle = i * segAngle;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(radius - 8, 0);
            ctx.lineTo(radius, 0);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();

        // Decorative outer shadow ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,107,107,0.08)';
        ctx.lineWidth = 6;
        ctx.stroke();
    }

    function truncate(text, context, maxWidth) {
        if (context.measureText(text).width <= maxWidth) return text;
        let t = text;
        while (t.length > 0 && context.measureText(t + '…').width > maxWidth) {
            t = t.slice(0, -1);
        }
        return t + '…';
    }

    function lighten(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
        const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
        const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
        return `rgb(${r},${g},${b})`;
    }

    function darken(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
        const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100));
        const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent / 100));
        return `rgb(${r},${g},${b})`;
    }

    /**
     * Determine which segment the pointer (at top / 12-o'clock) is pointing at.
     * The wheel is drawn with segment 0 starting at angle 0 (3-o'clock) and
     * going clockwise.  After rotating the wheel by `currentAngle` radians,
     * the local-frame angle under the pointer is  (-π/2 − currentAngle).
     * We normalise that into [0, 2π) and divide by segAngle.
     */
    function getSegmentAtPointer(angle, segAngle) {
        // Pointer is at -π/2 in canvas space.
        // In the wheel's local (rotated) space the pointer sits at:
        const pointerLocal = (-Math.PI / 2) - angle;
        // Normalise into [0, 2π)
        const TWO_PI = Math.PI * 2;
        const norm = ((pointerLocal % TWO_PI) + TWO_PI) % TWO_PI;
        return Math.floor(norm / segAngle) % options.length;
    }

    function spin(callback) {
        if (isSpinning) return;
        isSpinning = true;
        onSpinEnd = callback;
        lastSegmentIndex = -1;

        // Random initial velocity
        angularVelocity = MIN_SPIN_SPEED + Math.random() * (MAX_SPIN_SPEED - MIN_SPIN_SPEED);

        // Random direction bias (always clockwise for consistency)
        const wrapper = canvas.closest('.wheel-wrapper');
        if (wrapper) wrapper.classList.add('spinning');

        const glow = document.querySelector('.wheel-glow');
        if (glow) glow.classList.add('active');

        animate();
    }

    function animate() {
        currentAngle += angularVelocity;

        // Single smooth friction — fast spin → natural deceleration → clean stop
        angularVelocity *= FRICTION;

        // Tick sound when crossing segments
        const segAngle = (Math.PI * 2) / options.length;
        const currentSegIdx = getSegmentAtPointer(currentAngle, segAngle);

        if (currentSegIdx !== lastSegmentIndex) {
            lastSegmentIndex = currentSegIdx;
            // Tick the pointer
            const pointer = document.querySelector('.wheel-pointer');
            if (pointer && angularVelocity > 0.005) {
                pointer.classList.remove('tick');
                void pointer.offsetWidth; // reflow
                pointer.classList.add('tick');
            }
            if (angularVelocity > 0.003) {
                playTick();
            }
        }

        draw();

        if (angularVelocity < MIN_VELOCITY) {
            // Stop
            angularVelocity = 0;
            isSpinning = false;

            const wrapper = canvas.closest('.wheel-wrapper');
            if (wrapper) wrapper.classList.remove('spinning');

            const glow = document.querySelector('.wheel-glow');
            if (glow) glow.classList.remove('active');

            // Determine winner using same helper as tick detection
            const winnerIdx = getSegmentAtPointer(currentAngle, segAngle);
            const winner = options[winnerIdx] || `Option ${winnerIdx + 1}`;

            playWinSound();

            if (onSpinEnd) {
                setTimeout(() => onSpinEnd(winner, winnerIdx), 400);
            }
            return;
        }

        animFrameId = requestAnimationFrame(animate);
    }

    function getIsSpinning() {
        return isSpinning;
    }

    function getSegmentColors() {
        return SEGMENT_COLORS;
    }

    return {
        init,
        resize,
        setOptions,
        draw,
        spin,
        isSpinning: getIsSpinning,
        SEGMENT_COLORS: getSegmentColors,
    };
})();
