import { supabase } from "/supabase/config.js";

// =============================================================================
//  ADMIN SETTINGS  -  CHANGE THESE EVERY DAY BEFORE THE NEXT EXAM
// =============================================================================
//  Unique name for today's exam. Once a student submits, this key is saved in
//  their browser and they cannot start the same exam again. Change it each day
//  (e.g. "exam_2026_10_26") so students can take the next day's test.
const EXAM_KEY = "2026_10_24";

//  Exam ID used when saving results in the database.
const exam_id = 1;
// =============================================================================

const TOTAL_TIME_SECONDS = 3 * 60 * 60; // 3 hours (10800 seconds)
// const { data: { session } } = await supabase.auth.getSession();

// if (!session) {
//     window.location.href = "login.html";
// }
// const user = session.user;
// const { data: profile, error } = await supabase.from("profiles").select("paid").eq("id", user.id).single();
// if (error) {
//     window.location.href = "login.html";
// }
//Change this code after payment integration not right now
// if (profile.paid) {
//     window.location.href = "exam.html";
// } else {
//     window.location.href = "payment.html";
// }

// localStorage keys. They include the exam key AND the student id, so:
//  - a new EXAM_KEY the next day starts completely fresh (no old state/lock), and
//  - two students sharing one browser don't block each other.


//change this place code later ok
const COMPLETED_KEY = `cee_exam_completed_${EXAM_KEY}_person`;
const STATE_KEY = `cee_exam_state_${EXAM_KEY}_person`;

(function loadTheme() {
    const savedTheme = localStorage.getItem('sankalpa-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

// Map index to subjects exactly as described by the structure requirement
const SUBJECTS = {
    0: { name: "Physics", limit: 50 },
    1: { name: "Chemistry", limit: 50 },
    2: { name: "Zoology", limit: 40 },
    3: { name: "Botany", limit: 40 },
    4: { name: "MAT", limit: 20 }
};

let examData = []; // Will hold the parsed JSON
let timerInterval; // Global timer reference

// State management
let state = {
    answers: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
    // Questions that were answered and then committed with "Next" (cannot be changed again)
    locked: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
    currentSubj: 0,
    progress: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
    remainingTime: TOTAL_TIME_SECONDS
};

let isSubmitting = false; // Prevent double-submit

// DOM Elements
const els = {
    questionJumpSelector: document.getElementById('question-jump-selector'),
    timerDisplay: document.getElementById('exam-timer'),
    subjectSelector: document.getElementById('subject-selector'),
    subjBadge: document.getElementById('subject-badge'),
    qNum: document.getElementById('question-number'),
    qText: document.getElementById('question-text'),
    qImage: document.getElementById('question-image'),
    optContainer: document.getElementById('options-container'),
    optButtons: document.querySelectorAll('.option-btn'),
    nextBtn: document.getElementById('next-btn'),
    skipBtn: document.getElementById('skip-btn'),
    submitBtn: document.getElementById('submit-exam-btn'),
    modal: document.getElementById('submit-modal'),
    modalText: document.getElementById('modal-text'),
    modalYes: document.getElementById('modal-yes'),
    modalNo: document.getElementById('modal-no'),
    examContainer: document.getElementById('exam-container'),
    resultContainer: document.getElementById('result-container'),
    scoreBoard: document.getElementById('score-board'),
    completedNote: document.getElementById('already-completed-note'),
    reviewSection: document.getElementById('review-section'),
    reviewSubtitle: document.getElementById('review-subtitle'),
    reviewList: document.getElementById('review-list')
};

// ---------------------------------------------------------------------------
// Lock warning UI (styles live in exam.css)
// ---------------------------------------------------------------------------
let lockBanner = null;
let lockToast = null;
let toastTimeout = null;

function createLockUI() {
    // Persistent banner shown above the options on a locked question
    lockBanner = document.createElement('div');
    lockBanner.className = 'lock-banner';
    lockBanner.hidden = true;
    lockBanner.innerHTML = '<span>\u26A0\uFE0F</span><span>You have already answered this question and moved on. Your answer is locked and cannot be changed.</span>';
    els.optContainer.parentNode.insertBefore(lockBanner, els.optContainer);

    // Temporary toast shown when the student tries to interact with a locked question
    lockToast = document.createElement('div');
    lockToast.className = 'lock-toast';
    lockToast.setAttribute('role', 'alert');
    document.body.appendChild(lockToast);
}

function showLockWarning(message) {
    lockToast.textContent = '\u26A0\uFE0F ' + message;
    lockToast.classList.add('show');

    // Shake the options to draw attention
    els.optContainer.classList.remove('shake');
    void els.optContainer.offsetWidth; // restart animation
    els.optContainer.classList.add('shake');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        lockToast.classList.remove('show');
    }, 2500);
}

function isLocked(subj, qIndex) {
    return !!state.locked[subj][qIndex];
}

// Locks the current question if it has an answer (used when leaving a question)
function lockCurrentIfAnswered() {
    const s = state.currentSubj;
    const q = state.progress[s];
    if (state.answers[s][q]) {
        state.locked[s][q] = true;
    }
}

// ---------------------------------------------------------------------------
// "Exam already completed" handling
// ---------------------------------------------------------------------------
function hasCompletedExam() {
    try {
        return localStorage.getItem(COMPLETED_KEY) !== null;
    } catch (e) {
        return false;
    }
}

function loadCompletedSummary() {
    try {
        const parsed = JSON.parse(localStorage.getItem(COMPLETED_KEY));
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.mistakes)) {
            return parsed;
        }
    } catch (e) { /* fall through */ }
    return null; // key exists but data is unreadable
}

