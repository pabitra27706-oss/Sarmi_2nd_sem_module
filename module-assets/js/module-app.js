/* ========================================
   MODULE APP - Main Application Controller
   Supports BOTH:
   - Module Learning JSON (topics[])
   - Practice Set JSON (questions[] OR topics[])
   - Old format: nested parts[]
   - New format: flat isMultipart objects
   ======================================== */

class ModuleApp {
    constructor(config) {
        this.config = config;
        this.state = {
            currentModule: config.modules[0],
            currentTopicIndex: 0,
            mode: 'study',

            // Unified: works for both topics[] and questions[]
            topics: [],
            filteredTopics: [],

            // Progress tracking
            userAnswers: {},
            completedTopics: [],
            bookmarks: [],

            // Filters
            filters: { types: [], status: [], difficulty: [] },

            // UI State
            selectedOption: null,
            isLoading: false,
            error: null,
            moduleData: {},

            // JSON type detection
            jsonType: 'module' // 'module' | 'practice'
        };
        this.autoSaveInterval = null;
        this.init();
    }

    // ============ INITIALIZATION ============

    async init() {
        console.log(`🚀 Initializing Module App for ${this.config.subject}`);
        const root = document.getElementById('module-root');
        if (root) {
            root.innerHTML = ModuleRender.renderPage(this.config);
        }
        const theme = ModuleStorage.getTheme();
        ModuleStorage.setTheme(theme);
        this.updateThemeUI(theme);
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupAutoSave();
        await this.loadModule(this.state.currentModule);
        this.hideLoadingScreen();
        this.setupTouchGestures();
        console.log('✅ App initialized');
    }

    hideLoadingScreen() {
        setTimeout(() => {
            const ls = document.getElementById('loadingScreen');
            if (ls) ls.classList.add('hidden');
        }, 300);
    }

    // ============ DATA LOADING ============

    async loadModule(moduleNumber) {
        console.log(`📚 Loading Module ${moduleNumber}...`);
        this.state.isLoading = true;
        this.state.error = null;

        const container = document.getElementById('topicContainer');
        if (container) container.innerHTML = ModuleRender.renderLoading();

        try {
            // Try practice set first, then module JSON
            let data = null;
            let jsonType = 'module';

            // File paths
            const practicePath =
                `${this.config.dataPath}module${moduleNumber}_practice.json`;
            const modulePath =
                `${this.config.dataPath}module${moduleNumber}.json`;

            try {
                // ── Try practice file first ──
                data = await ModuleHelpers.fetchJSON(practicePath);

                // ✅ CHANGE 1: Detect jsonType from file content
                if (
                    data.setType  === 'practice' ||
                    data.jsonType === 'practice'
                ) {
                    jsonType = 'practice';
                } else {
                    jsonType = 'module';
                }

                console.log(
                    `📋 Loaded practice file for Module ${moduleNumber} ` +
                    `[detected: ${jsonType}]`
                );

            } catch (e) {
                // ── Try module JSON ──
                try {
                    data = await ModuleHelpers.fetchJSON(modulePath);

                    // ✅ CHANGE 1: Detect jsonType from file content
                    if (
                        data.setType  === 'practice' ||
                        data.jsonType === 'practice'
                    ) {
                        jsonType = 'practice';
                    } else {
                        jsonType = 'module';
                    }

                    console.log(
                        `📖 Loaded module file for Module ${moduleNumber} ` +
                        `[detected: ${jsonType}]`
                    );

                } catch (e2) {
                    // ── Try global variables ──
                    const globalPractice = `PRACTICE_${moduleNumber}`;
                    const globalModule   = `MODULE_${moduleNumber}`;

                    if (window[globalPractice]) {
                        data     = window[globalPractice];
                        jsonType = 'practice';
                    } else if (window[globalModule]) {
                        data     = window[globalModule];
                        jsonType = 'module';
                    } else {
                        throw new Error(
                            `No data found for Module ${moduleNumber}. ` +
                            `Expected: ${practicePath} or ${modulePath}`
                        );
                    }
                }
            }

            this.state.jsonType = jsonType;

            // ── Normalize data to unified topic format ──
            this.state.topics = this.normalizeData(data, moduleNumber, jsonType);

            // ✅ CHANGE 2: Cache module data - read both field names
            this.state.moduleData[moduleNumber] = {
                title: data.title || data.moduleName || `Module ${moduleNumber}`,
                description: data.description || '',
                topics: this.state.topics,
                totalMarks: data.totalMarks || 0,
                jsonType: jsonType,
                // ✅ Read both setType and jsonType field names
                setType: data.setType || data.jsonType || 'module',
                totalQuestions: data.totalQuestions || this.state.topics.length
            };

            this.state.filteredTopics    = [...this.state.topics];
            this.state.currentModule     = moduleNumber;
            this.state.currentTopicIndex = 0;
            this.state.selectedOption    = null;

            this.loadProgress();
            this.updateModuleTabs(moduleNumber);
            this.updateBookmarkBadge();
            this.render();

            console.log(
                `✅ Loaded ${this.state.topics.length} items ` +
                `for Module ${moduleNumber} [${jsonType}]`
            );

        } catch (error) {
            console.error(`❌ Failed to load Module ${moduleNumber}:`, error);
            this.state.error = error.message;
            if (container) {
                container.innerHTML = ModuleRender.renderError(error.message);
            }
        }

        this.state.isLoading = false;
    }

