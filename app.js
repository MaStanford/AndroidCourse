// ================================================================
// MODULE LOADING
// ================================================================
let MODULES = [];

async function loadModules() {
  const mainContent = document.getElementById('main-content');
  // Hide existing views and show loading indicator without destroying them
  const welcomeView = document.getElementById('welcome-view');
  const lessonView = document.getElementById('lesson-view');
  const questionView = document.getElementById('question-view');
  if (welcomeView) welcomeView.style.display = 'none';
  if (lessonView) lessonView.style.display = 'none';
  if (questionView) questionView.style.display = 'none';
  const loader = document.createElement('div');
  loader.className = 'loading-screen';
  loader.innerHTML = '<div class="spinner"></div><p>Loading modules...</p>';
  mainContent.appendChild(loader);
  try {
    const indexResp = await fetch('modules/index.json');
    const index = await indexResp.json();
    const modulePromises = index.map(async (entry) => {
      const resp = await fetch('modules/' + entry.file);
      return resp.json();
    });
    MODULES = await Promise.all(modulePromises);
    loader.remove();
  } catch (e) {
    loader.innerHTML = '<p style="color:var(--error)">Failed to load modules. Make sure you\'re serving this via a local server:<br><code>cd android-study-guide && python3 -m http.server</code></p>';
    console.error('Module load error:', e);
    return false;
  }
  return true;
}

// ================================================================
// STATE MANAGEMENT
// ================================================================
const state = {
  currentModuleIndex: -1,
  currentQuestionIndex: 0,
  progress: {},
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  editor: null,
  editorReady: false,
  selectedOption: -1,
  blankValues: {},
  feedbackVisible: false,
  hintsShown: 0,
  answered: false,
  showingLesson: false,
  reviewMode: false,
  reviewQueue: [],
  theme: 'dark',
};

function loadState() {
  try {
    const s = localStorage.getItem('android-study-progress');
    if (s) state.progress = JSON.parse(s);
    state.apiKey = localStorage.getItem('android-study-apikey') || '';
    state.model = localStorage.getItem('android-study-model') || 'claude-sonnet-4-20250514';
    state.theme = localStorage.getItem('android-study-theme') || 'dark';
    if (state.theme === 'light') document.body.classList.add('light-theme');
    document.getElementById('theme-btn').textContent = state.theme === 'dark' ? '\u{1F319}' : '\u2600\uFE0F';
  } catch(e) { console.error('Load error:', e); }
}

function saveState() {
  try { localStorage.setItem('android-study-progress', JSON.stringify(state.progress)); } catch(e) {}
}

function getProgress(qid) { return state.progress[qid] || null; }

function updateProgress(qid, correct, hintsUsed) {
  const p = state.progress[qid] || {attempts:0,solved:false,firstCorrect:null,hintsUsed:0};
  p.attempts++;
  if (correct) p.solved = true;
  if (p.firstCorrect === null) p.firstCorrect = correct;
  p.hintsUsed = Math.max(p.hintsUsed, hintsUsed||0);
  p.lastDate = new Date().toISOString().split('T')[0];
  // Spaced repetition: set next review date
  if (correct) {
    const days = p.solved && p.firstCorrect ? 14 : 7;
    p.nextReview = addDays(new Date(), days).toISOString().split('T')[0];
  } else {
    p.nextReview = addDays(new Date(), 1).toISOString().split('T')[0];
  }
  state.progress[qid] = p;
  saveState();
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function getModuleProgress(modId) { const m=MODULES.find(x=>x.id===modId); if(!m) return 0; const s=m.questions.filter(q=>state.progress[q.id]?.solved).length; return Math.round((s/m.questions.length)*100); }
function getOverallProgress() { const t=MODULES.reduce((s,m)=>s+m.questions.length,0); const d=MODULES.reduce((s,m)=>s+m.questions.filter(q=>state.progress[q.id]?.solved).length,0); return t>0?Math.round((d/t)*100):0; }
function getTotalQuestions() { return MODULES.reduce((s,m)=>s+m.questions.length,0); }
function getCompletedCount() { return Object.values(state.progress).filter(p=>p.solved).length; }
function getStreak() {
  let streak=0; const today=new Date(); today.setHours(0,0,0,0);
  for(let i=0;i<365;i++){const d=addDays(today,-i).toISOString().split('T')[0]; const any=Object.values(state.progress).some(p=>p.lastDate===d); if(any)streak++; else break;}
  return streak;
}
function getWeakAreas() { const w=[]; MODULES.forEach(m=>{const qs=m.questions.filter(q=>state.progress[q.id]); if(!qs.length)return; const c=qs.filter(q=>state.progress[q.id]?.firstCorrect).length; if(c/qs.length<0.6)w.push(m.title);}); return w; }
function getReviewDue() {
  const today = new Date().toISOString().split('T')[0];
  const due = [];
  MODULES.forEach(m => m.questions.forEach(q => {
    const p = state.progress[q.id];
    if (p && p.nextReview && p.nextReview <= today && !p.solved) due.push({module:m, question:q});
    if (p && !p.solved && p.attempts > 0) due.push({module:m, question:q});
  }));
  // Deduplicate
  const seen = new Set(); return due.filter(d => { if(seen.has(d.question.id)) return false; seen.add(d.question.id); return true; });
}

// ================================================================
// MONACO EDITOR
// ================================================================
function initMonaco() {
  require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'}});
  require(['vs/editor/editor.main'], function() {
    state.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
      value:'',language:'kotlin',theme:state.theme==='dark'?'vs-dark':'vs',
      minimap:{enabled:false},fontSize:14,lineNumbers:'on',scrollBeyondLastLine:false,
      automaticLayout:true,readOnly:false,padding:{top:10,bottom:10},tabSize:4,
      wordWrap:'on',renderLineHighlight:'line',folding:false
    });
    state.editorReady = true;
  });
}