// Initialization
async function initExam() {
    createLockUI();

    // If this student already submitted today's exam, never start it again.
    if (hasCompletedExam()) {
        showCompletedView(loadCompletedSummary());
        return;
    }

    loadLocalState();
    await fetchExamData();
    bindEvents();
    renderQuestion();
    startTimer();
}

// Timer Logic
function startTimer() {
    updateTimerDisplay(); // Initial draw

    timerInterval = setInterval(() => {
        if (state.remainingTime > 0) {
            state.remainingTime--;
            updateTimerDisplay();

            // Save state in the background every 5 seconds to accurately track elapsed time without explicit clicks
            if (state.remainingTime % 5 === 0) {
                saveLocalState();
            }
        } else {
            clearInterval(timerInterval);
            alert("Time is up! Your exam will now be automatically submitted.");
            calculateResults();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const hours = Math.floor(state.remainingTime / 3600);
    const minutes = Math.floor((state.remainingTime % 3600) / 60);
    const seconds = state.remainingTime % 60;

    els.timerDisplay.innerText =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Data Fetching
async function fetchExamData() {
    try {
        const response = await fetch('../json_files/current.json');
        if (!response.ok) throw new Error("JSON not found");
        examData = await response.json();
    } catch (error) {
        console.error("Failed to fetch JSON, using fallback data format.", error);
        examData = Array.from({length: 5}, (_, i) => {
            let limit = SUBJECTS[i].limit;
            let subjObj = {};
            for(let j=1; j<=limit; j++) {
                subjObj[j.toString()] = {
                    qn: `Sample ${SUBJECTS[i].name} Question ${j} with <sub>sub</sub> and <sup>sup</sup>`,
                    A: `Option A for Q${j}`, B: `Option B for Q${j}`,
                    C: `Option C for Q${j}`, D: `Option D for Q${j}`,
                    image: j % 5 === 0 ? "https://via.placeholder.com/400x150?text=Sample+Image" : "",
                    correct: ["A","B","C","D"][Math.floor(Math.random()*4)]
                };
            }
            return subjObj;
        });
    }
}

// Local Storage Management
function loadLocalState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
        const parsedState = JSON.parse(saved);

        // Safely extract existing data and fallback to defaults so we don't break old browser caches
        state.answers = parsedState.answers || state.answers;
        state.locked = parsedState.locked || state.locked;
        state.currentSubj = parsedState.currentSubj !== undefined ? parsedState.currentSubj : state.currentSubj;
        state.progress = parsedState.progress || state.progress;
        state.remainingTime = parsedState.remainingTime !== undefined ? parsedState.remainingTime : state.remainingTime;

        els.subjectSelector.value = state.currentSubj;
    }
}

function saveLocalState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// Event Binders
function bindEvents() {
    // Jump directly to any question in the current subject
    els.questionJumpSelector.addEventListener('change', (e) => {
        const selectedQuestion = parseInt(e.target.value, 10);

        if (
            selectedQuestion >= 1 &&
            selectedQuestion <= SUBJECTS[state.currentSubj].limit
        ) {
            // Leaving the question with an answer selected counts as committing it
            lockCurrentIfAnswered();

            state.progress[state.currentSubj] = selectedQuestion;
            saveLocalState();
            renderQuestion();
        }
    });

    els.subjectSelector.addEventListener('change', (e) => {
        // Leaving the question with an answer selected counts as committing it
        lockCurrentIfAnswered();

        state.currentSubj = parseInt(e.target.value);
        saveLocalState();
        renderQuestion();
    });

    els.optButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const qIndex = state.progress[state.currentSubj];

            // Already answered and committed -> block and warn
            if (isLocked(state.currentSubj, qIndex)) {
                showLockWarning("You can't answer this question again. It was already answered.");
                return;
            }

            const selectedOpt = e.currentTarget.getAttribute('data-opt');

            // UI Update
            els.optButtons.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            els.nextBtn.disabled = false;

            // Save Answer
            state.answers[state.currentSubj][qIndex] = selectedOpt;
            saveLocalState();
        });
    });

    els.nextBtn.addEventListener('click', () => {
        const currentQIndex = state.progress[state.currentSubj];

        // Commit the answer: it can no longer be changed
        if (state.answers[state.currentSubj][currentQIndex]) {
            state.locked[state.currentSubj][currentQIndex] = true;
        }

        if (currentQIndex < SUBJECTS[state.currentSubj].limit) {
            state.progress[state.currentSubj]++;
            saveLocalState();
            renderQuestion();
        } else {
            saveLocalState();
            renderQuestion(); // refresh so the last question shows as locked
            alert(`You have reached the end of the ${SUBJECTS[state.currentSubj].name} section.`);
        }
    });

    els.skipBtn.addEventListener('click', () => {
        const currentQIndex = state.progress[state.currentSubj];

        // A locked question can never be skipped/erased
        if (isLocked(state.currentSubj, currentQIndex)) {
            showLockWarning("This question is already answered and locked.");
            return;
        }

        if (currentQIndex < SUBJECTS[state.currentSubj].limit) {
            // Remove the answer if the user clicked an option but decided to skip instead
            if (state.answers[state.currentSubj][currentQIndex]) {
                delete state.answers[state.currentSubj][currentQIndex];
            }
            state.progress[state.currentSubj]++;
            saveLocalState();
            renderQuestion();
        } else {
            alert(`You have reached the end of the ${SUBJECTS[state.currentSubj].name} section.`);
        }
    });

    els.submitBtn.addEventListener('click', () => {
        let totalDone = 0;
        for (let s in state.answers) {
            totalDone += Object.keys(state.answers[s]).length;
        }
        els.modalText.innerText = `You have done ${totalDone} out of 200 questions. Are you sure you want to end the exam?`;
        els.modal.hidden = false;
    });

    els.modalNo.addEventListener('click', () => { els.modal.hidden = true; });

    els.modalYes.addEventListener('click', () => {
        els.modal.hidden = true;
        calculateResults();
    });
}