    // ============ DATA NORMALIZATION ============
    // Converts BOTH json types to unified internal format

    normalizeData(data, moduleNumber, jsonType) {
        if (jsonType === 'practice') {
            return this.normalizePracticeData(data, moduleNumber);
        } else {
            return this.normalizeModuleData(data, moduleNumber);
        }
    }

    // ✅ CHANGE 3: Normalize practice set JSON
    // Supports BOTH formats:
    //   Old: data.questions[] with nested parts[]
    //   New: data.topics[]   with flat isMultipart objects
    normalizePracticeData(data, moduleNumber) {

        // ✅ Support both "questions" and "topics" as array name
        const questions = data.questions || data.topics || [];
        const normalized = [];
        let globalIndex = 0;

        questions.forEach((q) => {

            if (q.parts && q.parts.length > 0) {
                // ── OLD FORMAT: nested parts[] array ──
                q.parts.forEach((part) => {
                    normalized.push({
                        // Identity
                        _index:    globalIndex++,
                        _uniqueId: `module${moduleNumber}_${q.id}_${part.part}`,
                        _module:   moduleNumber,
                        _jsonType: 'practice',

                        // Question info
                        id:             `${q.id}_${part.part}`,
                        questionNumber: q.questionNumber,
                        parentId:       q.id,
                        part:           part.part,
                        isMultipart:    true,
                        totalParts:     q.parts.length,
                        parentTitle:    q.title,

                        // Content
                        title:       `Q${q.questionNumber}(${part.part}): ${q.title}`,
                        question:    part.question,
                        description: part.question,
                        type:        part.type       || q.type       || 'theory',
                        difficulty:  part.difficulty || q.difficulty || 'medium',
                        content:     part.answer,
                        answer:      part.answer,
                        keyPoints:   part.keyPoints  || [],
                        marks:       part.marks      || q.marks      || 5,
                        unit:        part.unit       || q.unit       || '',

                        // MCQ fields
                        options:     part.options     || null,
                        correct:     part.correct     !== undefined
                                         ? part.correct : null,
                        explanation: part.explanation || null
                    });
                });

            } else if (q.isMultipart === true && q.part) {
                // ── NEW FORMAT: flat object with isMultipart + part ──
                normalized.push({
                    // Identity
                    _index:    globalIndex++,
                    _uniqueId: `module${moduleNumber}_${q.id}`,
                    _module:   moduleNumber,
                    _jsonType: 'practice',

                    // Question info
                    id:             q.id,
                    questionNumber: q.questionNumber,
                    parentId:       null,
                    part:           q.part,
                    isMultipart:    true,
                    totalParts:     null,
                    parentTitle:    q.parentTitle || '',

                    // Content
                    title:       `Q${q.questionNumber}(${q.part}): ${q.title}`,
                    question:    q.question,
                    description: q.question,
                    type:        q.type       || 'theory',
                    difficulty:  q.difficulty || 'medium',
                    content:     q.answer,
                    answer:      q.answer,
                    keyPoints:   q.keyPoints  || [],
                    marks:       q.marks      || 5,
                    unit:        q.unit       || '',

                    // MCQ fields
                    options:     q.options     || null,
                    correct:     q.correct     !== undefined ? q.correct : null,
                    explanation: q.explanation || null
                });

            } else {
                // ── SINGLE QUESTION (both formats) ──
                normalized.push({
                    // Identity
                    _index:    globalIndex++,
                    _uniqueId: `module${moduleNumber}_${q.id}`,
                    _module:   moduleNumber,
                    _jsonType: 'practice',

                    // Question info
                    id:             q.id,
                    questionNumber: q.questionNumber,
                    isMultipart:    false,
                    parentTitle:    null,
                    part:           null,

                    // Content
                    title:       `Q${q.questionNumber}: ${q.title}`,
                    question:    q.question,
                    description: q.question,
                    type:        q.type       || 'theory',
                    difficulty:  q.difficulty || 'medium',
                    content:     q.answer,
                    answer:      q.answer,
                    keyPoints:   q.keyPoints  || [],
                    marks:       q.marks      || 5,
                    unit:        q.unit       || '',

                    // MCQ fields
                    options:     q.options     || null,
                    correct:     q.correct     !== undefined ? q.correct : null,
                    explanation: q.explanation || null
                });
            }
        });

        return normalized;
    }