// ================================================================
// SYNTAX HIGHLIGHTER
// ================================================================
function highlightKotlin(code) {
  let h = escapeHtml(code);
  // Tokenize: replace matched regions with placeholders to prevent later passes from corrupting them
  const tokens = [];
  function tok(s,cls){ const id=tokens.length; tokens.push(`<span class="${cls}">${s}</span>`); return `\x00T${id}\x00`; }
  // Pass 1: strings (must come first so keywords inside strings are not highlighted)
  h=h.replace(/(&quot;.*?&quot;)/g,(m)=>tok(m,'hl-string'));
  // Pass 2: comments
  h=h.replace(/(\/\/.*?)$/gm,(m)=>tok(m,'hl-comment'));
  // Pass 3: annotations
  h=h.replace(/(@\w+)/g,(m)=>tok(m,'hl-annotation'));
  // Pass 4: keywords
  h=h.replace(/\b(fun|val|var|class|interface|object|if|else|when|for|while|do|return|import|package|private|public|protected|internal|override|suspend|data|sealed|enum|companion|abstract|open|lateinit|lazy|by|in|is|as|try|catch|finally|throw|null|true|false|this|super|it|get|set|const|init|out|inline)\b/g,(m)=>tok(m,'hl-keyword'));
  // Pass 5: numbers
  h=h.replace(/\b(\d+\.?\d*[fFL]?)\b/g,(m)=>tok(m,'hl-number'));
  // Restore all tokens
  h=h.replace(/\x00T(\d+)\x00/g,(m,id)=>tokens[id]);
  return h;
}
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');}

// ================================================================
// RENDERING
// ================================================================
function renderSidebar() {
  const list = document.getElementById('module-list');
  list.innerHTML = MODULES.map((mod,i)=>{
    const pct=getModuleProgress(mod.id); const active=i===state.currentModuleIndex;
    return `<div class="module-item${active?' active':''}" onclick="selectModule(${i})" data-module="${mod.id}">
      <span class="module-icon">${mod.icon}</span>
      <div class="module-info"><span class="module-title">${mod.title}</span>
        <div class="module-progress-bar"><div class="module-progress-fill" style="width:${pct}%"></div></div></div>
      <span class="module-pct">${pct}%</span></div>`;
  }).join('');
  const o=getOverallProgress();
  document.getElementById('overall-progress').innerHTML=`<div class="overall-progress"><span>Overall: ${o}%</span><div class="module-progress-bar"><div class="module-progress-fill" style="width:${o}%"></div></div></div>`;
  // Review button
  const due = getReviewDue();
  const rb = document.getElementById('review-btn');
  document.getElementById('review-count').textContent = due.length;
  rb.className = 'review-btn' + (due.length > 0 ? ' visible' : '');
}