function updateQuestionJumpSelector() {
    const selector = els.questionJumpSelector;
    const subj = state.currentSubj;
    const limit = SUBJECTS[subj].limit;

    // Regenerate options only when the subject changes
    if (
        selector.dataset.subject !== String(subj) ||
        selector.options.length !== limit
    ) {
        selector.innerHTML = '';

        for (let i = 1; i <= limit; i++) {
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = `Q ${i}`;
            selector.appendChild(option);
        }

        selector.dataset.subject = String(subj);
    }

    // Keep the selector synchronized with saved progress
    selector.value = String(state.progress[subj]);
}

// Rendering Logic
function renderQuestion() {
    const subj = state.currentSubj;
    const qIndex = state.progress[subj];

    updateQuestionJumpSelector();

    const qData = examData[subj][qIndex.toString()];

    // Update Headers
    els.subjBadge.innerText = SUBJECTS[subj].name;
    els.qNum.innerText = `Question: ${qIndex} / ${SUBJECTS[subj].limit}`;

    // Hide any leftover warning from the previous question
    lockBanner.hidden = true;
    lockToast.classList.remove('show');

    if (!qData) {
        els.qText.innerHTML = "Question data unavailable.";
        els.qImage.hidden = true;
        els.optContainer.style.display = 'none';
        els.nextBtn.disabled = true;
        return;
    }

    els.optContainer.style.display = 'grid';

    // Inject Question HTML & Handle Image
    els.qText.innerHTML = qData.qn;
    if (qData.image && qData.image.trim() !== "") {
        els.qImage.src = "../json_files/" + qData.image;
        els.qImage.hidden = false;
    } else {
        els.qImage.hidden = true;
    }

    // Inject Options HTML
    document.getElementById('opt-A').innerHTML = qData.A;
    document.getElementById('opt-B').innerHTML = qData.B;
    document.getElementById('opt-C').innerHTML = qData.C;
    document.getElementById('opt-D').innerHTML = qData.D;

    // Restore previous answer if exists
    els.optButtons.forEach(b => {
        b.classList.remove('selected');
        b.classList.remove('locked');
    });

    const savedAns = state.answers[subj][qIndex];
    const locked = isLocked(subj, qIndex);

    if (savedAns) {
        document.querySelector(`.option-btn[data-opt="${savedAns}"]`).classList.add('selected');
        els.nextBtn.disabled = false;
    } else {
        els.nextBtn.disabled = true;
    }

    // Visually mark the question as locked and show the warning banner
    if (locked) {
        els.optButtons.forEach(b => b.classList.add('locked'));
        lockBanner.hidden = false;
    }

    if (qIndex >= SUBJECTS[subj].limit) {
        els.nextBtn.innerText = "End of Section";
        els.skipBtn.innerText = "End of Section";
        els.skipBtn.disabled = true;
    } else {
        els.nextBtn.innerText = "Next Question";
        els.skipBtn.innerText = "Skip Question";
        els.skipBtn.disabled = locked; // can't skip a locked question
    }
}