    // Normalize module learning JSON (topics[])
    normalizeModuleData(data, moduleNumber) {
        const topics = data.topics || [];

        return topics.map((t, index) => ({
            // Identity
            _index:    index,
            _uniqueId: `module${moduleNumber}_${t.id}`,
            _module:   moduleNumber,
            _jsonType: 'module',

            // Content fields (already in correct format)
            ...t,
            isMultipart:    false,
            part:           null,
            parentTitle:    null,
            questionNumber: String(index + 1)
        }));
    }

    // ============ PROGRESS ============

    loadProgress() {
        const saved = ModuleStorage.loadProgress(
            this.config.code,
            this.state.currentModule
        );
        if (saved) {
            this.state.userAnswers     = saved.userAnswers     || {};
            this.state.completedTopics = saved.completedTopics || [];
            this.state.bookmarks       = saved.bookmarks       || [];
            this.state.mode            = saved.mode            || 'study';
            const savedIndex = saved.currentTopicIndex || 0;
            this.state.currentTopicIndex = Math.min(
                savedIndex,
                Math.max(0, this.state.filteredTopics.length - 1)
            );
        } else {
            this.state.userAnswers       = {};
            this.state.completedTopics   = [];
            this.state.bookmarks         = [];
            this.state.currentTopicIndex = 0;
            this.state.mode              = 'study';
        }
    }

    saveProgress() {
        ModuleStorage.saveProgress(
            this.config.code,
            this.state.currentModule,
            {
                userAnswers:       this.state.userAnswers,
                completedTopics:   this.state.completedTopics,
                bookmarks:         this.state.bookmarks,
                currentTopicIndex: this.state.currentTopicIndex,
                mode:              this.state.mode
            }
        );
    }

    resetProgress() {
        if (!confirm(
            '⚠️ Reset all progress for this module? This cannot be undone.'
        )) return;

        this.state.userAnswers       = {};
        this.state.completedTopics   = [];
        this.state.bookmarks         = [];
        this.state.currentTopicIndex = 0;
        this.state.selectedOption    = null;

        ModuleStorage.resetProgress(this.config.code, this.state.currentModule);
        this.updateBookmarkBadge();
        this.render();
        ModuleRender.showToast('Progress reset', 'success');
    }

    // ============ TOPIC ACCESS ============

    getCurrentTopic() {
        if (this.state.filteredTopics.length === 0) return null;
        const index = Math.min(
            this.state.currentTopicIndex,
            this.state.filteredTopics.length - 1
        );
        return this.state.filteredTopics[index] || null;
    }

    // ============ NAVIGATION ============