function renderWelcome() {
  document.getElementById('welcome-view').style.display='block';
  document.getElementById('question-view').style.display='none';
  document.getElementById('lesson-view').style.display='none';
  const wa=getWeakAreas(); const streak=getStreak();
  document.getElementById('welcome-view').innerHTML=`<div class="welcome">
    <h2>Android Study Guide</h2>
    <p>Master modern Android development with interactive exercises, code challenges, and AI-powered feedback.</p>
    ${streak>0?`<div class="streak-badge">\u{1F525} ${streak}-day streak</div>`:''}
    <div class="welcome-stats">
      <div class="stat-card"><span class="stat-number">${getTotalQuestions()}</span><span class="stat-label">Questions</span></div>
      <div class="stat-card"><span class="stat-number">${getCompletedCount()}</span><span class="stat-label">Completed</span></div>
      <div class="stat-card"><span class="stat-number">${MODULES.length}</span><span class="stat-label">Modules</span></div>
    </div>
    ${wa.length?`<div class="weak-areas"><h3>Areas to Review</h3><div class="weak-tags">${wa.map((w,i)=>`<span class="weak-tag" onclick="selectModule(${MODULES.findIndex(m=>m.title===w)})">${w}</span>`).join('')}</div></div>`:''}
    <p class="welcome-cta">Select a module from the sidebar to begin.</p></div>`;
}

function selectModule(index) {
  state.currentModuleIndex=index; state.currentQuestionIndex=0; state.reviewMode=false;
  state.showingLesson=true;
  renderSidebar(); renderLesson();
}

function renderLesson() {
  const mod=MODULES[state.currentModuleIndex];
  document.getElementById('welcome-view').style.display='none';
  document.getElementById('question-view').style.display='none';
  document.getElementById('lesson-view').style.display='block';
  const pct=getModuleProgress(mod.id);
  document.getElementById('lesson-view').innerHTML=`<div class="lesson-view">
    <div class="lesson-tabs">
      <div class="lesson-tab active" onclick="renderLesson()">\u{1F4D6} Lesson</div>
      <div class="lesson-tab" onclick="startQuestions()">\u270F\uFE0F Questions (${mod.questions.length})</div>
    </div>
    <div class="lesson-header"><h2>${mod.icon} ${mod.title}</h2>
      <span class="module-pct" style="font-size:14px">${pct}% complete</span></div>
    <div class="lesson-content">${mod.lesson||'<p>Lesson content coming soon.</p>'}</div>
    ${mod.references?`<div class="lesson-references"><h3>\u{1F4DA} References & Resources</h3><div class="ref-links">${mod.references.map(r=>`<a href="${r.url}" target="_blank" rel="noopener" class="ref-link"><span class="ref-type ${r.type||'docs'}">${r.type||'docs'}</span><span class="ref-link-title">${escapeHtml(r.title)}</span></a>`).join('')}</div></div>`:''}
    <button class="btn btn-primary" onclick="startQuestions()" style="margin-top:8px">Start Questions \u2192</button></div>`;
}

function startQuestions() {
  state.showingLesson=false;
  state.currentQuestionIndex=0;
  renderQuestion();
}

function goToQuestion(i) { state.currentQuestionIndex=i; renderQuestion(); }

function startReviewMode() {
  const due = getReviewDue();
  if (!due.length) return;
  state.reviewMode = true;
  state.reviewQueue = due;
  state.currentModuleIndex = MODULES.indexOf(due[0].module);
  state.currentQuestionIndex = due[0].module.questions.indexOf(due[0].question);
  renderSidebar();
  renderQuestion();
}

function renderQuestion() {
  if(state.currentModuleIndex<0)return;
  const mod=MODULES[state.currentModuleIndex];
  const q=mod.questions[state.currentQuestionIndex];
  document.getElementById('welcome-view').style.display='none';
  document.getElementById('lesson-view').style.display='none';
  document.getElementById('question-view').style.display='block';
  state.selectedOption=-1; state.blankValues={}; state.hintsShown=0; state.answered=false;
  document.getElementById('feedback-panel').style.display='none';

  // Lesson/Questions tabs
  const tabsHtml = `<div class="lesson-tabs" style="margin-bottom:16px">
    <div class="lesson-tab" onclick="renderLesson()">\u{1F4D6} Lesson</div>
    <div class="lesson-tab active" onclick="">\u270F\uFE0F Questions (${mod.questions.length})</div></div>`;

  // Nav dots
  document.getElementById('q-nav-dots').innerHTML = tabsHtml + mod.questions.map((qq,i)=>{
    const solved=state.progress[qq.id]?.solved; const active=i===state.currentQuestionIndex;
    return `<div class="q-dot${active?' active':''}${solved?' solved':''}" onclick="goToQuestion(${i})">${i+1}</div>`;
  }).join('');

  const solved=state.progress[q.id]?.solved;
  document.getElementById('question-header').innerHTML=`<div class="q-header">
    <div class="q-breadcrumb">${mod.icon} ${mod.title} \u2022 Question ${state.currentQuestionIndex+1} of ${mod.questions.length}${state.reviewMode?' \u2022 \u{1F504} Review Mode':''}</div>
    <div class="q-meta"><span class="q-difficulty ${q.difficulty}">${q.difficulty}</span><span class="q-type">${formatType(q.type)}</span>${solved?'<span class="q-solved">\u2713 Solved</span>':''}</div>
  </div><h2 class="q-title">${q.title}</h2><p class="q-description">${q.description}</p>`;

  renderQuestionBody(q); renderActionBar(q);
}