// Final Evaluation Logic
function calculateResults() {
    if (isSubmitting) return; // Prevent double-submit
    isSubmitting = true;

    clearInterval(timerInterval); // Halt the timer countdown
    els.modal.hidden = true; // Ensure modal is closed if triggered by timeout

    let totalScore = 0;
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    const mistakes = []; // Every wrongly answered question, kept for the review screen

    for (let subj = 0; subj < 5; subj++) {
        const subjAnswers = state.answers[subj];
        for (let qIndex in subjAnswers) {
            const qData = examData[subj] && examData[subj][qIndex];
            if (!qData) continue; // Question data missing, nothing to grade

            attempted++;
            const userAns = subjAnswers[qIndex];
            const actualAns = qData.correct;

            if (userAns === actualAns) {
                correct++;
                totalScore += 1;
            } else {
                incorrect++;
                totalScore -= 0.25; // Negative Marking Applied

                mistakes.push({
                    subject: SUBJECTS[subj].name,
                    qNum: Number(qIndex),
                    qn: qData.qn,
                    image: qData.image || "",
                    options: { A: qData.A, B: qData.B, C: qData.C, D: qData.D },
                    yourAnswer: userAns,
                    correctAnswer: actualAns
                });
            }
        }
    }

    const summary = {
        score: Math.max(0, totalScore),
        attempted,
        correct,
        incorrect,
        mistakes,
        submittedAt: new Date().toISOString()
    };

    // Mark this exam as completed for this student BEFORE anything else can fail,
    // so a refresh can never restart it. The summary is kept so the student can
    // still see the score and their mistakes after refreshing.
    try {
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(summary));
    } catch (e) {
        console.error("Could not save completion flag:", e);
        // Fall back to a bare flag if the full summary doesn't fit in storage
        try { localStorage.setItem(COMPLETED_KEY, "completed"); } catch (e2) { /* ignore */ }
    }

    // Clear the in-progress exam state
    localStorage.removeItem(STATE_KEY);

    // Show score + mistakes
    showResultView(summary, false);

    // Save results in the background
    saveExamResult(totalScore, correct, incorrect).finally(() => {
        isSubmitting = false;
    });
}

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------
function hideExamUI() {
    els.examContainer.hidden = true;
    els.subjectSelector.hidden = true;
    els.questionJumpSelector.hidden = true;
    els.submitBtn.hidden = true;
    if (els.timerDisplay) els.timerDisplay.hidden = true;
    els.modal.hidden = true;
}

// Shown when a student returns after having already submitted today's exam
function showCompletedView(summary) {
    hideExamUI();
    els.resultContainer.hidden = false;
    els.completedNote.hidden = false;

    if (summary) {
        showResultView(summary, true);
    } else {
        // Completion flag exists but the saved details are unreadable
        els.scoreBoard.hidden = true;
        els.reviewSection.hidden = true;
    }
}

