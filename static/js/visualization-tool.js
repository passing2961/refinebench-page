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
    // But preserve HTML tags created by convertLatexEnvironments
    function escapeHtml(text) {
      if (typeof text !== 'string') return text;
      
      // First, protect HTML tags created by convertLatexEnvironments and list tags
      const protectedTags = [];
      let tagIndex = 0;
      // Match div tags from LaTeX environments, and ul/ol/li tags from itemize/enumerate
      const tagPattern = /<(div class="latex-env-[^"]+"[^>]*>[\s\S]*?<\/div>|<(ul|ol|li)[^>]*>[\s\S]*?<\/\2>)/g;
      
      const textWithProtectedTags = text.replace(tagPattern, (match) => {
        const placeholder = `__LATEX_ENV_TAG_${tagIndex}__`;
        protectedTags[tagIndex] = match;
        tagIndex++;
        return placeholder;
      });
      
      // Now escape HTML
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      let escaped = textWithProtectedTags.replace(/[&<>"']/g, function(m) { return map[m]; });
      
      // Restore protected HTML tags
      protectedTags.forEach((tag, index) => {
        escaped = escaped.replace(`__LATEX_ENV_TAG_${index}__`, tag);
      });
      
      return escaped;
    }

    // Convert unsupported LaTeX commands to MathJax-compatible ones
    function convertLatexCommands(text) {
      if (typeof text !== 'string') return text;
      
      // Convert \mathbbm{...} to \mathbf{...} (indicator function)
      // \mathbbm is from bbm package which MathJax doesn't support by default
      // \mathbbm{1} is commonly used for indicator function, convert to \mathbf{1}
      text = text.replace(/\\mathbbm\{([^}]+)\}/g, '\\mathbf{$1}');
      
      return text;
    }

    // Protect dollar signs in currency amounts from MathJax interpretation
    // Wraps currency amounts in a span tag with data-mathjax-ignore so MathJax ignores them
    function protectCurrency(text) {
      if (typeof text !== 'string') return text;
      // Protect $ followed by digits (currency amounts like $5, $5,000, $50,000, $5.50)
      // Pattern matches: $ followed by one or more digits, optionally with commas and decimal point
      // Examples: $5, $5,000, $50,000, $5.50, $5,000.50
      // We wrap it in a span with data-mathjax-ignore attribute so MathJax will skip it
      // Simple and comprehensive pattern: $ followed by digits, commas, and/or decimal point
      return text.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, function(match, amount) {
        return '<span class="currency" data-mathjax-ignore="true">$' + amount + '</span>';
      });
    }

    // Convert LaTeX environments to HTML to prevent MathJax "Unknown environment" errors
    // This function converts LaTeX environments to HTML before HTML escaping
    function convertLatexEnvironments(text) {
      if (typeof text !== 'string') return text;
      
      let result = text;
      
      // First, handle itemize and enumerate environments (list environments)
      // These need special handling to convert \item to <li>
      
      // Helper function to convert \item commands to <li> tags
      function convertItemsToLi(content) {
        if (!content) return '';
        // Find all \item commands (with optional arguments like \item[1])
        // Pattern matches: \item or \item[...] followed by content until next \item or end
        const itemPattern = /\\item(?:\s*\[[^\]]*\])?\s*(.*?)(?=\\item|$)/gs;
        const items = [];
        let match;
        
        // Reset regex lastIndex
        itemPattern.lastIndex = 0;
        
        while ((match = itemPattern.exec(content)) !== null) {
          const itemContent = match[1];
          if (itemContent && itemContent.trim()) {
            items.push(itemContent.trim());
          }
        }
        
        // If regex didn't match (fallback), try simple split
        if (items.length === 0) {
          const parts = content.split(/\\item/);
          const filtered = parts.filter(part => part.trim());
          filtered.forEach(part => {
            const trimmed = part.trim();
            if (trimmed) items.push(trimmed);
          });
        }
        
        return items.map(item => `<li>${item}</li>`).join('\n');
      }
      
      // Convert itemize to <ul>
      result = result.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, function(match, content) {
        const listItems = convertItemsToLi(content);
        return `<ul style="margin: 0.5em 0; padding-left: 1.5em;">${listItems}</ul>`;
      });
      
      // Convert enumerate to <ol>
      result = result.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, function(match, content) {
        const listItems = convertItemsToLi(content);
        return `<ol style="margin: 0.5em 0; padding-left: 1.5em;">${listItems}</ol>`;
      });
      
      // List of other LaTeX environments that MathJax doesn't recognize
      const environments = ['definition', 'problem', 'theorem', 'lemma', 'proposition', 'corollary', 'example', 'remark', 'proof'];
      
      // Convert each environment to HTML
      environments.forEach(env => {
        // Match \begin{env}...\end{env} or \begin{env}[label]...\end{env}
        // Use a more robust pattern that captures the entire environment content
        const envPattern = new RegExp(`\\\\begin\\{${env}\\}(?:\\[([^\\]]+)\\])?([\\s\\S]*?)\\\\end\\{${env}\\}`, 'g');
        
        result = result.replace(envPattern, function(match, label, content) {
          const labelText = label ? ` <strong>${label}</strong>` : '';
          // Content will be escaped later by escapeHtml function
          return `<div class="latex-env-${env}" style="margin: 1em 0; padding: 0.5em; border-left: 3px solid #ED8537; background: #fff5ed;"><strong style="color: #ED8537;">${env.charAt(0).toUpperCase() + env.slice(1)}${labelText}:</strong><br>${content}</div>`;
        });
      });
      
      return result;
    }

    // Convert markdown to HTML (for materials field with tables)
    function markdownToHtml(text) {
      if (typeof text !== 'string') return text;
      
      // Check if markdown-it is available (try both window.markdownit and markdownit)
      const MarkdownIt = window.markdownit || (typeof markdownit !== 'undefined' ? markdownit : null);
      if (!MarkdownIt) {
        // Fallback: just escape HTML if markdown-it is not loaded
        return escapeHtml(text);
      }
      
      // Preserve <Material1>, <Material2> etc. tags by temporarily replacing them
      const tagPattern = /<Material\d+[^>]*>/gi;
      const tags = [];
      let tagIndex = 0;
      
      // Replace tags with placeholders
      const textWithPlaceholders = text.replace(tagPattern, (match) => {
        const placeholder = `__MATERIAL_TAG_${tagIndex}__`;
        tags[tagIndex] = match;
        tagIndex++;
        return placeholder;
      });
      
      // Initialize markdown-it (can be called as function or constructor)
      let mdRenderer;
      try {
        mdRenderer = MarkdownIt({
          html: true,
          breaks: true,
          linkify: true
        });
      } catch (e) {
        // Fallback: try as constructor
        mdRenderer = new MarkdownIt({
          html: true,
          breaks: true,
          linkify: true
        });
      }
      
      // Convert markdown to HTML
      let html = mdRenderer.render(textWithPlaceholders);
      
      // Restore the original tags (but escape them for HTML)
      tags.forEach((tag, index) => {
        html = html.replace(`__MATERIAL_TAG_${index}__`, escapeHtml(tag));
      });
      
      return html;
    }

    // Helper function to protect currency in element before MathJax processing
    function protectCurrencyInElement(element) {
      if (!element) return;
      const currencySpans = element.querySelectorAll('.currency');
      currencySpans.forEach(span => {
        // Replace $ with a placeholder that MathJax won't interpret
        const originalText = span.textContent;
        span.setAttribute('data-original', originalText);
        span.textContent = originalText.replace(/\$/g, 'DOLLAR_SIGN_PLACEHOLDER');
      });
    }

    // Helper function to restore currency in element after MathJax processing
    function restoreCurrencyInElement(element) {
      if (!element) return;
      const currencySpans = element.querySelectorAll('.currency[data-original]');
      currencySpans.forEach(span => {
        const original = span.getAttribute('data-original');
        span.textContent = original;
        span.removeAttribute('data-original');
      });
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
      
      // Protect currency amounts before MathJax processing
      elementsToRender.forEach(el => protectCurrencyInElement(el));
      
      // Try to render MathJax if available (but don't block if it's not loaded yet)
      if(window.MathJax && MathJax.typesetPromise){
        console.log('Typesetting with MathJax...');
        MathJax.typesetPromise(elementsToRender).then(() => {
          console.log('MathJax rendering completed');
          // Restore currency amounts after MathJax processing
          elementsToRender.forEach(el => restoreCurrencyInElement(el));
        }).catch(err => {
          console.error('MathJax error:', err);
          // Restore currency amounts even on error
          elementsToRender.forEach(el => restoreCurrencyInElement(el));
        });
      } else {
        // MathJax might not be loaded yet, but that's okay - content will still display
        console.log('MathJax not available yet, will retry when content is updated');
        // Retry after a short delay
        setTimeout(() => {
          if(window.MathJax && MathJax.typesetPromise){
            MathJax.typesetPromise(elementsToRender).then(() => {
              console.log('MathJax rendering completed on retry');
              // Restore currency amounts after MathJax processing
              elementsToRender.forEach(el => restoreCurrencyInElement(el));
            }).catch(err => {
              console.error('MathJax error on retry:', err);
              // Restore currency amounts even on error
              elementsToRender.forEach(el => restoreCurrencyInElement(el));
            });
          } else {
            // If MathJax never loads, restore currency amounts
            elementsToRender.forEach(el => restoreCurrencyInElement(el));
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
      
      // Format content - convert LaTeX commands first, then environments, then escape HTML, then protect currency
      // Order: LaTeX commands -> LaTeX env conversion -> HTML escape -> Currency protection
      const questionText = protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(problem.question || ''))));
      const answerText = Array.isArray(problem.reference_answer) 
        ? problem.reference_answer.map(a => protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(a))))).join('<br><br>') 
        : protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(problem.reference_answer || ''))));
      // Materials field: convert markdown to HTML (for tables) but preserve <Material> tags
      // Note: LaTeX commands and env conversion should be before markdown conversion to avoid conflicts
      const materialsText = Array.isArray(problem.materials) 
        ? problem.materials.map(m => protectCurrency(markdownToHtml(convertLatexEnvironments(convertLatexCommands(m))))).join('<br><br>') 
        : protectCurrency(markdownToHtml(convertLatexEnvironments(convertLatexCommands(problem.materials || ''))));
      const commentText = Array.isArray(problem.comment) 
        ? problem.comment.map(c => protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(c))))).join('<br><br>') 
        : protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(problem.comment || ''))));
      // Escape HTML in passages to preserve < > [ ] characters
      const passagesText = Array.isArray(problem.passages) 
        ? problem.passages.map(p => protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(p))))).join('<br><br><hr style="margin: 1rem 0; border: none; border-top: 1px solid #ddd;"><br>') 
        : protectCurrency(escapeHtml(convertLatexEnvironments(convertLatexCommands(problem.passages || ''))));
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