function renderQuestionBody(q) {
  const body=document.getElementById('question-body'); const ec=document.getElementById('editor-container');
  if(q.type==='fix-bug'||q.type==='optimize'||q.type==='write-code'){
    body.innerHTML=''; ec.style.display='block';
    if(state.editorReady){
      const lang=(q.starterCode||'').includes('<?xml')?'xml':'kotlin';
      monaco.editor.setModelLanguage(state.editor.getModel(),lang);
      state.editor.setValue(q.starterCode||'');
      state.editor.updateOptions({readOnly:false,theme:state.theme==='dark'?'vs-dark':'vs'});
      state.editor.focus();
    }
  } else {
    ec.style.display='none';
    switch(q.type){
      case 'multiple-choice': body.innerHTML=renderMC(q); break;
      case 'fill-blank': body.innerHTML=renderFB(q); break;
      case 'what-does-this-do': body.innerHTML=renderWDTD(q); break;
      case 'trivia': body.innerHTML=renderTrivia(q); break;
      default: body.innerHTML='';
    }
  }
}

function renderMC(q){
  let cb=q.code?`<div class="code-display"><pre>${highlightKotlin(q.code)}</pre></div>`:'';
  return cb+`<div class="mc-options">${q.options.map((o,i)=>`<div class="mc-option" data-index="${i}" onclick="selectOption(${i})">${escapeHtml(o)}</div>`).join('')}</div>`;
}
function renderFB(q){
  let ch=highlightKotlin(q.code);
  ch=ch.replace(/___(\d+)___/g,(m,n)=>`<span class="blank-slot" id="slot-${n}">[${n}]</span>`);
  const inputs=q.blanks.map((b,i)=>`<div class="blank-row"><label>Blank ${i+1}:</label><input type="text" id="blank-${i+1}" data-blank="${i+1}" oninput="updateSlot(${i+1},this.value)" placeholder="${b.hint||''}" autocomplete="off">${b.hint?`<span class="blank-hint">${b.hint}</span>`:''}</div>`).join('');
  return `<div class="code-display"><pre>${ch}</pre></div><div class="blank-inputs">${inputs}</div>`;
}
function renderWDTD(q){
  return `<div class="code-display"><pre>${highlightKotlin(q.code)}</pre></div><div class="mc-options">${q.options.map((o,i)=>`<div class="mc-option" data-index="${i}" onclick="selectOption(${i})">${escapeHtml(o)}</div>`).join('')}</div>`;
}
function renderTrivia(q){ return `<textarea class="trivia-input" id="trivia-answer" placeholder="Type your answer..."></textarea>`; }

function renderActionBar(q){
  const hasHints=q.hints&&q.hints.length>0;
  document.getElementById('action-bar').innerHTML=`
    <button class="btn btn-primary" onclick="checkAnswer()">Check Answer</button>
    ${hasHints?`<button class="btn btn-secondary" onclick="showHint()" id="btn-hint">Hint</button>`:''}
    <button class="btn btn-claude" onclick="askClaude()">Ask Claude</button>
    <button class="btn btn-secondary" onclick="showSolution()" id="btn-solution" style="display:none">Show Solution</button>
    <span class="nav-spacer"></span>
    ${state.reviewMode?`<button class="btn btn-success" onclick="nextReview()">Next Review \u2192</button>`:
    `<button class="btn btn-nav" onclick="prevQuestion()" ${state.currentQuestionIndex===0?'disabled':''}>← Prev</button>
    <button class="btn btn-nav" onclick="nextQuestion()" ${state.currentQuestionIndex>=MODULES[state.currentModuleIndex].questions.length-1?'disabled':''}>Next \u2192</button>`}`;
}

