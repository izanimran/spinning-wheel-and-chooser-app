/**
 * PickSpin — Main App Controller
 */
(function () {
    'use strict';

    // --- DOM Elements ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const homeView = document.getElementById('homeView');
    const wheelView = document.getElementById('wheelView');
    const chooserView = document.getElementById('chooserView');
    const wheelCanvas = document.getElementById('wheelCanvas');
    const chooserCanvas = document.getElementById('chooserCanvas');
    const spinBtn = document.getElementById('spinBtn');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const resetBtn = document.getElementById('resetBtn');
    const optionsList = document.getElementById('optionsList');
    const optionCount = document.getElementById('optionCount');
    const optionLimitMsg = document.getElementById('optionLimit');
    const resultModal = document.getElementById('wheelResultModal');
    const resultText = document.getElementById('wheelResultText');
    const closeResultBtn = document.getElementById('closeResultBtn');
    const confettiContainer = document.getElementById('confettiContainer');
    const chooserResetBtn = document.getElementById('chooserResetBtn');

    // --- State ---
    let options = ['Option 1', 'Option 2'];
    const MAX_OPTIONS = 20;
    const MIN_OPTIONS = 2;

    // --- Initialize ---
    function init() {
        WheelEngine.init(wheelCanvas);
        FingerChooser.init(chooserCanvas);

        setupNavigation();
        setupWheelControls();
        renderOptions();
        syncWheel();

        // Wire home card buttons
        document.getElementById('homeCardWheel').addEventListener('click', () => switchView('wheel'));
        document.getElementById('homeCardChooser').addEventListener('click', () => switchView('chooser'));

        // Set initial nav active state to home
        navTabs.forEach(t => t.classList.remove('active'));
        const homeTab = document.querySelector('[data-tab="home"]');
        if (homeTab) homeTab.classList.add('active');

        // Handle resize — covers both orientation change and desktop resize
        window.addEventListener('resize', handleResize);
        // visualViewport handles iOS keyboard open/close (window.resize doesn't fire)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        }

        // Prevent context menu on long press (mobile hold)
        document.addEventListener('contextmenu', e => e.preventDefault());
    }

    function handleResize() {
        WheelEngine.resize();
        if (chooserView.classList.contains('active')) {
            FingerChooser.resize();
        }
    }

    // --- Navigation ---
    function setupNavigation() {
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                switchView(target);
            });
        });
    }

    function switchView(viewName) {
        navTabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${viewName}"]`).classList.add('active');

        homeView.classList.remove('active');
        wheelView.classList.remove('active');
        chooserView.classList.remove('active');

        if (viewName === 'home') {
            homeView.classList.add('active');
            FingerChooser.deactivate();
        } else if (viewName === 'wheel') {
            wheelView.classList.add('active');
            FingerChooser.deactivate();
            WheelEngine.resize();
        } else {
            chooserView.classList.add('active');
            FingerChooser.activate();
        }
    }

    // --- Wheel Controls ---
    function setupWheelControls() {
        spinBtn.addEventListener('click', () => {
            if (WheelEngine.isSpinning()) return;
            spinBtn.disabled = true;
            spinBtn.querySelector('.spin-button-text').textContent = 'Spinning...';

            WheelEngine.spin((winner, idx) => {
                spinBtn.disabled = false;
                spinBtn.querySelector('.spin-button-text').textContent = 'Spin the Wheel';
                showResult(winner);
            });
        });

        addOptionBtn.addEventListener('click', () => {
            if (options.length >= MAX_OPTIONS) return;
            options.push('');
            renderOptions();
            syncWheel();

            // Focus the new input
            const inputs = optionsList.querySelectorAll('.option-input');
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }

            // Scroll to bottom
            optionsList.scrollTop = optionsList.scrollHeight;
        });

        shuffleBtn.addEventListener('click', () => {
            // Fisher-Yates shuffle
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }
            renderOptions();
            syncWheel();
        });

        resetBtn.addEventListener('click', () => {
            options = ['Option 1', 'Option 2'];
            renderOptions();
            syncWheel();
        });

        closeResultBtn.addEventListener('click', () => {
            resultModal.classList.remove('active');
        });

        // Close modal on backdrop click
        resultModal.querySelector('.result-modal-backdrop').addEventListener('click', () => {
            resultModal.classList.remove('active');
        });

        // Chooser reset
        chooserResetBtn.addEventListener('click', () => {
            FingerChooser.reset();
        });
    }

    // --- Render Options List ---
    function renderOptions() {
        optionsList.innerHTML = '';
        const colors = WheelEngine.SEGMENT_COLORS();

        options.forEach((opt, i) => {
            const item = document.createElement('div');
            item.className = 'option-item';
            item.innerHTML = `
                <div class="option-color-dot" style="color:${colors[i % colors.length]};background:${colors[i % colors.length]}"></div>
                <input type="text" class="option-input" value="${escapeHtml(opt)}" placeholder="Enter option..." maxlength="40" data-index="${i}">
                ${options.length > MIN_OPTIONS ? `
                <button class="option-delete-btn" data-index="${i}" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                ` : ''}
            `;
            optionsList.appendChild(item);
        });

        // Event listeners for inputs
        optionsList.querySelectorAll('.option-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                options[idx] = e.target.value;
                syncWheel();
            });

            input.addEventListener('focus', (e) => {
                e.target.closest('.option-item').classList.add('highlighted');
            });

            input.addEventListener('blur', (e) => {
                e.target.closest('.option-item').classList.remove('highlighted');
            });
        });

        // Delete buttons
        optionsList.querySelectorAll('.option-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                if (options.length <= MIN_OPTIONS) return;
                options.splice(idx, 1);
                renderOptions();
                syncWheel();
            });
        });

        // Update count
        optionCount.textContent = options.length;

        // Show/hide limit message and add button
        if (options.length >= MAX_OPTIONS) {
            addOptionBtn.style.display = 'none';
            optionLimitMsg.style.display = 'block';
        } else {
            addOptionBtn.style.display = 'flex';
            optionLimitMsg.style.display = 'none';
        }
    }

    function syncWheel() {
        const displayOptions = options.map((o, i) => o.trim() || `Option ${i + 1}`);
        WheelEngine.setOptions(displayOptions);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Result Modal ---
    function showResult(winner) {
        resultText.textContent = winner;
        resultModal.classList.add('active');
        spawnConfetti();
    }

    function spawnConfetti() {
        confettiContainer.innerHTML = '';
        const colors = ['#FF6B6B', '#2EC4B6', '#F4A261', '#FFE66D', '#6C63FF', '#FF8C42', '#48BFE3', '#F15BB5'];

        for (let i = 0; i < 40; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.top = '-10px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (Math.random() * 8 + 4) + 'px';
            piece.style.height = (Math.random() * 8 + 4) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            piece.style.animationDelay = (Math.random() * 0.8) + 's';
            piece.style.animationDuration = (1 + Math.random() * 1.5) + 's';
            confettiContainer.appendChild(piece);
        }
    }

    // --- Boot ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
