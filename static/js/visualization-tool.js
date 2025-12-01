/* RefineBench Visualization Tool (static frontend version)
   Loads problem data from visualization_tool/data/refinebench_samples.json (served statically).
   Allows browsing problems by field and index with live MathJax preview.
*/

(function(){
  console.log('RefineBench Visualization tool script starting...');
  
  // Wait for DOM to be ready (don't wait for MathJax - we can load data without it)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM loaded, initializing visualization tool...');
      initVisualizationTool();
    });
  } else {
    console.log('DOM already loaded, initializing visualization tool...');
    initVisualizationTool();
  }
  
  function initVisualizationTool() {
    console.log('Initializing RefineBench visualization tool...');
    
    // Try multiple possible paths for the data file
    const DATA_PATHS = [
      './visualization_tool/data/refinebench_samples.json',
      './static/data/refinebench_samples.json',
      'visualization_tool/data/refinebench_samples.json',
      'static/data/refinebench_samples.json'
    ];

    const selField = document.getElementById('field-select');
    const selIndex = document.getElementById('index-select');
    const btnPrev = document.getElementById('prev-problem');
    const btnNext = document.getElementById('next-problem');
    const renderQuestion = document.getElementById('question');
    const renderAnswer = document.getElementById('reference_answer');
    const renderMaterials = document.getElementById('materials');
    const renderComment = document.getElementById('comment');
    const renderPassages = document.getElementById('passages');
    const renderChecklist = document.getElementById('checklist');
    const vizContent = document.getElementById('viz-content');
    const vizLoading = document.getElementById('viz-loading');

    // Metadata elements
    const metaField = document.getElementById('meta-field');
    const metaSubject = document.getElementById('meta-subject');
    const metaInstitution = document.getElementById('meta-institution');
    const metaYear = document.getElementById('meta-year');
    const metaExam = document.getElementById('meta-exam');

    if (!selField || !selIndex) {
      console.error('Could not find field-select or index-select elements');
      console.error('selField:', selField, 'selIndex:', selIndex);
      if (vizLoading) {
        vizLoading.innerHTML = '<p style="color:red;">Error: Required DOM elements not found. Check console.</p>';
      }
      return;
    }
    
    console.log('✅ Found all required DOM elements');

    let allData = {};
    let allFields = [];
    let currentField = null;
    let currentIndex = null;
    let currentProblem = null;

    // HTML escape function to prevent < > [ ] from being interpreted as HTML tags
    function escapeHtml(text) {
      if (typeof text !== 'string') return text;
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Render with MathJax
    function updateRender(questionText, answerText, materialsText, commentText, passagesText, checklistItems) {
      console.log('Updating render...');
      
      if (renderQuestion) renderQuestion.innerHTML = questionText || '';
      if (renderAnswer) renderAnswer.innerHTML = answerText || '';
      if (renderMaterials) renderMaterials.innerHTML = materialsText || '';
      if (renderComment) renderComment.innerHTML = commentText || '';
      if (renderPassages) renderPassages.innerHTML = passagesText || '';
      
      // Update checklist
      if (renderChecklist) {
        const checklistContainer = document.getElementById('checklist');
        if (checklistContainer) {
          checklistContainer.innerHTML = '';
          (checklistItems || []).forEach((item) => {
            const li = document.createElement('li');
            li.style.cssText = 'padding:8px 12px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px;';
            li.innerHTML = `<span style="color:#ED8537;">✔️</span> <span>${escapeHtml(item)}</span>`;
            checklistContainer.appendChild(li);
          });
        }
      }
      
      const elementsToRender = [];
      if (renderQuestion) elementsToRender.push(renderQuestion);
      if (renderAnswer) elementsToRender.push(renderAnswer);
      if (renderMaterials) elementsToRender.push(renderMaterials);
      if (renderComment) elementsToRender.push(renderComment);
      if (renderPassages) elementsToRender.push(renderPassages);
      
      // Try to render MathJax if available (but don't block if it's not loaded yet)
      if(window.MathJax && MathJax.typesetPromise){
        console.log('Typesetting with MathJax...');
        MathJax.typesetPromise(elementsToRender).catch(err => {
          console.error('MathJax error:', err);
        });
      } else {
        // MathJax might not be loaded yet, but that's okay - content will still display
        console.log('MathJax not available yet, will retry when content is updated');
        // Retry after a short delay
        setTimeout(() => {
          if(window.MathJax && MathJax.typesetPromise){
            MathJax.typesetPromise(elementsToRender).catch(err => {
              console.error('MathJax error on retry:', err);
            });
          }
        }, 1000);
      }
    }

    // Load data file
    async function loadData(){
      console.log('Attempting to load data from multiple paths...');
      
      if (vizLoading) {
        vizLoading.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading dataset...</p>';
      }
      
      // Try loading from different paths
      let loaded = false;
      let lastError = null;
      
      for (const path of DATA_PATHS) {
        try {
          console.log(`Trying to load from: ${path}`);
          const res = await fetch(path);
          console.log(`Response status: ${res.status} for ${path}`);
          
          if (res.ok) {
            const data = await res.json();
            allData = data;
            allFields = Object.keys(allData).sort();
            console.log(`✅ Successfully loaded ${allFields.length} fields from ${path}`);
            console.log(`Fields: ${allFields.slice(0, 5).join(', ')}${allFields.length > 5 ? '...' : ''}`);
            loaded = true;
            break;
          } else {
            const errorText = `HTTP ${res.status}`;
            console.log(`❌ Failed to load from ${path}: ${errorText}`);
            lastError = errorText;
          }
        } catch (err) {
          console.log(`❌ Failed to load from ${path}:`, err.message);
          lastError = err.message;
          continue;
        }
      }
      
      if (!loaded) {
        const errorMsg = `Unable to load data from any of the following paths: ${DATA_PATHS.join(', ')}. Last error: ${lastError}`;
        console.error(errorMsg);
        if (selField) selField.innerHTML = '<option disabled>No data found</option>';
        if (vizLoading) {
          vizLoading.innerHTML = `<p style="color:red;">❌ Failed to load dataset.</p><p style="color:gray; font-size:0.9em;">Please check browser console (F12) for details.</p><p style="color:gray; font-size:0.8em;">Tried: ${DATA_PATHS.join(', ')}</p>`;
        }
        return;
      }
      
      console.log('Populating field select...');
      populateFieldSelect();
      
      // Auto-load first problem
      console.log('Loading default problem...');
      await loadDefaultProblem();
    }

    function populateFieldSelect() {
      if (!selField) return;
      
      selField.innerHTML = '<option value="" disabled selected>Select Field</option>';
      allFields.forEach(field => {
        const opt = document.createElement('option');
        opt.value = field;
        opt.textContent = field;
        selField.appendChild(opt);
      });
      
      console.log(`Field select populated with ${allFields.length} options`);
    }

    function populateIndexSelect(field) {
      if (!selIndex) return;
      
      console.log('Populating index select for field:', field);
      selIndex.innerHTML = '<option value="" disabled selected>Select Index</option>';
      
      if (!allData[field] || allData[field].length === 0) {
        selIndex.disabled = true;
        return;
      }

      allData[field].forEach((item, idx) => {
        const opt = document.createElement('option');
        opt.value = idx.toString();
        opt.textContent = `#${item.index || idx}`;
        selIndex.appendChild(opt);
      });
      
      selIndex.disabled = false;
      
      // Auto-select first index
      const firstIdx = 0;
      if (firstIdx !== undefined) {
        selIndex.value = firstIdx.toString();
        console.log(`Auto-selected index: ${firstIdx} for field: ${field}`);
      }
      
      console.log(`Index select populated with ${allData[field].length} options`);
    }

    // Load default problem (first field, first index)
    async function loadDefaultProblem() {
      console.log('Loading default problem');
      
      if (allFields.length > 0) {
        const firstField = allFields[0];
        selField.value = firstField;
        populateIndexSelect(firstField);
        
        const firstIdx = 0;
        if (firstIdx !== undefined) {
          selIndex.value = firstIdx.toString();
          await loadProblem(firstField, firstIdx);
        }
      } else {
        console.warn('No fields found for default load');
      }
    }

    async function loadProblem(field, index){
      if(!field || index === null || index === undefined) return;
      
      console.log('Loading problem:', field, index);
      
      try{
        const fieldData = allData[field];
        if (!fieldData || !fieldData[index]) {
          throw new Error('Problem not found');
        }
        
        const problem = fieldData[index];
        console.log('Found problem:', problem);
        
        currentField = field;
        currentIndex = parseInt(index);
        currentProblem = problem;
        
        displayProblem(problem);
        updateNavigationButtons();
      }catch(err){
        console.error('Error loading problem:', err);
        alert('Error loading problem: '+err.message);
      }
    }

    function displayProblem(problem){
      console.log('Displaying problem:', problem);
      
      if (vizContent) vizContent.style.display = 'block';
      if (vizLoading) vizLoading.style.display = 'none';
      
      // Update metadata
      if (metaField) metaField.innerText = `Field: ${problem.field || '—'}`;
      if (metaSubject) metaSubject.innerText = `Subject: ${problem.subject || '—'}`;
      if (metaInstitution) metaInstitution.innerText = `Institution: ${problem.institution || '—'}`;
      if (metaYear) metaYear.innerText = `Year: ${problem.year || '—'}/${problem.month || '—'}`;
      if (metaExam) metaExam.innerText = `Exam: ${problem.exam_type || '—'}`;
      
      // Format content - escape HTML to preserve < > [ ] characters
      const questionText = escapeHtml(problem.question || '');
      const answerText = Array.isArray(problem.reference_answer) 
        ? problem.reference_answer.map(a => escapeHtml(a)).join('<br><br>') 
        : escapeHtml(problem.reference_answer || '');
      const materialsText = Array.isArray(problem.materials) 
        ? problem.materials.map(m => escapeHtml(m)).join('<br><br>') 
        : escapeHtml(problem.materials || '');
      const commentText = Array.isArray(problem.comment) 
        ? problem.comment.map(c => escapeHtml(c)).join('<br><br>') 
        : escapeHtml(problem.comment || '');
      // Escape HTML in passages to preserve < > [ ] characters
      const passagesText = Array.isArray(problem.passages) 
        ? problem.passages.map(p => escapeHtml(p)).join('<br><br><hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;"><br>') 
        : escapeHtml(problem.passages || '');
      const checklistItems = problem.checklist || [];
      
      updateRender(questionText, answerText, materialsText, commentText, passagesText, checklistItems);
    }

    function updateNavigationButtons(){
      if (!currentField || currentIndex === null || currentIndex === undefined) {
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        return;
      }

      const fieldProblems = allData[currentField] || [];
      const totalProblems = fieldProblems.length;
      
      if (btnPrev) btnPrev.disabled = currentIndex <= 0;
      if (btnNext) btnNext.disabled = currentIndex >= totalProblems - 1;
    }

    function navigateProblem(direction){
      if (currentField === null || currentIndex === null || currentIndex === undefined) return;
      
      const fieldProblems = allData[currentField] || [];
      let newIndex = currentIndex + direction;
      
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= fieldProblems.length) newIndex = fieldProblems.length - 1;
      
      selIndex.value = newIndex.toString();
      loadProblem(currentField, newIndex);
    }

    // Event listeners
    selField?.addEventListener('change', ()=>{
      const selectedField = selField.value;
      if (selectedField) {
        populateIndexSelect(selectedField);
        
        // Auto-load the first problem after populating indices
        const firstIdx = 0;
        if (firstIdx !== undefined) {
          loadProblem(selectedField, firstIdx);
        } else {
          // Clear the current problem display if no problems available
          if (vizContent) vizContent.style.display = 'none';
          if (vizLoading) vizLoading.style.display = 'block';
        }
      }
    });

    selIndex?.addEventListener('change', ()=>{
      const selectedField = selField.value;
      const selectedIndex = parseInt(selIndex.value);
      if (selectedField && !isNaN(selectedIndex)) {
        loadProblem(selectedField, selectedIndex);
      }
    });

    btnPrev?.addEventListener('click', ()=>{
      navigateProblem(-1);
    });

    btnNext?.addEventListener('click', ()=>{
      navigateProblem(1);
    });

    // Initialize
    console.log('Starting initialization...');
    loadData();
  }
})();