function selectOption(i){if(state.answered)return;state.selectedOption=i;document.querySelectorAll('.mc-option').forEach((e,j)=>{e.className='mc-option'+(j===i?' selected':'');});}
function updateSlot(n,v){state.blankValues[n]=v;const s=document.getElementById(`slot-${n}`);if(s){s.textContent=v||`[${n}]`;s.className=v?'blank-slot filled':'blank-slot';}}

// ================================================================
// GRADING
// ================================================================
function checkAnswer(){
  const mod=MODULES[state.currentModuleIndex],q=mod.questions[state.currentQuestionIndex];
  let result;
  switch(q.type){
    case 'multiple-choice': case 'what-does-this-do': result=checkMC(q); break;
    case 'fill-blank': result=checkFB(q); break;
    case 'fix-bug': case 'optimize': case 'write-code': result=checkCode(q); break;
    case 'trivia': result=checkTrivia(q); break;
  }
  if(!result)return;
  state.answered=true;
  if(!result.noRecord){
    updateProgress(q.id,result.correct,state.hintsShown);
    if(!result.correct){const sb=document.getElementById('btn-solution');if(sb)sb.style.display='inline-flex';}
    renderSidebar();
    // Check module completion
    const allSolved=mod.questions.every(qq=>state.progress[qq.id]?.solved);
    if(allSolved && result.correct) setTimeout(()=>launchConfetti(),300);
    document.querySelectorAll('.q-dot').forEach((dot,i)=>{if(state.progress[mod.questions[i].id]?.solved)dot.classList.add('solved');});
  }
  showFeedback(result,q);
}

function checkMC(q){
  if(state.selectedOption<0)return{correct:false,message:'Please select an answer.',noRecord:true};
  const correct=state.selectedOption===q.correctIndex;
  document.querySelectorAll('.mc-option').forEach((el,i)=>{
    el.classList.remove('selected');
    if(i===q.correctIndex)el.classList.add('reveal-correct');
    if(i===state.selectedOption&&!correct)el.classList.add('incorrect');
    if(i===state.selectedOption&&correct)el.classList.add('correct');
  });
  return{correct,message:correct?'Correct!':`Incorrect. The right answer is: ${q.options[q.correctIndex]}`,explanation:q.explanation};
}

function checkFB(q){
  let allOK=true;const details=[];
  q.blanks.forEach((blank,i)=>{
    const inp=document.getElementById(`blank-${i+1}`);const uv=(inp?.value||'').trim();
    const answers=Array.isArray(blank.answer)?blank.answer:[blank.answer];
    const ok=answers.some(a=>a.toLowerCase()===uv.toLowerCase());
    if(inp){inp.classList.remove('correct','incorrect');inp.classList.add(ok?'correct':'incorrect');}
    if(!ok)allOK=false;
    details.push({blank:i+1,correct:ok,expected:answers[0],got:uv});
  });
  const wrong=details.filter(d=>!d.correct);
  return{correct:allOK,message:allOK?'All blanks correct!':wrong.map(d=>`Blank ${d.blank}: expected "${d.expected}", got "${d.got||'(empty)'}"`).join('; '),explanation:q.explanation};
}

function checkCode(q){
  if(!state.editorReady)return null;
  const code=state.editor.getValue();const results=[];
  (q.checks||[]).forEach(c=>{const r=new RegExp(c.pattern,'i');results.push({...c,passed:r.test(code)});});
  const req=results.filter(r=>r.required!==false);
  const ok=req.length===0||req.every(r=>r.passed);
  return{correct:ok,message:ok?'All checks passed!':'Some checks failed:',checks:results,explanation:q.explanation};
}

function checkTrivia(q){
  const answer=(document.getElementById('trivia-answer')?.value||'').trim().toLowerCase();
  if(!answer)return{correct:false,message:'Please type your answer.',noRecord:true};
  const matched=(q.keywords||[]).filter(kw=>answer.includes(kw.toLowerCase()));
  const score=matched.length/(q.keywords||[1]).length;
  const correct=score>=0.3;
  let msg=score>=0.6?'Excellent!':score>=0.3?'Good start, but could mention more concepts.':'Missing key concepts. Review the explanation.';
  return{correct,message:msg,explanation:q.explanation,triviaAnswer:q.answer,score:Math.round(score*100)};
}

