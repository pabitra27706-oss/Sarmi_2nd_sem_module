/* ========================================
   MODULE RENDER - HTML Generation
   Supports BOTH module and practice JSON
   ======================================== */

const ModuleRender = {

    // ============ MAIN PAGE ============

    renderPage(config) {
        return `
            <div class="loading-screen" id="loadingScreen">
                <div class="loading-spinner"></div>
                <p>Loading ${config.subject}...</p>
            </div>

            <header class="app-header">
                <div class="header-left">
                    <button class="icon-btn" id="menuBtn" title="Menu (M)">
                        ${ModuleHelpers.icons.menu}
                    </button>
                    <div class="header-title">
                        <h1>${config.subject}</h1>
                        <div class="header-subtitle">
                            <span>${config.subjectCode}</span>
                            <span class="header-badge">Sem ${config.semester}</span>
                        </div>
                    </div>
                </div>
                <div class="header-right">
                    <button class="icon-btn" id="searchBtn" title="Search (S)">
                        ${ModuleHelpers.icons.search}
                    </button>
                    <button class="icon-btn" id="themeBtn" title="Theme (D)">
                        <span class="sun-icon">${ModuleHelpers.icons.sun}</span>
                        <span class="moon-icon hidden">
                            ${ModuleHelpers.icons.moon}
                        </span>
                    </button>
                </div>
            </header>

            <div class="app-layout">
                ${this.renderSidebar(config)}
                <main class="main-content">
                    ${this.renderModuleTabs(config)}
                    ${this.renderToolbar()}
                    <div class="topic-container" id="topicContainer">
                        ${this.renderLoading()}
                    </div>
                    ${this.renderNavFooter()}
                </main>
            </div>

            <div class="overlay" id="overlay"></div>
            ${this.renderSearchPanel()}
            ${this.renderFilterPanel()}
            ${this.renderStatsModal()}
            ${this.renderBookmarksModal()}
            ${this.renderToast()}
            ${this.renderGoToTop()}
        `;
    },

    // ============ SIDEBAR ============

    renderSidebar(config) {
        return `
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <h2>Questions</h2>
                    <button class="icon-btn" id="closeSidebar">
                        ${ModuleHelpers.icons.close}
                    </button>
                </div>
                <div class="sidebar-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="overallProgress"
                            style="width:0%"></div>
                    </div>
                    <div class="progress-text" id="topicPosition">
                        Loading...
                    </div>
                </div>
                <div class="sidebar-actions">
                    <button class="sidebar-action-btn" id="bookmarksBtn">
                        ${ModuleHelpers.icons.bookmark}
                        <span>Bookmarks</span>
                        <span class="badge" id="bookmarkCount">0</span>
                    </button>
                    <button class="sidebar-action-btn" id="statsBtn">
                        ${ModuleHelpers.icons.barChart}
                        <span>Statistics</span>
                    </button>
                    <button class="sidebar-action-btn" id="printBtn">
                        ${ModuleHelpers.icons.print}
                        <span>Print / Export</span>
                    </button>
                    <button class="sidebar-action-btn danger" id="resetBtn">
                        ${ModuleHelpers.icons.trash}
                        <span>Reset Progress</span>
                    </button>
                </div>
                <div class="sidebar-list" id="topicList"></div>
            </aside>
        `;
    },

    // ============ MODULE TABS ============

    renderModuleTabs(config) {
        const tabs = config.modules.map(m => {
            const info  = config.moduleInfo?.[m];
            const label = info ? info.name : `Module ${m}`;
            return `
                <button class="module-tab ${m === config.modules[0] ? 'active' : ''}"
                    data-module="${m}" title="${label}">
                    M${m}: ${label.length > 18 ? `Module ${m}` : label}
                </button>
            `;
        }).join('');

        return `
            <div class="module-tabs-container">
                <div class="module-tabs">${tabs}</div>
            </div>
        `;
    },

    // ============ TOOLBAR ============

    renderToolbar() {
        return `
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="mode-toggle">
                        <button class="mode-btn active" data-mode="study">
                            Study
                        </button>
                        <button class="mode-btn" data-mode="practice">
                            Practice
                        </button>
                        <button class="mode-btn" data-mode="review">
                            Review
                        </button>
                    </div>
                </div>
                <div class="toolbar-right">
                    <div class="progress-mini">
                        <span id="completedCount">0/0</span>
                        <span class="progress-divider">|</span>
                        <span id="scoreCount">0/0</span>
                    </div>
                    <button class="icon-btn" id="filterBtn" title="Filter">
                        ${ModuleHelpers.icons.filter}
                    </button>
                </div>
            </div>
        `;
    },

    // ============ TOPIC RENDERER (MAIN DISPATCHER) ============

    renderTopic(topic, state) {
        if (!topic) return this.renderEmpty();

        // Route to correct renderer based on type
        if (topic.type === 'mcq') {
            return this.renderMCQTopic(topic, state);
        }
        if (topic.type === 'truefalse') {
            return this.renderTFTopic(topic, state);
        }
        if (topic.type === 'gapfill') {
            return this.renderGapFillTopic(topic, state);
        }

        // For practice set: derivation, theory, numerical, diagram, example
        // For module set: definition, theory, etc.
        return this.renderContentTopic(topic, state);
    },

    // ============ CONTENT TOPIC ============
    // Handles: theory, derivation, numerical, diagram, example, definition

    renderContentTopic(topic, state) {
        const isBookmarked = state.bookmarks.includes(topic._uniqueId);
        const isCompleted  = state.completedTopics.includes(topic._uniqueId);
        const userAnswer   = state.userAnswers[topic._uniqueId];
        const isViewed     = userAnswer?.viewed;
        const isPractice   = topic._jsonType === 'practice';

        const showContent  = state.mode === 'review' || isViewed || isCompleted;

        // Build question number label
        const qLabel = isPractice
            ? (topic.isMultipart
                ? `Q${topic.questionNumber}(${topic.part})`
                : `Q${topic.questionNumber}`)
            : `T${topic._index + 1}`;

        // Show parent question info for multi-part
        const parentInfo = (isPractice && topic.isMultipart)
            ? `<div class="parent-question-badge">
                Part of Q${topic.questionNumber}: ${topic.parentTitle || ''}
               </div>`
            : '';

        return `
            <div class="topic-card" data-module="${topic._module}"
                data-json-type="${topic._jsonType}">

                ${parentInfo}

                <div class="topic-header">
                    <div class="topic-meta">
                        <span class="topic-number">${qLabel}</span>
                        <span class="topic-type
                            ${ModuleHelpers.getTypeClass(topic.type)}">
                            ${ModuleHelpers.getTypeLabel(topic.type)}
                        </span>
                        ${topic.difficulty ? `
                            <span class="topic-difficulty ${topic.difficulty}">
                                ${ModuleHelpers.getDifficultyLabel(topic.difficulty)}
                            </span>
                        ` : ''}
                        ${topic.marks ? `
                            <span class="topic-marks">${topic.marks} marks</span>
                        ` : ''}
                        ${topic.unit ? `
                            <span class="topic-unit">${topic.unit}</span>
                        ` : ''}
                    </div>
                    <div class="topic-actions">
                        <button class="complete-btn ${isCompleted ? 'active' : ''}"
                            id="completeBtn" title="Mark Complete (C)">
                            ${isCompleted
                                ? ModuleHelpers.icons.checkCircle
                                : ModuleHelpers.icons.check}
                        </button>
                        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}"
                            id="bookmarkBtn" title="Bookmark (B)">
                            ${isBookmarked
                                ? ModuleHelpers.icons.bookmarkFilled
                                : ModuleHelpers.icons.bookmark}
                        </button>
                    </div>
                </div>

                ${isPractice ? `
                    <div class="practice-question-box">
                        <div class="practice-question-label">Question:</div>
                        <div class="practice-question-text">
                            ${topic.question || ''}
                        </div>
                    </div>
                ` : `
                    <h3 class="topic-title">${topic.title || ''}</h3>
                    ${topic.description ? `
                        <p class="topic-text">${topic.description}</p>
                    ` : ''}
                `}

                ${showContent && (topic.content || topic.answer) ? `
                    <div class="answer-display">
                        <div class="answer-display-label">
                            ${isPractice ? '📝 Answer:' : '📖 Content:'}
                        </div>
                        <div class="answer-content">
                            ${topic.content || topic.answer || ''}
                        </div>
                    </div>
                ` : ''}

                ${!showContent ? `
                    <button class="show-answer-btn" id="showAnswerBtn">
                        ${ModuleHelpers.icons.eye}
                        <span>
                            ${isPractice ? 'Show Answer' : 'Show Content'}
                        </span>
                    </button>
                ` : ''}

                ${topic.keyPoints && topic.keyPoints.length > 0 && showContent
                    ? `<div class="key-points">
                        <h5>📝 Key Points</h5>
                        <ul>
                            ${topic.keyPoints.map(
                                kp => `<li>${kp}</li>`
                            ).join('')}
                        </ul>
                       </div>`
                    : ''}
            </div>
        `;
    },

    // ============ MCQ TOPIC ============

    renderMCQTopic(topic, state) {
        const isBookmarked = state.bookmarks.includes(topic._uniqueId);
        const isCompleted  = state.completedTopics.includes(topic._uniqueId);
        const userAnswer   = state.userAnswers[topic._uniqueId];
        const hasAnswered  = userAnswer?.isCorrect !== undefined;
        const isReview     = state.mode === 'review';

        return `
            <div class="topic-card" data-module="${topic._module}">
                <div class="topic-header">
                    <div class="topic-meta">
                        <span class="topic-number">
                            Q${topic.questionNumber || topic._index + 1}
                        </span>
                        <span class="topic-type type-mcq">MCQ</span>
                        ${topic.difficulty ? `
                            <span class="topic-difficulty ${topic.difficulty}">
                                ${ModuleHelpers.getDifficultyLabel(topic.difficulty)}
                            </span>
                        ` : ''}
                        ${topic.marks
                            ? `<span class="topic-marks">${topic.marks} marks</span>`
                            : ''}
                    </div>
                    <div class="topic-actions">
                        <button class="complete-btn ${isCompleted ? 'active' : ''}"
                            id="completeBtn">
                            ${isCompleted
                                ? ModuleHelpers.icons.checkCircle
                                : ModuleHelpers.icons.check}
                        </button>
                        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}"
                            id="bookmarkBtn">
                            ${isBookmarked
                                ? ModuleHelpers.icons.bookmarkFilled
                                : ModuleHelpers.icons.bookmark}
                        </button>
                    </div>
                </div>

                <div class="question-text">
                    ${topic.question || topic.title || ''}
                </div>

                <div class="mcq-options">
                    ${(topic.options || []).map((opt, i) => {
                        let cls  = 'mcq-option';
                        let icon = '';

                        if (hasAnswered || isReview) {
                            cls += ' disabled';
                            if (i === topic.correct) {
                                cls += ' correct';
                                icon = `<span class="option-icon correct">
                                    ${ModuleHelpers.icons.checkCircle}
                                </span>`;
                            } else if (hasAnswered && userAnswer.answer === i) {
                                cls += ' wrong';
                                icon = `<span class="option-icon wrong">
                                    ${ModuleHelpers.icons.xCircle}
                                </span>`;
                            }
                        }

                        return `
                            <div class="${cls}" data-option-index="${i}">
                                <span class="option-indicator">
                                    ${String.fromCharCode(65 + i)}
                                </span>
                                <span class="option-text">${opt}</span>
                                ${icon}
                            </div>
                        `;
                    }).join('')}
                </div>

                ${!hasAnswered && !isReview
                    ? `<button class="submit-btn" id="submitBtn" disabled>
                        Submit Answer
                       </button>`
                    : ''}

                ${hasAnswered ? this.renderFeedback(userAnswer, topic) : ''}

                ${isReview && topic.explanation ? `
                    <div class="feedback-section correct">
                        <div class="feedback-header">
                            <span class="feedback-icon correct">
                                ${ModuleHelpers.icons.checkCircle}
                            </span>
                            <span class="feedback-title">
                                Answer:
                                ${String.fromCharCode(65 + topic.correct)}
                            </span>
                        </div>
                        <div class="feedback-body">
                            <div class="explanation-text">
                                ${topic.explanation}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ============ TRUE/FALSE TOPIC ============

    renderTFTopic(topic, state) {
        const isBookmarked = state.bookmarks.includes(topic._uniqueId);
        const isCompleted  = state.completedTopics.includes(topic._uniqueId);
        const userAnswer   = state.userAnswers[topic._uniqueId];
        const hasAnswered  = userAnswer?.isCorrect !== undefined;
        const isReview     = state.mode === 'review';

        const renderTFBtn = (value, label) => {
            let cls = 'tf-option';
            if (hasAnswered || isReview) {
                cls += ' disabled';
                if (value === topic.correct) cls += ' correct';
                else if (hasAnswered && userAnswer.answer === value) cls += ' wrong';
            }
            return `<button class="${cls}" data-tf-value="${value}"
                ${hasAnswered || isReview ? 'disabled' : ''}>${label}</button>`;
        };

        return `
            <div class="topic-card" data-module="${topic._module}">
                <div class="topic-header">
                    <div class="topic-meta">
                        <span class="topic-number">
                            Q${topic.questionNumber || topic._index + 1}
                        </span>
                        <span class="topic-type type-truefalse">True/False</span>
                        ${topic.marks
                            ? `<span class="topic-marks">${topic.marks} marks</span>`
                            : ''}
                    </div>
                    <div class="topic-actions">
                        <button class="complete-btn ${isCompleted ? 'active' : ''}"
                            id="completeBtn">
                            ${isCompleted
                                ? ModuleHelpers.icons.checkCircle
                                : ModuleHelpers.icons.check}
                        </button>
                        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}"
                            id="bookmarkBtn">
                            ${isBookmarked
                                ? ModuleHelpers.icons.bookmarkFilled
                                : ModuleHelpers.icons.bookmark}
                        </button>
                    </div>
                </div>
                <div class="question-text">
                    ${topic.question || topic.title || ''}
                </div>
                <div class="tf-options">
                    ${renderTFBtn(true, 'True')}
                    ${renderTFBtn(false, 'False')}
                </div>
                ${!hasAnswered && !isReview
                    ? `<button class="submit-btn" id="submitBtn" disabled>
                        Submit
                       </button>`
                    : ''}
                ${hasAnswered ? this.renderFeedback(userAnswer, topic) : ''}
            </div>
        `;
    },

    // ============ GAP FILL TOPIC ============

    renderGapFillTopic(topic, state) {
        const isBookmarked = state.bookmarks.includes(topic._uniqueId);
        const isCompleted  = state.completedTopics.includes(topic._uniqueId);
        const userAnswer   = state.userAnswers[topic._uniqueId];
        const hasAnswered  = userAnswer?.isCorrect !== undefined;
        const isReview     = state.mode === 'review';

        let inputClass = 'gapfill-input';
        let inputValue = '';
        let inputDis   = '';

        if (hasAnswered) {
            inputClass += userAnswer.isCorrect ? ' correct' : ' wrong';
            inputValue  = userAnswer.answer || '';
            inputDis    = 'disabled';
        }
        if (isReview) {
            inputValue = topic.answer || '';
            inputDis   = 'disabled';
            inputClass += ' correct';
        }

        return `
            <div class="topic-card" data-module="${topic._module}">
                <div class="topic-header">
                    <div class="topic-meta">
                        <span class="topic-number">
                            Q${topic.questionNumber || topic._index + 1}
                        </span>
                        <span class="topic-type type-gapfill">Gap Fill</span>
                        ${topic.marks
                            ? `<span class="topic-marks">${topic.marks} marks</span>`
                            : ''}
                    </div>
                    <div class="topic-actions">
                        <button class="complete-btn ${isCompleted ? 'active' : ''}"
                            id="completeBtn">
                            ${isCompleted
                                ? ModuleHelpers.icons.checkCircle
                                : ModuleHelpers.icons.check}
                        </button>
                        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}"
                            id="bookmarkBtn">
                            ${isBookmarked
                                ? ModuleHelpers.icons.bookmarkFilled
                                : ModuleHelpers.icons.bookmark}
                        </button>
                    </div>
                </div>
                <div class="question-text">
                    ${topic.question || topic.title || ''}
                </div>
                <div class="gapfill-wrapper">
                    <input type="text" class="${inputClass}" id="gapfillInput"
                        placeholder="Type your answer..."
                        value="${ModuleHelpers.escapeHTML(inputValue)}"
                        ${inputDis}>
                </div>
                ${!hasAnswered && !isReview
                    ? `<button class="submit-btn" id="submitBtn" disabled>
                        Submit
                       </button>`
                    : ''}
                ${hasAnswered ? this.renderFeedback(userAnswer, topic) : ''}
            </div>
        `;
    },

    // ============ FEEDBACK ============

    renderFeedback(userAnswer, topic) {
        if (!userAnswer || userAnswer.isCorrect === undefined) return '';

        const isCorrect     = userAnswer.isCorrect;
        const feedbackClass = isCorrect ? 'correct' : 'wrong';
        const icon          = isCorrect
            ? ModuleHelpers.icons.checkCircle
            : ModuleHelpers.icons.xCircle;

        let correctAnswerText = '';
        if (!isCorrect) {
            if (topic.type === 'mcq' && topic.options) {
                correctAnswerText = `<p><strong>Correct Answer:</strong>
                    ${String.fromCharCode(65 + topic.correct)}
                    - ${topic.options[topic.correct]}</p>`;
            } else if (topic.type === 'truefalse') {
                correctAnswerText = `<p><strong>Correct Answer:</strong>
                    ${topic.correct ? 'True' : 'False'}</p>`;
            } else if (topic.type === 'gapfill') {
                correctAnswerText = `<p><strong>Correct Answer:</strong>
                    ${topic.answer}</p>`;
            }
        }

        return `
            <div class="feedback-section ${feedbackClass}">
                <div class="feedback-header">
                    <span class="feedback-icon ${feedbackClass}">${icon}</span>
                    <span class="feedback-title">
                        ${isCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                </div>
                <div class="feedback-body">
                    ${correctAnswerText}
                    ${topic.explanation ? `
                        <div class="explanation">
                            <strong>Explanation:</strong>
                            <div class="explanation-text">
                                ${topic.explanation}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ============ TOPIC LIST (Sidebar) ============

    renderTopicList(
        topics, currentIndex, userAnswers,
        bookmarks, completedTopics, jsonType
    ) {
        if (!topics || topics.length === 0) {
            return '<div class="empty-state"><p>No items loaded</p></div>';
        }

        return topics.map((topic, index) => {
            const isCompleted  = completedTopics.includes(topic._uniqueId);
            const isBookmarked = bookmarks.includes(topic._uniqueId);
            const answer       = userAnswers[topic._uniqueId];
            const isActive     = index === currentIndex;

            let statusClass = '';
            if (isCompleted)                  statusClass = 'completed';
            else if (isBookmarked)            statusClass = 'bookmarked';
            else if (answer?.isCorrect === true)  statusClass = 'completed';
            else if (answer?.isCorrect === false) statusClass = 'in-progress';
            else if (answer?.viewed)          statusClass = 'in-progress';

            // Label for sidebar
            let label;
            if (jsonType === 'practice') {
                const partLabel = topic.isMultipart
                    ? `Q${topic.questionNumber}(${topic.part})`
                    : `Q${topic.questionNumber}`;
                const unitText = topic.unit
                    ? ` - ${topic.unit}` : '';
                label = `${partLabel}${unitText}`;
            } else {
                label = topic.title
                    ? ModuleHelpers.truncateText(topic.title, 35)
                    : `Topic ${index + 1}`;
            }

            return `
                <div class="topic-item
                    ${isActive ? 'active' : ''} ${statusClass}"
                    data-topic-index="${index}">
                    <span class="topic-item-status"></span>
                    <span class="topic-item-text">${label}</span>
                </div>
            `;
        }).join('');
    },

    // ============ NAVIGATOR DOTS ============

    renderNavigator(
        topics, currentIndex, userAnswers, bookmarks, completedTopics
    ) {
        if (!topics || topics.length === 0) return '';

        return topics.map((topic, index) => {
            let cls            = 'nav-dot';
            const isCompleted  = completedTopics.includes(topic._uniqueId);
            const isBookmarked = bookmarks.includes(topic._uniqueId);
            const answer       = userAnswers[topic._uniqueId];

            if (index === currentIndex)                 cls += ' active';
            else if (isCompleted || answer?.isCorrect === true) cls += ' completed';
            else if (answer?.isCorrect === false
                  || answer?.viewed)                    cls += ' in-progress';
            if (isBookmarked) cls += ' bookmarked';

            // Dot label
            const label = topic.isMultipart
                ? `${topic.questionNumber}${topic.part}`
                : `${index + 1}`;

            return `<button class="${cls}"
                data-topic-index="${index}"
                title="${topic.title || `Item ${index + 1}`}">
                ${label}
            </button>`;
        }).join('');
    },

    // ============ SEARCH ============

    renderSearchPanel() {
        return `
            <div class="search-panel hidden" id="searchPanel">
                <div class="search-header">
                    <div class="search-input-wrapper">
                        ${ModuleHelpers.icons.search}
                        <input type="text" id="searchInput"
                            placeholder="Search questions and topics...">
                    </div>
                    <button class="icon-btn" id="closeSearch">
                        ${ModuleHelpers.icons.close}
                    </button>
                </div>
                <div class="search-results" id="searchResults"></div>
            </div>
        `;
    },

    renderSearchResults(results, searchTerm) {
        if (!results || results.length === 0) {
            return `<div class="search-empty">
                No results for "${ModuleHelpers.escapeHTML(searchTerm)}"
            </div>`;
        }

        return results.slice(0, 20).map(r => {
            const topic   = r.topic;
            const isPrac  = topic._jsonType === 'practice';
            const title   = isPrac
                ? (topic.isMultipart
                    ? `Q${topic.questionNumber}(${topic.part}): ${topic.unit}`
                    : `Q${topic.questionNumber}: ${topic.unit}`)
                : (topic.title || `Topic ${topic._index + 1}`);

            const preview = ModuleHelpers.truncateText(
                topic.question || topic.description || topic.content || '', 80
            );

            return `
                <div class="search-result-item"
                    data-topic-id="${topic._uniqueId}">
                    <div class="search-result-meta">
                        <span class="topic-type
                            ${ModuleHelpers.getTypeClass(topic.type)}">
                            ${ModuleHelpers.getTypeLabel(topic.type)}
                        </span>
                        ${topic.difficulty ? `
                            <span class="topic-difficulty ${topic.difficulty}">
                                ${topic.difficulty}
                            </span>
                        ` : ''}
                    </div>
                    <div class="search-result-text">
                        ${ModuleHelpers.highlightText(
                            ModuleHelpers.escapeHTML(title), searchTerm
                        )}
                    </div>
                    ${preview ? `
                        <div class="search-result-text"
                            style="color:var(--text-muted);font-size:0.8rem;
                            margin-top:4px;">
                            ${ModuleHelpers.highlightText(
                                ModuleHelpers.escapeHTML(preview), searchTerm
                            )}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    // ============ FILTER PANEL ============

    renderFilterPanel() {
        return `
            <div class="filter-panel hidden" id="filterPanel">
                <div class="filter-section">
                    <h4>Question Type</h4>
                    <div class="filter-options">
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="definition"> Definition
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="theory"> Theory
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="numerical"> Numerical
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="derivation"> Derivation
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="diagram"> Diagram
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="example"> Example
                        </label>
                        <label>
                            <input type="checkbox" class="filter-type"
                                value="mcq"> MCQ
                        </label>
                    </div>
                </div>
                <div class="filter-section">
                    <h4>Difficulty</h4>
                    <div class="filter-options">
                        <label>
                            <input type="checkbox" class="filter-difficulty"
                                value="easy"> Easy
                        </label>
                        <label>
                            <input type="checkbox" class="filter-difficulty"
                                value="medium"> Medium
                        </label>
                        <label>
                            <input type="checkbox" class="filter-difficulty"
                                value="hard"> Hard
                        </label>
                    </div>
                </div>
                <div class="filter-section">
                    <h4>Status</h4>
                    <div class="filter-options">
                        <label>
                            <input type="checkbox" class="filter-status"
                                value="completed"> Completed
                        </label>
                        <label>
                            <input type="checkbox" class="filter-status"
                                value="incomplete"> Not Completed
                        </label>
                        <label>
                            <input type="checkbox" class="filter-status"
                                value="viewed"> Viewed
                        </label>
                        <label>
                            <input type="checkbox" class="filter-status"
                                value="bookmarked"> Bookmarked
                        </label>
                    </div>
                </div>
                <div class="filter-actions">
                    <button class="btn-secondary" id="resetFilters">Reset</button>
                    <button class="btn-primary" id="applyFilters">Apply</button>
                </div>
            </div>
        `;
    },

    // ============ STATS MODAL ============

    renderStatsModal() {
        return `
            <div class="modal hidden" id="statsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📊 Statistics</h2>
                        <button class="icon-btn close-modal"
                            data-modal="statsModal">
                            ${ModuleHelpers.icons.close}
                        </button>
                    </div>
                    <div class="modal-body" id="statsContent">
                        <div class="empty-state"><p>Loading...</p></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderStats(stats, config) {
        return `
            <div class="stats-grid">
                <div class="stats-card">
                    <h3>📈 Completion</h3>
                    <div class="stats-row">
                        <span>Items Completed</span>
                        <strong>
                            ${stats.completionStats.completed} /
                            ${stats.completionStats.total}
                        </strong>
                    </div>
                    <div class="stats-bar">
                        <div class="stats-bar-fill"
                            style="width:${stats.completionPct}%"></div>
                    </div>
                    <div class="stats-row">
                        <span>Completion %</span>
                        <strong>${stats.completionPct}%</strong>
                    </div>
                </div>

                ${stats.practiceStats ? `
                    <div class="stats-card">
                        <h3>📋 Practice Set</h3>
                        <div class="stats-row">
                            <span>Total Questions</span>
                            <strong>${stats.practiceStats.totalQuestions}</strong>
                        </div>
                        <div class="stats-row">
                            <span>Viewed</span>
                            <strong>${stats.practiceStats.viewed}</strong>
                        </div>
                    </div>
                ` : ''}

                ${stats.score.total > 0 ? `
                    <div class="stats-card">
                        <h3>🎯 Practice Score</h3>
                        <div class="stats-row">
                            <span>Attempted</span>
                            <strong>
                                ${stats.score.attempted}/${stats.score.total}
                            </strong>
                        </div>
                        <div class="stats-row">
                            <span>Correct</span>
                            <strong class="text-success">
                                ${stats.score.correct}
                            </strong>
                        </div>
                        <div class="stats-row">
                            <span>Accuracy</span>
                            <strong>${stats.overallAccuracy}%</strong>
                        </div>
                    </div>
                ` : ''}

                ${Object.keys(stats.typeStats).length > 0 ? `
                    <div class="stats-card">
                        <h3>📋 By Type</h3>
                        ${Object.entries(stats.typeStats).map(([type, data]) => `
                            <div class="stats-type-row">
                                <span>${ModuleHelpers.getTypeLabel(type)}</span>
                                <strong>${data.viewed}/${data.total}</strong>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ============ BOOKMARKS MODAL ============

    renderBookmarksModal() {
        return `
            <div class="modal hidden" id="bookmarksModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🔖 Bookmarks</h2>
                        <button class="icon-btn close-modal"
                            data-modal="bookmarksModal">
                            ${ModuleHelpers.icons.close}
                        </button>
                    </div>
                    <div class="modal-body" id="bookmarksContent">
                        <div class="empty-state">
                            <p>No bookmarks yet</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderBookmarks(topics, bookmarks, userAnswers, completedTopics) {
        if (!bookmarks || bookmarks.length === 0) {
            return `
                <div class="empty-state">
                    ${ModuleHelpers.icons.bookmark}
                    <p>No bookmarks yet</p>
                    <small>Press B to bookmark any question</small>
                </div>
            `;
        }

        const bookmarkedTopics = bookmarks
            .map(id => topics.find(t => t._uniqueId === id))
            .filter(Boolean);

        if (bookmarkedTopics.length === 0) {
            return '<div class="empty-state"><p>No bookmarks in this module</p></div>';
        }

        return `
            <div class="bookmarks-list">
                ${bookmarkedTopics.map(topic => {
                    const isCompleted = completedTopics.includes(topic._uniqueId);
                    const isPractice  = topic._jsonType === 'practice';

                    const label = isPractice
                        ? (topic.isMultipart
                            ? `Q${topic.questionNumber}(${topic.part})`
                            : `Q${topic.questionNumber}`)
                            + (topic.unit ? ` - ${topic.unit}` : '')
                        : (topic.title || `Topic ${topic._index + 1}`);

                    return `
                        <div class="bookmark-item"
                            data-topic-id="${topic._uniqueId}">
                            <div class="bookmark-content">
                                <div class="bookmark-meta">
                                    <span class="topic-type
                                        ${ModuleHelpers.getTypeClass(topic.type)}">
                                        ${ModuleHelpers.getTypeLabel(topic.type)}
                                    </span>
                                    ${isCompleted
                                        ? '<span class="status-badge completed">Done</span>'
                                        : ''}
                                </div>
                                <div class="bookmark-text">
                                    ${ModuleHelpers.escapeHTML(label)}
                                </div>
                            </div>
                            <button class="remove-bookmark-btn"
                                data-bookmark-id="${topic._uniqueId}">
                                ${ModuleHelpers.icons.close}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ============ NAV FOOTER ============

    renderNavFooter() {
        return `
            <div class="nav-footer" id="navFooter">
                <div class="topic-navigator" id="topicNavigator"></div>
                <div class="nav-buttons">
                    <button class="nav-btn" id="prevBtn" disabled>
                        ${ModuleHelpers.icons.arrowLeft}
                        <span>Previous</span>
                    </button>
                    <button class="nav-btn" id="nextBtn" disabled>
                        <span>Next</span>
                        ${ModuleHelpers.icons.arrowRight}
                    </button>
                </div>
            </div>
        `;
    },

    // ============ TOAST ============

    renderToast() {
        return '<div class="toast hidden" id="toast"></div>';
    },

    showToast(message, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className   = `toast ${type || ''}`;
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    },

    // ============ GO TO TOP ============

    renderGoToTop() {
        return `
            <button class="go-to-top hidden" id="goToTop" title="Go to top">
                ${ModuleHelpers.icons.arrowUp}
            </button>
        `;
    },

    // ============ STATE SCREENS ============

    renderLoading() {
        return `
            <div class="state-container loading">
                <div class="loading-spinner"></div>
                <h3>Loading...</h3>
                <p>Please wait while content loads.</p>
            </div>
        `;
    },

    renderError(message) {
        return `
            <div class="state-container">
                ${ModuleHelpers.icons.alertCircle}
                <h3>Unable to Load</h3>
                <p>${ModuleHelpers.escapeHTML(message)}</p>
                <button class="btn-primary" onclick="location.reload()">
                    ${ModuleHelpers.icons.refreshCw} Try Again
                </button>
            </div>
        `;
    },

    renderEmpty() {
        return `
            <div class="state-container">
                ${ModuleHelpers.icons.inbox}
                <h3>No Items Found</h3>
                <p>No items match your current filters.</p>
                <button class="btn-secondary"
                    onclick="window.app && window.app.resetFilters()">
                    Reset Filters
                </button>
            </div>
        `;
    },

    // ============ PRINT OVERLAY ============

    renderPrintOverlay(topics, config, moduleNumber, filters, jsonType) {
        const moduleInfo  = config.moduleInfo?.[moduleNumber];
        const moduleTitle = moduleInfo
            ? moduleInfo.name : `Module ${moduleNumber}`;
        const isPractice  = jsonType === 'practice';

        return `
            <div class="print-action-bar">
                <div class="print-bar-left">
                    <button class="print-bar-btn" id="printBackBtn">
                        ${ModuleHelpers.icons.back} Back
                    </button>
                </div>
                <div class="print-bar-center">
                    <div class="print-size-group">
                        <button class="print-size-btn size-small"
                            data-print-size="small">A</button>
                        <button class="print-size-btn size-normal active"
                            data-print-size="normal">A</button>
                        <button class="print-size-btn size-large"
                            data-print-size="large">A</button>
                    </div>
                </div>
                <div class="print-bar-right">
                    <button class="print-bar-btn primary" id="printNowBtn">
                        ${ModuleHelpers.icons.print} Print
                    </button>
                </div>
            </div>

            <div class="print-body">
                <div class="print-page-header">
                    <h1>${config.subject}</h1>
                    <div class="print-page-meta">
                        ${config.subjectCode} | ${config.university} |
                        ${config.course} | Semester ${config.semester}<br>
                        Module ${moduleNumber}: ${moduleTitle}
                        ${isPractice ? ' | Practice Set' : ''}
                    </div>
                    <div class="print-page-breakdown">
                        ${topics.length} item${topics.length !== 1 ? 's' : ''}
                    </div>
                </div>

                ${topics.map((topic, i) =>
                    this.renderPrintTopic(topic, i, isPractice)
                ).join('')}

                <div class="print-page-footer">
                    Generated from B.Tech Module Learning System
                </div>
            </div>
        `;
    },

    renderPrintTopic(topic, index, isPractice) {
        const typeLabel = ModuleHelpers.getTypeLabel(topic.type);

        const qLabel = isPractice
            ? (topic.isMultipart
                ? `Q${topic.questionNumber}(${topic.part})`
                : `Q${topic.questionNumber}`)
            : `${index + 1}`;

        const questionText = isPractice
            ? (topic.question || topic.title || '')
            : `<strong>${topic.title || ''}</strong>
               ${topic.description
                ? `<br><em>${topic.description}</em>` : ''}`;

        const answerContent = topic.content || topic.answer || '';

        let mcqHTML = '';
        if (topic.type === 'mcq' && topic.options) {
            mcqHTML = `
                <div class="pq-options">
                    ${topic.options.map((opt, i) => `
                        <div class="pq-option
                            ${i === topic.correct ? 'correct-opt' : ''}">
                            ${String.fromCharCode(65 + i)}) ${opt}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        let keyPointsHTML = '';
        if (topic.keyPoints && topic.keyPoints.length > 0) {
            keyPointsHTML = `
                <div class="pq-keywords">
                    <strong>Key Points:</strong>
                    <ul>
                        ${topic.keyPoints.map(kp => `<li>${kp}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        return `
            <div class="print-question-block">
                <div class="pq-header">
                    <span class="pq-number">${qLabel}.</span>
                    <span class="pq-type">${typeLabel}</span>
                    ${topic.difficulty
                        ? `<span class="pq-difficulty ${topic.difficulty}">
                            ${topic.difficulty}
                           </span>`
                        : ''}
                    ${topic.marks
                        ? `<span class="pq-marks">[${topic.marks}m]</span>`
                        : ''}
                    ${topic.unit
                        ? `<span class="pq-group">${topic.unit}</span>`
                        : ''}
                </div>

                <div class="pq-text">${questionText}</div>

                ${mcqHTML}

                ${answerContent ? `
                    <div class="pq-answer">
                        <span class="pq-answer-label">
                            ${isPractice ? 'Answer:' : 'Content:'}
                        </span>
                        <div class="pq-answer-content">${answerContent}</div>
                    </div>
                ` : ''}

                ${keyPointsHTML}
            </div>
        `;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleRender;
}