function showResultView(summary, fromStorage) {
    hideExamUI();
    els.resultContainer.hidden = false;
    els.completedNote.hidden = !fromStorage;
    els.scoreBoard.hidden = false;

    document.getElementById('total-score').innerText = `${Number(summary.score).toFixed(2)} / 200`;
    document.getElementById('res-attempted').innerText = summary.attempted;
    document.getElementById('res-correct').innerText = summary.correct;
    document.getElementById('res-incorrect').innerText = summary.incorrect;

    renderReview(summary.mistakes);
}

// Builds the "Review Your Mistakes" list with the correct answers highlighted
function renderReview(mistakes) {
    els.reviewList.innerHTML = '';
    els.reviewSection.hidden = false;

    if (!mistakes || mistakes.length === 0) {
        els.reviewSubtitle.textContent = "You did not answer any question incorrectly. Great work!";
        return;
    }

    els.reviewSubtitle.textContent =
        `You answered ${mistakes.length} question${mistakes.length === 1 ? '' : 's'} incorrectly. ` +
        `Your wrong choice is marked in red and the correct answer in green.`;

    let currentSubject = null;

    mistakes.forEach(m => {
        // Subject heading whenever the subject changes
        if (m.subject !== currentSubject) {
            currentSubject = m.subject;
            const heading = document.createElement('h4');
            heading.className = 'review-subject';
            heading.textContent = currentSubject;
            els.reviewList.appendChild(heading);
        }

        const card = document.createElement('article');
        card.className = 'review-card';

        // Header
        const header = document.createElement('div');
        header.className = 'review-card-header';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = m.subject;
        const qNum = document.createElement('span');
        qNum.className = 'q-num';
        qNum.textContent = `Question ${m.qNum}`;
        header.appendChild(badge);
        header.appendChild(qNum);
        card.appendChild(header);

        // Question text (contains sub/sup HTML) and optional image
        const qText = document.createElement('div');
        qText.className = 'q-text review-q-text';
        qText.innerHTML = m.qn;
        card.appendChild(qText);

        if (m.image && String(m.image).trim() !== "") {
            const img = document.createElement('img');
            img.className = 'q-image';
            img.alt = 'Question figure';
            img.src = "../json_files/" + m.image;
            card.appendChild(img);
        }

        // Options with correct / wrong highlighting
        const opts = document.createElement('div');
        opts.className = 'review-options';

        ['A', 'B', 'C', 'D'].forEach(letter => {
            const row = document.createElement('div');
            row.className = 'review-option';

            let tagText = '';
            if (letter === m.correctAnswer) {
                row.classList.add('correct');
                tagText = 'Correct answer';
            } else if (letter === m.yourAnswer) {
                row.classList.add('wrong');
                tagText = 'Your answer';
            }

            const label = document.createElement('span');
            label.className = 'opt-label';
            label.textContent = letter;

            const text = document.createElement('span');
            text.className = 'opt-text';
            text.innerHTML = m.options[letter];

            row.appendChild(label);
            row.appendChild(text);

            if (tagText) {
                const tag = document.createElement('span');
                tag.className = 'review-tag';
                tag.textContent = tagText;
                row.appendChild(tag);
            }

            opts.appendChild(row);
        });

        card.appendChild(opts);
        els.reviewList.appendChild(card);
    });
}

// Database Save Helper using Upsert
async function saveExamResult(score, correct, wrong) {
    try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();

        if (authError) throw authError;
        if (!session) throw new Error("No active session. User is not logged in.");

        const student_id = session.user.id;
        const submitted_at = new Date().toISOString();

        const resultPayload = {
            student_id,
            exam_id,
            score,
            correct,
            wrong,
            submitted_at
        };

        const { error: upsertError } = await supabase
            .from('results')
            .upsert(resultPayload, { onConflict: 'student_id, exam_id' });

        if (upsertError) throw upsertError;

    } catch (error) {
        console.error("Failed to save exam result:", error);

        let errorEl = document.getElementById('save-error-message');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'save-error-message';
            errorEl.style.color = '#d32f2f';
            errorEl.style.backgroundColor = '#fde0e0';
            errorEl.style.padding = '12px';
            errorEl.style.marginTop = '20px';
            errorEl.style.borderRadius = '6px';
            errorEl.style.textAlign = 'center';
            errorEl.style.fontWeight = 'bold';
            els.resultContainer.appendChild(errorEl);
        }
        errorEl.innerText = `Could not save your progress to the database: ${error.message}`;
    }
}

// Boot up
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initExam);
} else {
    initExam();
}