// ================================================================
// FEEDBACK
// ================================================================
function showFeedback(result,q){
  const p=document.getElementById('feedback-panel');p.style.display='block';
  if(result.noRecord){p.innerHTML=`<div class="feedback-header info">\u2139 ${result.message}</div>`;state.answered=false;return;}
  let h=`<div class="feedback-header ${result.correct?'success':'error'}">${result.correct?'\u2714':'\u2718'} ${result.message}</div>`;
  if(result.checks){h+='<div class="feedback-body">';result.checks.forEach(c=>{h+=`<div class="feedback-check ${c.passed?'pass':'fail'}"><span class="check-icon">${c.passed?'\u2714':'\u2718'}</span> ${c.message}</div>`;});h+='</div>';}
  if(result.triviaAnswer)h+=`<div class="feedback-body" style="margin-top:8px"><b>Model Answer:</b><br>${escapeHtml(result.triviaAnswer)}</div>`;
  if(result.explanation)h+=`<div class="feedback-body" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"><b>Explanation:</b><br>${result.explanation}</div>`;
  if(q.learnMore&&q.learnMore.length)h+=`<div class="learn-more"><b>\u{1F4D6} Learn More</b><ul>${q.learnMore.map(l=>`<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.title)}</a></li>`).join('')}</ul></div>`;
  // Show diff button for code questions
  if(q.solution && (q.type==='fix-bug'||q.type==='optimize'||q.type==='write-code')){
    h+=`<button class="btn btn-secondary" onclick="showDiff()" style="margin-top:12px">Compare with Solution</button>`;
  }
  p.innerHTML=h; p.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function showHint(){
  const q=MODULES[state.currentModuleIndex].questions[state.currentQuestionIndex];
  if(!q.hints||state.hintsShown>=q.hints.length)return;
  const hint=q.hints[state.hintsShown];state.hintsShown++;
  const p=document.getElementById('feedback-panel');p.style.display='block';
  let el=p.querySelector('.hint-list');
  if(!el){el=document.createElement('div');el.className='hint-list';p.innerHTML=`<div class="feedback-header hint">\u{1F4A1} Hints</div>`;p.appendChild(el);}
  el.innerHTML+=`<div class="feedback-body" style="margin-top:6px">Hint ${state.hintsShown}: ${hint}</div>`;
  if(state.hintsShown>=q.hints.length)document.getElementById('btn-hint')?.setAttribute('disabled','true');
}

function showSolution(){
  const q=MODULES[state.currentModuleIndex].questions[state.currentQuestionIndex];
  const p=document.getElementById('feedback-panel');
  if(q.solution)p.innerHTML+=`<div class="solution-block"><h4>Solution:</h4><pre>${highlightKotlin(q.solution)}</pre></div>`;
  else if(q.correctIndex!==undefined)p.innerHTML+=`<div class="solution-block"><h4>Answer:</h4><p>${q.options[q.correctIndex]}</p></div>`;
  else if(q.blanks){const a=q.blanks.map((b,i)=>`Blank ${i+1}: <code>${Array.isArray(b.answer)?b.answer[0]:b.answer}</code>`).join('<br>');p.innerHTML+=`<div class="solution-block"><h4>Answers:</h4><p>${a}</p></div>`;}
  document.getElementById('btn-solution').style.display='none';
}

function showDiff(){
  const q=MODULES[state.currentModuleIndex].questions[state.currentQuestionIndex];
  if(!q.solution)return;
  const userCode=state.editorReady?state.editor.getValue():'';
  const p=document.getElementById('feedback-panel');
  p.innerHTML+=`<div class="diff-view"><div class="diff-col"><h5>Your Code</h5><pre>${highlightKotlin(userCode)}</pre></div><div class="diff-col"><h5>Solution</h5><pre>${highlightKotlin(q.solution)}</pre></div></div>`;
}

