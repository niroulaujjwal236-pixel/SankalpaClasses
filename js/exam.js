// Map index to subjects exactly as described by the structure requirement
const SUBJECTS = {
    0: { name: "Physics", limit: 50 },
    1: { name: "Chemistry", limit: 50 },
    2: { name: "Zoology", limit: 40 },
    3: { name: "Botany", limit: 40 },
    4: { name: "MAT", limit: 20 }
};

let examData = []; // Will hold the parsed JSON

// State management
let state = {
    answers: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} },
    currentSubj: 0,
    progress: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 } 
};

// DOM Elements
const els = {
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
}

// Data Fetching
async function fetchExamData() {
    try {
        // Points to the JSON source within the project context
        const response = await fetch('../json_files/current.json');
        if (!response.ok) throw new Error("JSON not found");
        examData = await response.json();
    } catch (error) {
        console.error("Failed to fetch JSON, using fallback data format.", error);
        // Fallback dummy data generation to ensure the code executes if JSON is missing
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
        state = JSON.parse(saved);
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

            // Save Answer
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
    
    // Check if we ran out of data
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

    // Disable next button if it's the last question in the section
    if (qIndex >= SUBJECTS[subj].limit) {
        els.nextBtn.innerText = "End of Section";
    } else {
        els.nextBtn.innerText = "Next Question";
    }
}

// Final Evaluation Logic
function calculateResults() {
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
    els.resultContainer.hidden = false;

    // Populate Data
    document.getElementById('total-score').innerText = `${Math.max(0, totalScore).toFixed(2)} / 200`;
    document.getElementById('res-attempted').innerText = attempted;
    document.getElementById('res-correct').innerText = correct;
    document.getElementById('res-incorrect').innerText = incorrect;
    
    // Clear Local Storage upon exam submission
    localStorage.removeItem('cee_exam_state');
}

// Boot up
window.addEventListener('DOMContentLoaded', initExam);