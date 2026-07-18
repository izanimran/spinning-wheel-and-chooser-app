/**
 * Finger Chooser — Multi-touch detection with random selection
 */
const FingerChooser = (function () {
    let canvas, ctx;
    let w, h;
    let touches = {};          // active touches: id -> { x, y, color, radius, pulsePhase, alive }
    let isChoosing = false;
    let chosenId = null;
    let selectionTimer = null;
    let animFrameId = null;
    let isActive = false;

    const SELECTION_DELAY = 2000;    // ms before choosing
    const PULSE_SPEED = 0.04;
    const FINGER_RADIUS = 44;
    const GLOW_RADIUS = 90;

    // Vibrant summer finger colors
    const FINGER_COLORS = [
        { r: 255, g: 107, b: 107 },   // coral
        { r: 46, g: 196, b: 182 },    // teal
        { r: 244, g: 162, b: 97 },    // gold
        { r: 107, g: 99, b: 255 },    // indigo
        { r: 255, g: 140, b: 66 },    // sunset
        { r: 72, g: 191, b: 227 },    // sky
        { r: 184, g: 169, b: 201 },   // lavender
        { r: 249, g: 199, b: 79 },    // warm yellow
        { r: 144, g: 190, b: 109 },   // sage
        { r: 255, g: 107, b: 138 },   // pink
    ];

    let usedColorIndices = [];

    /**
     * Cryptographically-strong random integer in [0, max).
     * Falls back to Math.random on very old browsers.
     */
    function secureRandomInt(max) {
        if (max <= 0) return 0;
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            return arr[0] % max;
        }
        return Math.floor(Math.random() * max);
    }

    /**
     * Fisher-Yates shuffle (in-place) using secure random.
     */
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = secureRandomInt(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function getNextColor() {
        const available = [];
        for (let i = 0; i < FINGER_COLORS.length; i++) {
            if (!usedColorIndices.includes(i)) available.push(i);
        }
        const idx = available.length > 0
            ? available[secureRandomInt(available.length)]
            : secureRandomInt(FINGER_COLORS.length);
        usedColorIndices.push(idx);
        return FINGER_COLORS[idx];
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');

        // Touch events
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        resize();
    }

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function activate() {
        isActive = true;
        resize();
        resetState();
        startRenderLoop();
    }

    function deactivate() {
        isActive = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = null;
        resetState();
    }

    function resetState() {
        touches = {};
        isChoosing = false;
        chosenId = null;
        usedColorIndices = [];
        if (selectionTimer) {
            clearTimeout(selectionTimer);
            selectionTimer = null;
        }

        const instructions = document.getElementById('chooserInstructions');
        if (instructions) instructions.classList.remove('hidden');

        const overlay = document.getElementById('chooserResultOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function onTouchStart(e) {
        e.preventDefault();
        // Block new touches only during the selection animation
        if (isChoosing) return;

        // If a winner was already chosen but user touches again (without pressing reset),
        // auto-reset for convenience so they can use it again immediately.
        if (chosenId !== null) {
            resetState();
        }

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            touches[t.identifier] = {
                x: t.clientX,
                y: t.clientY,
                color: getNextColor(),
                radius: 0,
                pulsePhase: Math.random() * Math.PI * 2,
                alive: true,
                enterTime: Date.now(),
                opacity: 0,
            };
        }

        updateInstructions();
        restartSelectionTimer();
    }

    function onTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (touches[t.identifier]) {
                touches[t.identifier].x = t.clientX;
                touches[t.identifier].y = t.clientY;
            }
        }
    }

    function onTouchEnd(e) {
        e.preventDefault();
        if (isChoosing) return; // don't remove during selection

        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            delete touches[t.identifier];
        }

        updateInstructions();

        // If less than 2 fingers, cancel selection
        if (Object.keys(touches).length < 2) {
            if (selectionTimer) {
                clearTimeout(selectionTimer);
                selectionTimer = null;
            }
        } else {
            restartSelectionTimer();
        }
    }

    function updateInstructions() {
        const instructions = document.getElementById('chooserInstructions');
        if (!instructions) return;

        const count = Object.keys(touches).length;
        if (count >= 2) {
            instructions.classList.add('hidden');
        } else {
            instructions.classList.remove('hidden');
        }
    }

    function restartSelectionTimer() {
        if (selectionTimer) clearTimeout(selectionTimer);

        const touchCount = Object.keys(touches).length;
        if (touchCount < 2) return;

        selectionTimer = setTimeout(() => {
            startSelection();
        }, SELECTION_DELAY);
    }

    function startSelection() {
        const ids = Object.keys(touches);
        if (ids.length < 2) return;

        isChoosing = true;

        // Pre-determine the winner FIRST using crypto-random,
        // then run a suspense animation that ends on the winner.
        const winnerIdx = secureRandomInt(ids.length);
        const winnerId = ids[winnerIdx];

        // Suspense phase: rapid blinking with randomized order.
        // Shuffle the order so it doesn't just cycle 0,1,2... predictably.
        const shuffledIds = shuffleArray([...ids]);
        let blinkCount = 0;
        const totalBlinks = 10 + secureRandomInt(6); // 10-15 blinks for unpredictability
        let blinkIdx = 0;

        const blinkInterval = setInterval(() => {
            blinkCount++;
            blinkIdx = (blinkIdx + 1) % shuffledIds.length;

            // Mark all not-highlighted, one highlighted
            const highlightId = shuffledIds[blinkIdx];
            Object.keys(touches).forEach(id => {
                if (touches[id]) {
                    touches[id]._highlighted = (id === highlightId);
                }
            });

            if (blinkCount >= totalBlinks) {
                clearInterval(blinkInterval);

                // Final highlight on the actual winner
                Object.keys(touches).forEach(id => {
                    if (touches[id]) {
                        touches[id]._highlighted = (id === winnerId);
                    }
                });

                // Short pause showing winner highlighted, then commit
                setTimeout(() => {
                    chooseWinner(winnerId, ids);
                }, 250);
            }
        }, 120);
    }

    function chooseWinner(winnerId, allIds) {
        chosenId = winnerId;

        // Fade out losers
        allIds.forEach(id => {
            if (touches[id]) {
                touches[id]._highlighted = false;
                if (id !== winnerId) {
                    touches[id].alive = false;
                }
            }
        });

        // Vibrate if available
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 200]);
        }

        // Show result after animation
        setTimeout(() => {
            const overlay = document.getElementById('chooserResultOverlay');
            if (overlay) overlay.classList.add('active');
        }, 800);
    }

    function startRenderLoop() {
        if (animFrameId) cancelAnimationFrame(animFrameId);

        function render() {
            if (!isActive) return;
            drawFrame();
            animFrameId = requestAnimationFrame(render);
        }
        animFrameId = requestAnimationFrame(render);
    }

    function drawFrame() {
        ctx.clearRect(0, 0, w, h);

        // Background gradient
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        bgGrad.addColorStop(0, 'rgba(20, 18, 35, 0.98)');
        bgGrad.addColorStop(1, 'rgba(12, 10, 22, 1)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const now = Date.now();
        const ids = Object.keys(touches);

        ids.forEach(id => {
            const t = touches[id];
            if (!t) return;

            // Animate radius in
            const age = (now - t.enterTime) / 1000;
            const targetRadius = FINGER_RADIUS;

            if (t.alive || id === chosenId) {
                t.radius += (targetRadius - t.radius) * 0.12;
                t.opacity = Math.min(1, t.opacity + 0.08);
            } else {
                // Fade out
                t.radius *= 0.92;
                t.opacity *= 0.92;
                if (t.opacity < 0.01) {
                    delete touches[id];
                    return;
                }
            }

            const pulse = Math.sin(now * PULSE_SPEED * 0.06 + t.pulsePhase);
            const isWinner = id === chosenId;
            const isHighlighted = t._highlighted;

            // Outer glow
            const glowSize = isWinner
                ? GLOW_RADIUS * 1.8 + pulse * 15
                : isHighlighted
                    ? GLOW_RADIUS * 1.3
                    : GLOW_RADIUS + pulse * 8;

            const glowGrad = ctx.createRadialGradient(t.x, t.y, t.radius * 0.5, t.x, t.y, glowSize);
            const c = t.color;
            const glowAlpha = isWinner ? 0.35 * t.opacity : 0.18 * t.opacity;
            glowGrad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${glowAlpha})`);
            glowGrad.addColorStop(0.6, `rgba(${c.r},${c.g},${c.b},${glowAlpha * 0.3})`);
            glowGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
            ctx.beginPath();
            ctx.arc(t.x, t.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();

            // Main circle
            const circleRadius = t.radius + (isWinner ? pulse * 4 : pulse * 2);
            const circGrad = ctx.createRadialGradient(
                t.x - circleRadius * 0.2, t.y - circleRadius * 0.2, 0,
                t.x, t.y, circleRadius
            );
            const mainAlpha = t.opacity * (isWinner ? 0.9 : 0.7);
            circGrad.addColorStop(0, `rgba(${Math.min(255, c.r + 40)},${Math.min(255, c.g + 40)},${Math.min(255, c.b + 40)},${mainAlpha})`);
            circGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},${mainAlpha * 0.8})`);

            ctx.beginPath();
            ctx.arc(t.x, t.y, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = circGrad;
            ctx.fill();

            // Border ring
            ctx.beginPath();
            ctx.arc(t.x, t.y, circleRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${0.2 * t.opacity})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Winner crown effect — expanding rings
            if (isWinner && chosenId !== null) {
                const winPulseCount = 3;
                for (let r = 0; r < winPulseCount; r++) {
                    const ringPhase = ((now * 0.002 + r * 0.7) % 1);
                    const ringRadius = circleRadius + ringPhase * 60;
                    const ringAlpha = (1 - ringPhase) * 0.3 * t.opacity;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${ringAlpha})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Star/sparkle effect
                const sparkCount = 6;
                for (let s = 0; s < sparkCount; s++) {
                    const angle = (Math.PI * 2 / sparkCount) * s + now * 0.001;
                    const dist = circleRadius + 20 + Math.sin(now * 0.005 + s) * 10;
                    const sx = t.x + Math.cos(angle) * dist;
                    const sy = t.y + Math.sin(angle) * dist;
                    const sparkSize = 2 + Math.sin(now * 0.008 + s * 2) * 1.5;

                    ctx.beginPath();
                    ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(now * 0.006 + s) * 0.3})`;
                    ctx.fill();
                }
            }

            // Inner highlight
            ctx.beginPath();
            ctx.arc(t.x - circleRadius * 0.15, t.y - circleRadius * 0.15, circleRadius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.08 * t.opacity})`;
            ctx.fill();
        });
    }

    function reset() {
        resetState();
        if (isActive) {
            ctx.clearRect(0, 0, w, h);
            // Restart render loop so screen redraws properly
            startRenderLoop();
        }
    }

    return {
        init,
        resize,
        activate,
        deactivate,
        reset,
    };
})();
