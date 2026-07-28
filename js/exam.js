import { supabase } from "/supabase/config.js";

// Manually define the exam ID for this weekly exam
const exam_id = 1;
const TOTAL_TIME_SECONDS = 3 * 60 * 60; // 3 hours (10800 seconds)

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
    currentSubj: 0,
    progress: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
    remainingTime: TOTAL_TIME_SECONDS
};

let isSubmitting = false; // Prevent double-submit

// DOM Elements
const els = {
    timerDisplay: document.getElementById('exam-timer'),
    subjectSelector: document.getElementById('subject-selector'),
    subjBadge: document.getElementById('subject-badge'),
    qNum: document.getElementById('question-number'),
    qText: document.getElementById('question-text'),
    qImage: document.getElementById('question-image'),
    optContainer: document.getElementById('options-container'),
    optButtons: document.querySelectorAll('.option-btn'),
    nextBtn: document.getElementById('next-btn'),
    submitBtn: document.getElementById('submit-exam-btn'),
    modal: document.getElementById('submit-modal'),
    modalText: document.getElementById('modal-text'),
    modalYes: document.getElementById('modal-yes'),
    modalNo: document.getElementById('modal-no'),
    examContainer: document.getElementById('exam-container'),
    resultContainer: document.getElementById('result-container')
};

// Initialization
async function initExam() {
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
    const saved = localStorage.getItem('cee_exam_state');
    if (saved) {
        const parsedState = JSON.parse(saved);
        
        // Safely extract existing data and fallback to defaults so we don't break old browser caches
        state.answers = parsedState.answers || state.answers;
        state.currentSubj = parsedState.currentSubj !== undefined ? parsedState.currentSubj : state.currentSubj;
        state.progress = parsedState.progress || state.progress;
        state.remainingTime = parsedState.remainingTime !== undefined ? parsedState.remainingTime : state.remainingTime;
        
        els.subjectSelector.value = state.currentSubj;
    }
}

function saveLocalState() {
    localStorage.setItem('cee_exam_state', JSON.stringify(state));
}

// Event Binders
function bindEvents() {
    els.subjectSelector.addEventListener('change', (e) => {
        state.currentSubj = parseInt(e.target.value);
        saveLocalState();
        renderQuestion();
    });

    els.optButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedOpt = e.currentTarget.getAttribute('data-opt');
            
            // UI Update
            els.optButtons.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            els.nextBtn.disabled = false;

            // Save Answer and Time Snapshot
            const qIndex = state.progress[state.currentSubj];
            state.answers[state.currentSubj][qIndex] = selectedOpt;
            saveLocalState();
        });
    });

    els.nextBtn.addEventListener('click', () => {
        const currentQIndex = state.progress[state.currentSubj];
        if (currentQIndex < SUBJECTS[state.currentSubj].limit) {
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

// Rendering Logic
function renderQuestion() {
    const subj = state.currentSubj;
    const qIndex = state.progress[subj];
    const qData = examData[subj][qIndex.toString()];

    // Update Headers
    els.subjBadge.innerText = SUBJECTS[subj].name;
    els.qNum.innerText = `Question: ${qIndex} / ${SUBJECTS[subj].limit}`;
    
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
        els.qImage.src = qData.image;
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
    els.optButtons.forEach(b => b.classList.remove('selected'));
    const savedAns = state.answers[subj][qIndex];
    if (savedAns) {
        document.querySelector(`.option-btn[data-opt="${savedAns}"]`).classList.add('selected');
        els.nextBtn.disabled = false;
    } else {
        els.nextBtn.disabled = true;
    }

    if (qIndex >= SUBJECTS[subj].limit) {
        els.nextBtn.innerText = "End of Section";
    } else {
        els.nextBtn.innerText = "Next Question";
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

    for (let subj = 0; subj < 5; subj++) {
        const subjAnswers = state.answers[subj];
        for (let qIndex in subjAnswers) {
            attempted++;
            const userAns = subjAnswers[qIndex];
            const actualAns = examData[subj][qIndex].correct;

            if (userAns === actualAns) {
                correct++;
                totalScore += 1;
            } else {
                incorrect++;
                totalScore -= 0.25; // Negative Marking Applied
            }
        }
    }

    // Switch Views
    els.examContainer.hidden = true;
    els.subjectSelector.hidden = true;
    els.submitBtn.hidden = true;
    if (els.timerDisplay) els.timerDisplay.hidden = true;
    els.resultContainer.hidden = false;

    // Populate Data
    document.getElementById('total-score').innerText = `${Math.max(0, totalScore).toFixed(2)} / 200`;
    document.getElementById('res-attempted').innerText = attempted;
    document.getElementById('res-correct').innerText = correct;
    document.getElementById('res-incorrect').innerText = incorrect;
    
    // Clear Local Storage upon exam submission
    localStorage.removeItem('cee_exam_state');

    // Save results in the background
    saveExamResult(totalScore, correct, incorrect).finally(() => {
        isSubmitting = false;
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