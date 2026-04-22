/* ========================================
   MODULE STORAGE - LocalStorage Manager
   ======================================== */

const ModuleStorage = {
    
    PREFIX: 'btech_module_',
    
    // ============ THEME ============
    
    getTheme() {
        return localStorage.getItem('module-theme') || 'light';
    },
    
    setTheme(theme) {
        localStorage.setItem('module-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    },
    
    toggleTheme() {
        const current = this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        return next;
    },
    
    // ============ PROGRESS ============
    
    getKey(subjectCode, moduleNumber) {
        return `${this.PREFIX}${subjectCode}_module${moduleNumber}`;
    },
    
    loadProgress(subjectCode, moduleNumber) {
        try {
            const key = this.getKey(subjectCode, moduleNumber);
            const data = localStorage.getItem(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.warn('Failed to load progress:', error);
            return null;
        }
    },
    
    saveProgress(subjectCode, moduleNumber, data) {
        try {
            const key = this.getKey(subjectCode, moduleNumber);
            const saveData = {
                ...data,
                lastSaved: new Date().toISOString(),
                version: 1
            };
            localStorage.setItem(key, JSON.stringify(saveData));
        } catch (error) {
            console.warn('Failed to save progress:', error);
            if (error.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded! Consider clearing old data.');
            }
        }
    },
    
    resetProgress(subjectCode, moduleNumber) {
        try {
            const key = this.getKey(subjectCode, moduleNumber);
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to reset progress:', error);
        }
    },
    
    // ============ ALL MODULES PROGRESS ============
    
    getAllModuleProgress(subjectCode, modules) {
        const progress = {};
        modules.forEach(m => {
            progress[m] = this.loadProgress(subjectCode, m);
        });
        return progress;
    },
    
    resetAllProgress(subjectCode, modules) {
        modules.forEach(m => {
            this.resetProgress(subjectCode, m);
        });
    },
    
    // ============ STORAGE INFO ============
    
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (key.startsWith(this.PREFIX)) {
                total += localStorage.getItem(key).length;
            }
        }
        return {
            bytes: total,
            kb: (total / 1024).toFixed(2),
            mb: (total / (1024 * 1024)).toFixed(4)
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleStorage;
}