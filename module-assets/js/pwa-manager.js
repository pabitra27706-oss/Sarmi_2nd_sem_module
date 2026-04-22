/* ========================================
   PWA MANAGER
   Handles service worker, install prompt,
   online/offline, updates
   No icon files needed — uses inline SVG
   ======================================== */

const PWAManager = {

    deferredPrompt: null,
    swRegistration: null,
    updateReady: false,

    // ============ INIT ============

    async init() {
        if (!('serviceWorker' in navigator)) {
            console.log('[PWA] Service workers not supported');
            return;
        }

        // Detect base path
        this.basePath = this.getBasePath();

        await this.registerSW();
        this.setupInstallPrompt();
        this.setupConnectivity();
        this.startUpdateCheck();
        this.addPWAStyles();

        console.log('[PWA] Manager initialized');
    },

    // Get correct SW path based on page location
    getBasePath() {
        const path = window.location.pathname;

        // If in subjects subfolder
        if (path.includes('/subjects/')) {
            return '../../';
        }
        // If in root
        return './';
    },

    // ============ SERVICE WORKER ============

    async registerSW() {
        try {
            // SW must be at root scope
            const swPath = this.basePath + 'sw.js';

            this.swRegistration = await navigator.serviceWorker.register(
                swPath, { scope: this.basePath }
            );

            console.log('[PWA] SW registered:', this.swRegistration.scope);

            // Listen for updates
            this.swRegistration.addEventListener('updatefound', () => {
                this.handleUpdate();
            });

            // New controller = reload
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (this.updateReady) {
                    console.log('[PWA] New SW active — reloading');
                    window.location.reload();
                }
            });

        } catch (error) {
            console.warn('[PWA] SW registration failed:', error);
        }
    },

    // ============ UPDATES ============

    handleUpdate() {
        const newWorker = this.swRegistration.installing;
        if (!newWorker) return;

        console.log('[PWA] Update found!');

        newWorker.addEventListener('statechange', () => {
            if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
            ) {
                this.updateReady = true;
                this.showUpdateBanner();
            }
        });
    },

    showUpdateBanner() {
        this.removeBanner('pwa-update-banner');

        const banner = document.createElement('div');
        banner.id = 'pwa-update-banner';
        banner.className = 'pwa-banner pwa-update';

        banner.innerHTML = `
            <span class="pwa-banner-text">
                🔄 New version available!
            </span>
            <div class="pwa-banner-actions">
                <button class="pwa-btn pwa-btn-update"
                    onclick="PWAManager.applyUpdate()">
                    Update
                </button>
                <button class="pwa-btn-close"
                    onclick="this.closest('.pwa-banner').remove()">
                    ✕
                </button>
            </div>
        `;

        document.body.appendChild(banner);
        setTimeout(() => banner.classList.add('pwa-visible'), 50);

        // Auto dismiss after 15 seconds
        setTimeout(() => this.removeBanner('pwa-update-banner'), 15000);
    },

    applyUpdate() {
        this.removeBanner('pwa-update-banner');

        if (this.swRegistration?.waiting) {
            this.swRegistration.waiting.postMessage({
                type: 'SKIP_WAITING'
            });
        }
    },

    startUpdateCheck() {
        // Check every 60 seconds
        setInterval(() => {
            this.swRegistration?.update();
        }, 60 * 1000);
    },

    // ============ INSTALL PROMPT ============

    setupInstallPrompt() {
        // Capture browser install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('[PWA] Install prompt ready');

            // Show install button after short delay
            setTimeout(() => this.showInstallButton(), 2000);
        });

        // App installed
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed!');
            this.deferredPrompt = null;
            this.removeBanner('pwa-install-btn');
            this.showToast('✅ App Installed Successfully!', '#10b981');
        });
    },

    showInstallButton() {
        // Don't show if already installed
        if (this.isInstalled()) return;

        this.removeBanner('pwa-install-btn');

        const btn = document.createElement('button');
        btn.id = 'pwa-install-btn';
        btn.className = 'pwa-install-button';
        btn.onclick = () => this.promptInstall();

        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Install App</span>
        `;

        document.body.appendChild(btn);
        setTimeout(() => btn.classList.add('pwa-visible'), 100);
    },

    async promptInstall() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        console.log(`[PWA] Install: ${outcome}`);

        if (outcome === 'accepted') {
            this.deferredPrompt = null;
            this.removeBanner('pwa-install-btn');
        }
    },

    // ============ ONLINE / OFFLINE ============

    setupConnectivity() {
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());

        // Check initial state
        if (!navigator.onLine) {
            this.onOffline();
        }
    },

    onOnline() {
        console.log('[PWA] Back online');
        this.removeBanner('pwa-offline-bar');
        this.showToast('🟢 Back Online!', '#10b981');
    },

    onOffline() {
        console.log('[PWA] Gone offline');
        this.removeBanner('pwa-offline-bar');

        const bar = document.createElement('div');
        bar.id = 'pwa-offline-bar';
        bar.className = 'pwa-offline-bar';
        bar.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24"
                fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>You're offline — showing cached content</span>
        `;

        document.body.appendChild(bar);
        setTimeout(() => bar.classList.add('pwa-visible'), 50);
    },

    // ============ HELPERS ============

    showToast(message, bgColor) {
        const existing = document.getElementById('pwa-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'pwa-toast';
        toast.className = 'pwa-toast';
        toast.style.background = bgColor || '#1f2937';
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('pwa-visible'), 50);
        setTimeout(() => {
            toast.classList.remove('pwa-visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    removeBanner(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('pwa-visible');
            setTimeout(() => el.remove(), 300);
        }
    },

    isInstalled() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        );
    },

    // ============ CACHE HELPERS ============

    async cacheSubject(subjectPath) {
        if (!navigator.serviceWorker.controller) return;

        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data);

            navigator.serviceWorker.controller.postMessage(
                {
                    type: 'CACHE_MODULE',
                    payload: { paths: [subjectPath] }
                },
                [channel.port2]
            );
        });
    },

    async getCacheInfo() {
        if (!navigator.serviceWorker.controller) return null;

        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data);

            navigator.serviceWorker.controller.postMessage(
                { type: 'GET_CACHE_INFO' },
                [channel.port2]
            );
        });
    },

    async clearAllCache() {
        if (!navigator.serviceWorker.controller) return;

        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data);

            navigator.serviceWorker.controller.postMessage(
                { type: 'CLEAR_CACHE' },
                [channel.port2]
            );
        });
    },

    // ============ PWA STYLES ============

    addPWAStyles() {
        if (document.getElementById('pwa-styles')) return;

        const style = document.createElement('style');
        style.id = 'pwa-styles';
        style.textContent = `
            /* ── PWA Banners ── */
            .pwa-banner {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: #1f2937;
                color: white;
                padding: 0.65rem 1rem;
                border-radius: 0.75rem;
                display: flex;
                align-items: center;
                gap: 0.6rem;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.25);
                font-family: -apple-system, BlinkMacSystemFont,
                    'Segoe UI', sans-serif;
                font-size: 0.85rem;
                max-width: 90vw;
                opacity: 0;
                transition: all 0.3s ease;
                pointer-events: none;
            }
            .pwa-banner.pwa-visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
                pointer-events: auto;
            }

            .pwa-banner-text {
                flex: 1;
                white-space: nowrap;
            }
            .pwa-banner-actions {
                display: flex;
                align-items: center;
                gap: 0.4rem;
            }

            .pwa-btn-update {
                background: #10b981;
                color: white;
                border: none;
                padding: 0.35rem 0.75rem;
                border-radius: 0.4rem;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.8rem;
                font-family: inherit;
            }
            .pwa-btn-update:hover {
                background: #059669;
            }

            .pwa-btn-close {
                background: transparent;
                color: #9ca3af;
                border: none;
                cursor: pointer;
                font-size: 1rem;
                padding: 0 0.2rem;
                line-height: 1;
                font-family: inherit;
            }
            .pwa-btn-close:hover {
                color: white;
            }

            /* ── Install Button ── */
            .pwa-install-button {
                position: fixed;
                bottom: 80px;
                right: 1rem;
                background: #10b981;
                color: white;
                border: none;
                padding: 0.6rem 1rem;
                border-radius: 0.75rem;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.8rem;
                z-index: 9998;
                box-shadow: 0 4px 15px rgba(16,185,129,0.35);
                display: flex;
                align-items: center;
                gap: 0.35rem;
                font-family: -apple-system, BlinkMacSystemFont,
                    'Segoe UI', sans-serif;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
                pointer-events: none;
            }
            .pwa-install-button.pwa-visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .pwa-install-button:hover {
                background: #059669;
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(16,185,129,0.45);
            }

            /* ── Offline Bar ── */
            .pwa-offline-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #f59e0b;
                color: white;
                text-align: center;
                padding: 0.4rem 0.75rem;
                font-size: 0.8rem;
                font-weight: 600;
                z-index: 10001;
                font-family: -apple-system, BlinkMacSystemFont,
                    'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
            }
            .pwa-offline-bar.pwa-visible {
                transform: translateY(0);
            }

            /* ── Toast ── */
            .pwa-toast {
                position: fixed;
                top: 1rem;
                left: 50%;
                transform: translateX(-50%) translateY(-10px);
                color: white;
                padding: 0.6rem 1.2rem;
                border-radius: 0.6rem;
                font-weight: 600;
                font-size: 0.85rem;
                z-index: 10002;
                font-family: -apple-system, BlinkMacSystemFont,
                    'Segoe UI', sans-serif;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                opacity: 0;
                transition: all 0.3s ease;
                pointer-events: none;
            }
            .pwa-toast.pwa-visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* ── Dark theme adjustments ── */
            [data-theme="dark"] .pwa-banner {
                background: #374151;
            }
            [data-theme="dark"] .pwa-offline-bar {
                background: #b45309;
            }
        `;

        document.head.appendChild(style);
    }
};

// ── Auto init ──
document.addEventListener('DOMContentLoaded', () => {
    PWAManager.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
}