/**
 * Background ambient particles — warm floating orbs
 */
(function () {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let particles = [];
    let w, h;

    const COLORS = [
        'rgba(255, 107, 107, 0.08)',
        'rgba(244, 162, 97, 0.06)',
        'rgba(46, 196, 182, 0.05)',
        'rgba(255, 216, 150, 0.06)',
        'rgba(184, 169, 201, 0.05)',
    ];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function createParticles() {
        particles = [];
        const count = Math.min(Math.floor((w * h) / 25000), 40);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: Math.random() * 60 + 20,
                dx: (Math.random() - 0.5) * 0.15,
                dy: (Math.random() - 0.5) * 0.1,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.003 + 0.001,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        // Subtle gradient background overlay
        const grad = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.8);
        grad.addColorStop(0, 'rgba(255, 107, 107, 0.03)');
        grad.addColorStop(0.5, 'rgba(244, 162, 97, 0.015)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const now = Date.now();
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            const breathe = Math.sin(now * p.speed + p.phase) * 0.3 + 0.7;

            if (p.x < -p.r) p.x = w + p.r;
            if (p.x > w + p.r) p.x = -p.r;
            if (p.y < -p.r) p.y = h + p.r;
            if (p.y > h + p.r) p.y = -p.r;

            ctx.beginPath();
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * breathe);
            g.addColorStop(0, p.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.arc(p.x, p.y, p.r * breathe, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        createParticles();
    });

    resize();
    createParticles();
    draw();
})();