// ================================================================
// CLAUDE API
// ================================================================
async function askClaude(){
  if(!state.apiKey){showSettingsModal();return;}
  const q=MODULES[state.currentModuleIndex].questions[state.currentQuestionIndex];
  const p=document.getElementById('feedback-panel');p.style.display='block';
  let userAnswer='';
  if(q.type==='fix-bug'||q.type==='optimize'||q.type==='write-code')userAnswer=state.editorReady?state.editor.getValue():'';
  else if(q.type==='fill-blank')userAnswer=Object.entries(state.blankValues).map(([k,v])=>`Blank ${k}: ${v}`).join('\n');
  else if(q.type==='trivia')userAnswer=document.getElementById('trivia-answer')?.value||'';
  else if(state.selectedOption>=0)userAnswer=`Selected: ${q.options[state.selectedOption]}`;
  else userAnswer='No answer yet';
  p.innerHTML+=`<div class="claude-loading" id="claude-loading"><div class="spinner"></div>Asking Claude...</div>`;
  const sys=`You are an expert Android development tutor reviewing a student's exercise.\nExercise: "${q.title}" (${q.type}, ${q.difficulty})\nDescription: ${q.description}\n${q.solution?'Solution involves: '+((q.checks||[]).map(c=>c.message).join(', ')||'correct patterns'):''}\n\nProvide specific, constructive feedback:\n1. What's correct\n2. Line-specific issues (for code)\n3. The underlying concept\n4. A nudge toward the solution without giving it away\n\nKeep it concise but educational. Use \`code\` for inline code.`;
  const msg=`My ${q.type==='trivia'?'answer':'code'}:\n\n${userAnswer}\n\n${q.code?'Original code:\n'+q.code:''}${q.starterCode?'Starter code:\n'+q.starterCode:''}\n\nPlease review.`;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':state.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:state.model,max_tokens:1024,system:sys,messages:[{role:'user',content:msg}]})});
    document.getElementById('claude-loading')?.remove();
    if(!r.ok){const e=await r.text();p.innerHTML+=`<div class="feedback-header error">Claude API Error (${r.status})</div><div class="feedback-body">${escapeHtml(e)}</div>`;return;}
    const data=await r.json();const text=data.content?.[0]?.text||'No response';
    const rendered=escapeHtml(text).replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
    p.innerHTML+=`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"><div class="feedback-header info">\u{1F916} Claude's Feedback</div><div class="feedback-body">${rendered}</div></div>`;
  }catch(e){document.getElementById('claude-loading')?.remove();p.innerHTML+=`<div class="feedback-header error">Network Error</div><div class="feedback-body">${escapeHtml(e.message)}</div>`;}
}

// ================================================================
// NAVIGATION
// ================================================================
function prevQuestion(){if(state.currentQuestionIndex>0){state.currentQuestionIndex--;renderQuestion();}}
function nextQuestion(){const m=MODULES[state.currentModuleIndex];if(state.currentQuestionIndex<m.questions.length-1){state.currentQuestionIndex++;renderQuestion();}}
function nextReview(){
  if(!state.reviewQueue.length){state.reviewMode=false;renderWelcome();return;}
  state.reviewQueue.shift();
  if(!state.reviewQueue.length){state.reviewMode=false;renderWelcome();return;}
  const next=state.reviewQueue[0];
  state.currentModuleIndex=MODULES.indexOf(next.module);
  state.currentQuestionIndex=next.module.questions.indexOf(next.question);
  renderSidebar(); renderQuestion();
}

// ================================================================
// THEME
// ================================================================
function toggleTheme(){
  state.theme=state.theme==='dark'?'light':'dark';
  document.body.classList.toggle('light-theme',state.theme==='light');
  document.getElementById('theme-btn').textContent=state.theme==='dark'?'\u{1F319}':'\u2600\uFE0F';
  localStorage.setItem('android-study-theme',state.theme);
  if(state.editorReady)monaco.editor.setTheme(state.theme==='dark'?'vs-dark':'vs');
}

// ================================================================
// CONFETTI
// ================================================================
function launchConfetti(){
  const canvas=document.getElementById('confetti-canvas');const ctx=canvas.getContext('2d');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  const particles=[];const colors=['#4fc3f7','#4caf50','#ff9800','#f44336','#c586c0','#dcdcaa'];
  for(let i=0;i<150;i++)particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height-canvas.height,vx:(Math.random()-0.5)*6,vy:Math.random()*3+2,color:colors[Math.floor(Math.random()*colors.length)],size:Math.random()*8+4,rotation:Math.random()*360,rotationSpeed:(Math.random()-0.5)*10});
  let frame=0;
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.rotation+=p.rotationSpeed;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore();});
    frame++;if(frame<180)requestAnimationFrame(animate);else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  animate();
}

// ================================================================
// SEARCH & FILTER
// ================================================================
function filterModules(){
  const search=(document.getElementById('search-input')?.value||'').toLowerCase();
  const diff=document.getElementById('filter-difficulty')?.value||'';
  const type=document.getElementById('filter-type')?.value||'';
  document.querySelectorAll('.module-item').forEach(el=>{
    const modId=el.dataset.module;const mod=MODULES.find(m=>m.id===modId);if(!mod)return;
    const hasMatch=mod.questions.some(q=>{
      if(search&&!q.title.toLowerCase().includes(search)&&!q.description.toLowerCase().includes(search)&&!mod.title.toLowerCase().includes(search))return false;
      if(diff&&q.difficulty!==diff)return false;
      if(type&&q.type!==type)return false;
      return true;
    });
    el.classList.toggle('hidden',!hasMatch&&(search||diff||type));
  });
}