    goToTopic(index) {
        if (index < 0) index = 0;
        if (index >= this.state.filteredTopics.length) {
            index = this.state.filteredTopics.length - 1;
        }
        if (index < 0) return;

        this.state.currentTopicIndex = index;
        this.state.selectedOption    = null;
        this.saveProgress();
        this.render();

        const container = document.getElementById('topicContainer');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    goToTopicById(uniqueId) {
        const index = this.state.filteredTopics
            .findIndex(t => t._uniqueId === uniqueId);
        if (index !== -1) this.goToTopic(index);
    }

    nextTopic() {
        if (this.state.currentTopicIndex < this.state.filteredTopics.length - 1) {
            this.goToTopic(this.state.currentTopicIndex + 1);
        } else {
            ModuleRender.showToast('Last item in this module', 'info');
        }
    }

    prevTopic() {
        if (this.state.currentTopicIndex > 0) {
            this.goToTopic(this.state.currentTopicIndex - 1);
        } else {
            ModuleRender.showToast('First item', 'info');
        }
    }

    // ============ ANSWER HANDLING ============

    selectOption(value) {
        this.state.selectedOption = value;
        const btn = document.getElementById('submitBtn');
        if (btn) btn.disabled = false;
    }

    submitAnswer() {
        const topic = this.getCurrentTopic();
        if (!topic || this.state.mode === 'review') return;

        const answer = this.state.selectedOption;
        if (answer === null || answer === undefined || answer === '') {
            ModuleRender.showToast('Please select an answer', 'error');
            return;
        }

        let isCorrect = false;
        switch (topic.type) {
            case 'mcq':
                isCorrect = ModuleHelpers.checkMCQ(answer, topic.correct);
                break;
            case 'truefalse':
                isCorrect = ModuleHelpers.checkTrueFalse(answer, topic.correct);
                break;
            case 'gapfill':
                isCorrect = ModuleHelpers.checkGapFill(
                    answer, topic.acceptableAnswers || topic.answer
                );
                break;
        }

        this.state.userAnswers[topic._uniqueId] = {
            answer,
            isCorrect,
            topicId:   topic.id,
            timestamp: ModuleHelpers.getTimestamp()
        };

        this.state.selectedOption = null;
        this.saveProgress();
        this.render();

        ModuleRender.showToast(
            isCorrect ? '✅ Correct!' : '❌ Incorrect',
            isCorrect ? 'success' : 'error'
        );
        this.renderMath();
    }

    showAnswer(topic) {
        if (!topic) return;
        this.state.userAnswers[topic._uniqueId] = {
            viewed:    true,
            topicId:   topic.id,
            timestamp: ModuleHelpers.getTimestamp()
        };
        this.saveProgress();
        this.render();
        this.renderMath();
    }

    // ============ COMPLETE / BOOKMARK ============

    toggleComplete() {
        const topic = this.getCurrentTopic();
        if (!topic) return;

        const id  = topic._uniqueId;
        const idx = this.state.completedTopics.indexOf(id);

        if (idx > -1) {
            this.state.completedTopics.splice(idx, 1);
            ModuleRender.showToast('Marked incomplete', 'info');
        } else {
            this.state.completedTopics.push(id);
            ModuleRender.showToast('Marked complete ✅', 'success');
        }

        this.saveProgress();
        this.render();
    }

    toggleBookmark() {
        const topic = this.getCurrentTopic();
        if (!topic) return;

        const id  = topic._uniqueId;
        const idx = this.state.bookmarks.indexOf(id);

        if (idx > -1) {
            this.state.bookmarks.splice(idx, 1);
            ModuleRender.showToast('Bookmark removed', 'info');
        } else {
            this.state.bookmarks.push(id);
            ModuleRender.showToast('Bookmarked 🔖', 'success');
        }

        this.saveProgress();
        this.updateBookmarkBadge();
        this.render();
    }

    removeBookmark(bookmarkId) {
        const idx = this.state.bookmarks.indexOf(bookmarkId);
        if (idx > -1) {
            this.state.bookmarks.splice(idx, 1);
            this.saveProgress();
            this.updateBookmarkBadge();

            const modal = document.getElementById('bookmarksModal');
            if (modal?.classList.contains('active')) this.openBookmarksModal();

            ModuleRender.showToast('Bookmark removed', 'info');
        }
    }

    updateBookmarkBadge() {
        const badge = document.getElementById('bookmarkCount');
        if (badge) badge.textContent = this.state.bookmarks.length;
    }

    // ============ MODULE & MODE SWITCHING ============

    async switchModule(moduleNumber) {
        if (moduleNumber === this.state.currentModule) return;
        this.saveProgress();
        await this.loadModule(moduleNumber);
        ModuleRender.showToast(`Module ${moduleNumber}`, 'success');
    }

    updateModuleTabs(activeModule) {
        document.querySelectorAll('.module-tab').forEach(tab => {
            tab.classList.toggle(
                'active',
                parseInt(tab.dataset.module) === activeModule
            );
        });
    }

    switchMode(mode) {
        if (mode === this.state.mode) return;
        this.state.mode           = mode;
        this.state.selectedOption = null;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.saveProgress();
        this.render();

        const labels = {
            study:    'Study',
            practice: 'Practice',
            review:   'Review'
        };
        ModuleRender.showToast(`${labels[mode] || mode} Mode`, 'info');
    }

    // ============ FILTERS ============

    applyFilters(filters) {
        this.state.filters = filters;

        this.state.filteredTopics = this.state.topics.filter(t => {
            if (
                filters.types.length > 0 &&
                !filters.types.includes(t.type)
            ) return false;

            if (
                filters.difficulty.length > 0 &&
                !filters.difficulty.includes(t.difficulty)
            ) return false;

            if (filters.status.length > 0) {
                const isCompleted  = this.state.completedTopics
                    .includes(t._uniqueId);
                const isBookmarked = this.state.bookmarks
                    .includes(t._uniqueId);
                const answer       = this.state.userAnswers[t._uniqueId];
                const isViewed     = answer?.viewed;

                const match = filters.status.some(s => {
                    if (s === 'completed')  return isCompleted;
                    if (s === 'incomplete') return !isCompleted;
                    if (s === 'bookmarked') return isBookmarked;
                    if (s === 'viewed')     return isViewed;
                    return false;
                });
                if (!match) return false;
            }

            return true;
        });

        this.state.currentTopicIndex = 0;
        this.state.selectedOption    = null;
        this.render();

        ModuleRender.showToast(
            `${this.state.filteredTopics.length} items`, 'info'
        );
    }

    resetFilters() {
        this.state.filters           = { types: [], status: [], difficulty: [] };
        this.state.filteredTopics    = [...this.state.topics];
        this.state.currentTopicIndex = 0;
        this.state.selectedOption    = null;

        document.querySelectorAll(
            '.filter-type, .filter-status, .filter-difficulty'
        ).forEach(cb => { cb.checked = false; });

        this.render();
        ModuleRender.showToast('Filters reset', 'info');
    }

    handleSearch(searchTerm) {
        const resultsEl = document.getElementById('searchResults');
        if (!resultsEl) return;

        if (!searchTerm || searchTerm.trim() === '') {
            resultsEl.innerHTML = '';
            return;
        }

        const term    = searchTerm.toLowerCase().trim();
        const results = [];

        this.state.topics.forEach(t => {
            let score = 0;

            const title = ModuleHelpers.stripHTML(
                t.title || t.question || ''
            ).toLowerCase();
            if (title.includes(term)) score += 10;

            const question = ModuleHelpers.stripHTML(
                t.question || t.description || ''
            ).toLowerCase();
            if (question.includes(term)) score += 8;

            const content = ModuleHelpers.stripHTML(
                t.content || t.answer || ''
            ).toLowerCase();
            if (content.includes(term)) score += 5;

            if (t.unit && t.unit.toLowerCase().includes(term)) score += 6;

            if (t.keyPoints) {
                t.keyPoints.forEach(kp => {
                    if (
                        ModuleHelpers.stripHTML(String(kp))
                            .toLowerCase().includes(term)
                    ) score += 3;
                });
            }

            if (score > 0) results.push({ topic: t, score });
        });

        results.sort((a, b) => b.score - a.score);
        resultsEl.innerHTML = ModuleRender.renderSearchResults(
            results, searchTerm
        );
    }

    // ============ MODALS ============

    openStatsModal() {
        const stats   = this.calculateStats();
        const content = document.getElementById('statsContent');
        if (content) {
            content.innerHTML = ModuleRender.renderStats(stats, this.config);
        }
        const modal = document.getElementById('statsModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    }

    openBookmarksModal() {
        const content = document.getElementById('bookmarksContent');
        if (content) {
            content.innerHTML = ModuleRender.renderBookmarks(
                this.state.topics,
                this.state.bookmarks,
                this.state.userAnswers,
                this.state.completedTopics
            );
        }
        const modal = document.getElementById('bookmarksModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    // ============ STATISTICS ============

    calculateStats() {
        const scoredTypes  = ['mcq', 'truefalse', 'gapfill'];
        const scoredTopics = this.state.topics.filter(
            t => scoredTypes.includes(t.type)
        );

        let totalMarks  = 0;
        let earnedMarks = 0;
        let correct     = 0;
        let wrong       = 0;
        let attempted   = 0;

        scoredTopics.forEach(t => {
            totalMarks += t.marks || 1;
            const ans   = this.state.userAnswers[t._uniqueId];
            if (ans?.isCorrect !== undefined) {
                attempted++;
                if (ans.isCorrect) {
                    correct++;
                    earnedMarks += t.marks || 1;
                } else {
                    wrong++;
                }
            }
        });

        // Type stats
        const typeStats = {};
        const allTypes  = [
            'definition', 'theory', 'numerical', 'derivation',
            'diagram', 'example', 'mcq', 'multipart'
        ];

        allTypes.forEach(type => {
            const tt = this.state.topics.filter(t => t.type === type);
            if (tt.length > 0) {
                const viewed = tt.filter(
                    t => this.state.userAnswers[t._uniqueId]?.viewed ||
                         this.state.completedTopics.includes(t._uniqueId)
                ).length;
                typeStats[type] = { total: tt.length, viewed };
            }
        });

        const completionStats = {
            total: this.state.topics.length,
            completed: this.state.completedTopics.filter(
                id => this.state.topics.some(t => t._uniqueId === id)
            ).length
        };

        const percentage = totalMarks > 0
            ? ((earnedMarks / totalMarks) * 100).toFixed(1) : 0;
        const overallAccuracy = attempted > 0
            ? ((correct / attempted) * 100).toFixed(1) : 0;
        const completionPct = completionStats.total > 0
            ? Math.round(
                (completionStats.completed / completionStats.total) * 100
            ) : 0;

        // Practice set specific stats
        const practiceStats = this.state.jsonType === 'practice' ? {
            totalQuestions: this.state.moduleData[this.state.currentModule]
                ?.totalQuestions || 0,
            viewed: this.state.topics.filter(
                t => this.state.userAnswers[t._uniqueId]?.viewed ||
                     this.state.completedTopics.includes(t._uniqueId)
            ).length
        } : null;

        return {
            score: {
                totalMarks, earnedMarks, correct, wrong,
                attempted, total: scoredTopics.length, percentage
            },
            typeStats,
            completionStats,
            overallAccuracy,
            completionPct,
            practiceStats,
            jsonType: this.state.jsonType
        };
    }

    // ============ UI HELPERS ============

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const menuBtn = document.getElementById('menuBtn');

        if (sidebar?.classList.contains('active')) {
            this.closeSidebar();
        } else {
            sidebar?.classList.add('active');
            overlay?.classList.add('active');
            menuBtn?.classList.add('active');
        }
    }

    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('overlay')?.classList.remove('active');
        document.getElementById('menuBtn')?.classList.remove('active');
    }

    toggleSearch() {
        const panel = document.getElementById('searchPanel');
        const input = document.getElementById('searchInput');
        if (panel?.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            setTimeout(() => input?.focus(), 100);
        } else {
            this.closeSearch();
        }
    }

    closeSearch() {
        document.getElementById('searchPanel')?.classList.add('hidden');
        const input   = document.getElementById('searchInput');
        const results = document.getElementById('searchResults');
        if (input)   input.value = '';
        if (results) results.innerHTML = '';
    }

    toggleFilterPanel() {
        document.getElementById('filterPanel')?.classList.toggle('hidden');
    }

    updateThemeUI(theme) {
        const sunIcon  = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        if (theme === 'dark') {
            sunIcon?.classList.add('hidden');
            moonIcon?.classList.remove('hidden');
        } else {
            sunIcon?.classList.remove('hidden');
            moonIcon?.classList.add('hidden');
        }
    }

    toggleTheme() {
        const newTheme = ModuleStorage.toggleTheme();
        this.updateThemeUI(newTheme);
        ModuleRender.showToast(
            `${newTheme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode`, 'info'
        );
    }

    renderMath() {
        if (window.MathJax?.typesetPromise) {
            setTimeout(() => {
                window.MathJax.typesetPromise().catch(err => {
                    console.warn('MathJax:', err);
                });
            }, 100);
        }
    }

    // ============ PRINT ============

    printTopics() {
        const topics = this.state.filteredTopics;
        if (topics.length === 0) {
            ModuleRender.showToast('No topics to print', 'error');
            return;
        }

        let overlay = document.getElementById('printOverlay');
        if (!overlay) {
            overlay           = document.createElement('div');
            overlay.id        = 'printOverlay';
            overlay.className = 'print-overlay print-text-normal';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = ModuleRender.renderPrintOverlay(
            topics,
            this.config,
            this.state.currentModule,
            this.state.filters,
            this.state.jsonType
        );

        overlay.classList.add('active');
        document.body.classList.add('print-mode');
        overlay.scrollTop = 0;

        if (window.MathJax?.typesetPromise) {
            window.MathJax.typesetPromise([overlay]).catch(
                err => console.warn('MathJax print:', err)
            );
        }

        ModuleRender.showToast(
            `${topics.length} items ready to print`, 'info'
        );
    }

    closePrintView() {
        const overlay = document.getElementById('printOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('print-mode');
            setTimeout(() => overlay.remove(), 100);
        }
    }

    setPrintSize(size) {
        const overlay = document.getElementById('printOverlay');
        if (!overlay) return;
        overlay.classList.remove(
            'print-text-small', 'print-text-normal', 'print-text-large'
        );
        overlay.classList.add(`print-text-${size}`);
        overlay.querySelectorAll('.print-size-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.printSize === size);
        });
    }

    // ============ MAIN RENDER ============

    render() {
        const topic     = this.getCurrentTopic();
        const container = document.getElementById('topicContainer');

        if (!topic || this.state.filteredTopics.length === 0) {
            if (container) container.innerHTML = ModuleRender.renderEmpty();
            this.renderSidebarAndNav();
            return;
        }

        if (container) {
            container.innerHTML = ModuleRender.renderTopic(topic, this.state);
        }

        this.renderSidebarAndNav();
        this.updateProgressDisplay();
        this.updateNavigationButtons();
        this.renderMath();
    }

    renderSidebarAndNav() {
        const listEl = document.getElementById('topicList');
        if (listEl) {
            listEl.innerHTML = ModuleRender.renderTopicList(
                this.state.filteredTopics,
                this.state.currentTopicIndex,
                this.state.userAnswers,
                this.state.bookmarks,
                this.state.completedTopics,
                this.state.jsonType
            );
        }

        const navEl = document.getElementById('topicNavigator');
        if (navEl) {
            navEl.innerHTML = ModuleRender.renderNavigator(
                this.state.filteredTopics,
                this.state.currentTopicIndex,
                this.state.userAnswers,
                this.state.bookmarks,
                this.state.completedTopics
            );
        }
    }

    updateProgressDisplay() {
        const stats = this.calculateStats();

        const completedEl = document.getElementById('completedCount');
        if (completedEl) {
            completedEl.textContent =
                `${stats.completionStats.completed}` +
                `/${stats.completionStats.total}`;
        }

        const scoreEl = document.getElementById('scoreCount');
        if (scoreEl) {
            scoreEl.textContent =
                `${stats.score.earnedMarks}/${stats.score.totalMarks}`;
        }

        const progressBar = document.getElementById('overallProgress');
        if (progressBar) {
            const pct = stats.completionStats.total > 0
                ? (stats.completionStats.completed /
                   stats.completionStats.total) * 100
                : 0;
            progressBar.style.width = `${pct}%`;
        }

        const posEl = document.getElementById('topicPosition');
        if (posEl) {
            const label = this.state.jsonType === 'practice'
                ? 'Question' : 'Topic';
            posEl.textContent =
                `${label} ${this.state.currentTopicIndex + 1}` +
                ` of ${this.state.filteredTopics.length}`;
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.disabled = this.state.currentTopicIndex === 0;
        if (nextBtn) {
            nextBtn.disabled =
                this.state.currentTopicIndex >=
                this.state.filteredTopics.length - 1;
        }
    }

    // ============ EVENT LISTENERS ============

    setupEventListeners() {
        document.addEventListener('click', (e) => this.handleGlobalClick(e));

        document.getElementById('menuBtn')
            ?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('closeSidebar')
            ?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('overlay')
            ?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('themeBtn')
            ?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('searchBtn')
            ?.addEventListener('click', () => this.toggleSearch());
        document.getElementById('closeSearch')
            ?.addEventListener('click', () => this.closeSearch());

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                ModuleHelpers.debounce(
                    (e) => this.handleSearch(e.target.value), 300
                )
            );
        }

        document.querySelectorAll('.module-tab').forEach(tab => {
            tab.addEventListener('click', () =>
                this.switchModule(parseInt(tab.dataset.module))
            );
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () =>
                this.switchMode(btn.dataset.mode)
            );
        });

        document.getElementById('prevBtn')
            ?.addEventListener('click', () => this.prevTopic());
        document.getElementById('nextBtn')
            ?.addEventListener('click', () => this.nextTopic());
        document.getElementById('printBtn')
            ?.addEventListener('click', () => this.printTopics());
        document.getElementById('filterBtn')
            ?.addEventListener('click', () => this.toggleFilterPanel());

        document.getElementById('applyFilters')
            ?.addEventListener('click', () => {
                const types = Array.from(
                    document.querySelectorAll('.filter-type:checked')
                ).map(cb => cb.value);
                const status = Array.from(
                    document.querySelectorAll('.filter-status:checked')
                ).map(cb => cb.value);
                const difficulty = Array.from(
                    document.querySelectorAll('.filter-difficulty:checked')
                ).map(cb => cb.value);
                this.applyFilters({ types, status, difficulty });
                this.toggleFilterPanel();
            });

        document.getElementById('resetFilters')
            ?.addEventListener('click', () => {
                this.resetFilters();
                this.toggleFilterPanel();
            });

        document.getElementById('bookmarksBtn')
            ?.addEventListener('click', () => this.openBookmarksModal());
        document.getElementById('statsBtn')
            ?.addEventListener('click', () => this.openStatsModal());
        document.getElementById('resetBtn')
            ?.addEventListener('click', () => this.resetProgress());

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () =>
                this.closeModal(btn.dataset.modal)
            );
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });

        document.getElementById('goToTop')
            ?.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

        window.addEventListener(
            'scroll',
            ModuleHelpers.throttle(() => {
                const btn = document.getElementById('goToTop');
                if (btn) btn.classList.toggle('hidden', window.scrollY <= 300);
            }, 200)
        );

        document.addEventListener('input', (e) => {
            if (e.target.id === 'gapfillInput') {
                this.state.selectedOption = e.target.value;
                const submitBtn = document.getElementById('submitBtn');
                if (submitBtn) {
                    submitBtn.disabled = !e.target.value.trim();
                }
            }
        });
    }

    handleGlobalClick(e) {
        const target = e.target;

        // Print overlay
        if (target.closest('#printBackBtn')) { this.closePrintView(); return; }
        if (target.closest('#printNowBtn'))  { window.print(); return; }
        const sizeBtn = target.closest('.print-size-btn');
        if (sizeBtn?.dataset.printSize) {
            this.setPrintSize(sizeBtn.dataset.printSize);
            return;
        }

        // MCQ option
        const mcqOption = target.closest('.mcq-option');
        if (mcqOption && !mcqOption.classList.contains('disabled')) {
            const index = parseInt(mcqOption.dataset.optionIndex);
            this.selectOption(index);
            document.querySelectorAll('.mcq-option')
                .forEach(opt => opt.classList.remove('selected'));
            mcqOption.classList.add('selected');
            return;
        }

        // True/False
        const tfOption = target.closest('.tf-option');
        if (tfOption && !tfOption.classList.contains('disabled')) {
            const value = tfOption.dataset.tfValue === 'true';
            this.selectOption(value);
            document.querySelectorAll('.tf-option')
                .forEach(opt => opt.classList.remove('selected'));
            tfOption.classList.add('selected');
            return;
        }

        // Buttons
        if (target.closest('#submitBtn')) {
            this.submitAnswer();
            return;
        }
        if (target.closest('#showAnswerBtn')) {
            this.showAnswer(this.getCurrentTopic());
            return;
        }
        if (target.closest('#bookmarkBtn')) {
            this.toggleBookmark();
            return;
        }
        if (target.closest('#completeBtn')) {
            this.toggleComplete();
            return;
        }

        // Sidebar topic item
        const topicItem = target.closest('.topic-item');
        if (topicItem) {
            const index = parseInt(topicItem.dataset.topicIndex);
            if (!isNaN(index)) {
                this.goToTopic(index);
                this.closeSidebar();
            }
            return;
        }

        // Navigator dot
        const navDot = target.closest('.nav-dot');
        if (navDot) {
            const index = parseInt(navDot.dataset.topicIndex);
            if (!isNaN(index)) this.goToTopic(index);
            return;
        }

        // Search result
        const searchResult = target.closest('.search-result-item');
        if (searchResult) {
            const id = searchResult.dataset.topicId;
            if (id) { this.goToTopicById(id); this.closeSearch(); }
            return;
        }

        // Bookmark item
        const bookmarkItem = target.closest('.bookmark-item');
        if (bookmarkItem) {
            if (target.closest('.remove-bookmark-btn')) {
                const id = target.closest('.remove-bookmark-btn')
                    .dataset.bookmarkId;
                if (id) this.removeBookmark(id);
                return;
            }
            const id = bookmarkItem.dataset.topicId;
            if (id) {
                this.goToTopicById(id);
                this.closeModal('bookmarksModal');
            }
            return;
        }
    }

    // ============ KEYBOARD SHORTCUTS ============

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                if (
                    e.key === 'Enter' &&
                    e.target.id === 'gapfillInput'
                ) {
                    e.preventDefault();
                    this.submitAnswer();
                }
                return;
            }

            if (document.body.classList.contains('print-mode')) {
                if (e.key === 'Escape') this.closePrintView();
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevTopic();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextTopic();
                    break;
                case '1': case '2': case '3': case '4':
                    const opt = document.querySelector(
                        `.mcq-option[data-option-index="${parseInt(e.key) - 1}"]`
                    );
                    if (opt && !opt.classList.contains('disabled')) opt.click();
                    break;
                case 't': case 'T':
                    document.querySelector('[data-tf-value="true"]')?.click();
                    break;
                case 'f': case 'F':
                    document.querySelector('[data-tf-value="false"]')?.click();
                    break;
                case 'b': case 'B':
                    this.toggleBookmark();
                    break;
                case 'c': case 'C':
                    this.toggleComplete();
                    break;
                case 's': case 'S':
                    e.preventDefault();
                    this.toggleSearch();
                    break;
                case 'm': case 'M':
                    this.toggleSidebar();
                    break;
                case 'd': case 'D':
                    this.toggleTheme();
                    break;
                case 'p': case 'P':
                    this.printTopics();
                    break;
                case 'Enter':
                    const submitBtn = document.getElementById('submitBtn');
                    if (submitBtn && !submitBtn.disabled) submitBtn.click();
                    break;
                case 'Escape':
                    this.closeSidebar();
                    this.closeSearch();
                    this.closeModal('statsModal');
                    this.closeModal('bookmarksModal');
                    document.getElementById('filterPanel')
                        ?.classList.add('hidden');
                    break;
            }
        });
    }

    // ============ TOUCH GESTURES ============

    setupTouchGestures() {
        const container = document.getElementById('topicContainer');
        if (!container) return;

        let startX = 0, startY = 0;

        container.addEventListener('touchstart', (e) => {
            startX = e.changedTouches[0].screenX;
            startY = e.changedTouches[0].screenY;
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            const diffX = startX - e.changedTouches[0].screenX;
            const diffY = Math.abs(startY - e.changedTouches[0].screenY);
            if (Math.abs(diffX) > 50 && diffY < 100) {
                if (diffX > 0) this.nextTopic();
                else           this.prevTopic();
            }
        }, { passive: true });
    }

    // ============ AUTO SAVE ============

    setupAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.saveProgress();
        }, 30000);

        window.addEventListener('beforeunload', () => this.saveProgress());

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.saveProgress();
        });
    }

    destroy() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.saveProgress();
    }
}

// ============ AUTO INITIALIZE ============

document.addEventListener('DOMContentLoaded', () => {
    if (typeof MODULE_CONFIG === 'undefined') {
        console.error('❌ MODULE_CONFIG not found!');
        const root = document.getElementById('module-root');
        if (root) {
            root.innerHTML = `
                <div style="padding:2rem;text-align:center;
                    color:#ef4444;font-family:sans-serif;">
                    <h2>⚠️ Configuration Error</h2>
                    <p>MODULE_CONFIG is not defined.
                       Check your HTML file.</p>
                </div>
            `;
        }
        return;
    }
    console.log(`🎓 Starting ${MODULE_CONFIG.subject} Module System`);
    window.app = new ModuleApp(MODULE_CONFIG);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleApp;
}