// ================================================================
// MODALS & SETTINGS
// ================================================================
function showSettingsModal(){document.getElementById('settings-modal').style.display='flex';document.getElementById('api-key-input').value=state.apiKey;document.getElementById('model-input').value=state.model;}
function saveSettings(){state.apiKey=document.getElementById('api-key-input').value.trim();state.model=document.getElementById('model-input').value.trim()||'claude-sonnet-4-20250514';localStorage.setItem('android-study-apikey',state.apiKey);localStorage.setItem('android-study-model',state.model);closeModal('settings-modal');}
function showProgressModal(){
  document.getElementById('progress-modal').style.display='flex';
  const c=document.getElementById('progress-content');const wa=getWeakAreas();const streak=getStreak();
  let h=`<div style="margin-bottom:16px"><p style="color:var(--text-dim)">Overall: <b style="color:var(--accent)">${getOverallProgress()}%</b> complete \u2022 ${getCompletedCount()}/${getTotalQuestions()} solved ${streak?`\u2022 \u{1F525} ${streak}-day streak`:''}</p>
    ${wa.length?`<p style="margin-top:8px;color:var(--warning)">Weak areas: ${wa.join(', ')}</p>`:'<p style="margin-top:8px;color:var(--success)">No weak areas!</p>'}</div><div class="progress-grid">`;
  MODULES.forEach((mod,i)=>{
    const pct=getModuleProgress(mod.id);const solved=mod.questions.filter(q=>state.progress[q.id]?.solved).length;
    const attempted=mod.questions.filter(q=>state.progress[q.id]).length;const fc=mod.questions.filter(q=>state.progress[q.id]?.firstCorrect).length;
    const acc=attempted?Math.round((fc/attempted)*100):0;const color=pct===100?'var(--success)':pct>0?'var(--accent)':'var(--border)';
    h+=`<div class="progress-card" onclick="closeModal('progress-modal');selectModule(${i})"><h4>${mod.icon} ${mod.title}</h4><div class="pc-bar"><div class="pc-fill" style="width:${pct}%;background:${color}"></div></div><div class="pc-stats">${solved}/${mod.questions.length} solved \u2022 ${acc}% first-attempt accuracy</div></div>`;
  });
  h+='</div>';c.innerHTML=h;
}
function closeModal(id){document.getElementById(id).style.display='none';}
function resetProgress(){state.progress={};saveState();renderSidebar();if(state.currentModuleIndex>=0)renderLesson();else renderWelcome();closeModal('settings-modal');}

// ================================================================
// EXPORT / IMPORT
// ================================================================
function exportProgress(){
  const data=JSON.stringify({progress:state.progress,exportDate:new Date().toISOString(),version:2},null,2);
  const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='android-study-progress.json';a.click();URL.revokeObjectURL(url);
}
function importProgress(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{const data=JSON.parse(e.target.result);
      if(data.progress){state.progress={...state.progress,...data.progress};saveState();renderSidebar();alert('Progress imported successfully!');}
    }catch(err){alert('Invalid file format');}
  };
  reader.readAsText(file);event.target.value='';
}

// ================================================================
// MOBILE SIDEBAR
// ================================================================
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

// ================================================================
// UTILITIES & KEYBOARD
// ================================================================
function formatType(t){return{'multiple-choice':'Multiple Choice','fill-blank':'Fill Blank','fix-bug':'Fix the Bug','what-does-this-do':'What Does This Do?','optimize':'Optimize','write-code':'Write Code','trivia':'Concept'}[t]||t;}
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(state.currentModuleIndex<0||state.showingLesson)return;
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();checkAnswer();}
  else if(e.key==='ArrowRight'&&!e.ctrlKey&&!e.metaKey)nextQuestion();
  else if(e.key==='ArrowLeft'&&!e.ctrlKey&&!e.metaKey)prevQuestion();
  else if(e.key==='h'&&!e.ctrlKey&&!e.metaKey)showHint();
});
document.querySelectorAll('.modal').forEach(m=>{m.addEventListener('click',function(e){if(e.target===this)closeModal(this.id);});});

// ================================================================
// INIT
// ================================================================
async function init() {
  loadState();
  const ok = await loadModules();
  if (ok) {
    renderSidebar();
    renderWelcome();
    initMonaco();
  }
}

init();
