// Add this function to fetch and populate problem types
var problem_names = [];
var currProblemId = 0;
function loadProblemNames() {
    fetch('/problems')
        .then(response => response.json())
        .then(problems => {
            const select = document.getElementById('problems-select');
            select.innerHTML = ''; // Clear existing options
            
            // Sort the problems alphabetically (they're strings like "Biology_Medicine_refinebench-000000")
            problems.sort();
            problem_names = problems;
            console.log(problems);

            problems.forEach(problemId => {
                const option = document.createElement('option');
                option.value = problemId;
                option.textContent = `${problemId}`;
                select.appendChild(option);
            });

            // If there are problems, select the first one by default
            if (problems.length > 0) {
                currProblemId = 0;
                loadProblem(problem_names[currProblemId]);
            }
        })
        .catch(error => {
            console.error('Error loading problems:', error);
            alert('Error loading problems');
        });
}

// problems-select
document.getElementById('problems-select').addEventListener('change', function() {
    loadProblem(document.getElementById('problems-select').value);
});

// Call this when the page loads
document.addEventListener('DOMContentLoaded', loadProblemNames);

// Only keep problem and solution for RefineBench (no answer field)
var sections = ["problem", "solution"];
var currData = {};
var currProblemName = "";

// Add this function to generate the latex sections
function createLatexSection(title, content) {
    const displayTitles = {
        "problem": "Problem",
        "answer": "Answer",
        "solution": "Solution"
    };

    const container = document.getElementById('dynamicLatexSections');
    const sectionHtml = `
        <div class="latex-section" style="grid-column: 1 / -1;">
            <h3>${displayTitles[title] || title}</h3>
            <div style="display: flex; gap: 20px;">
                <textarea class="textbox latex-input editor" id="latexInput${title}" 
                    style="min-height: 0; height: auto; overflow-y: hidden; flex: 1;"
                    placeholder="Type text and LaTeX here... Use $$ to wrap LaTeX expressions">${content}</textarea>
                <div class="latex-render" id="latexOutput${title}" 
                    style="flex: 1; min-height: 0; border: 1px solid #ccc; padding: 8px;"></div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', sectionHtml);
    
    // Add event listeners for the new textarea
    const textarea = document.getElementById(`latexInput${title}`);
    const outputDiv = document.getElementById(`latexOutput${title}`);
    
    textarea.addEventListener('input', function() {
        // Auto-resize the textarea
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        // Match output div height
        outputDiv.style.height = this.style.height;
        // Process LaTeX
        processLatex(`latexInput${title}`, `latexOutput${title}`);
    });
    
    // Initial height adjustment
    textarea.style.height = (textarea.scrollHeight) + 'px';
    outputDiv.style.height = textarea.style.height;
    
    // Add event listener for the new textarea
    document.getElementById(`latexInput${title}`).addEventListener('input', function() {
        processLatex(`latexInput${title}`, `latexOutput${title}`);
    });
}

function createAnswerSection(answer) {
    const container = document.getElementById('dynamicLatexSections');
    const sectionHtml = `
    <div id="relationAnswerEditor" class="editor" style="display: flex; flex-direction: column; gap: 10px;">
        <h3>Answer</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <label><input type="radio" class="relation-radio" name="relation" value="(A) $\\leq$"> (A) ≤</label>
            <label><input type="radio" class="relation-radio" name="relation" value="(B) $\\geq$"> (B) ≥</label>
            <label><input type="radio" class="relation-radio" name="relation" value="(C) $=$"> (C) =</label>
            <label><input type="radio" class="relation-radio" name="relation" value="(D) $<$"> (D) &lt;</label>
            <label><input type="radio" class="relation-radio" name="relation" value="(E) $>$"> (E) &gt;</label>
            <label><input type="radio" class="relation-radio" name="relation" value="(F) None of the above"> (F) None of the above</label>
        </div>
    </div>
    `;
    container.insertAdjacentHTML('beforeend', sectionHtml);

    // select the input with the value of the answer
    for (let radio of document.querySelectorAll('.relation-radio')) {
        if (radio.value == answer)
            radio.checked = true;
    }
}


function processLatex(inputId, outputId) {
    var input = document.getElementById(inputId).value;
    if (!input || input.trim() === '') {
        document.getElementById(outputId).innerHTML = '';
        return;
    }
    
    var output = input;
    
    // Handle display math ($$...$$) first - convert to \[ \]
    output = output.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, function(match, latex) {
        return '\\[' + latex + '\\]';
    });
    
    // Protect display math blocks before processing inline math
    var protectedBlocks = [];
    var blockIndex = 0;
    output = output.replace(/\\\[[\s\S]*?\\\]/g, function(match) {
        var placeholder = '___PROTECTED_' + blockIndex + '___';
        protectedBlocks[blockIndex] = match;
        blockIndex++;
        return placeholder;
    });
    
    // Handle inline math ($...$)
    output = output.replace(/\$([^$\n]+?)\$/g, function(match, latex) {
        return '\\( ' + latex + ' \\)';
    });
    
    // Restore protected blocks
    for (var i = 0; i < protectedBlocks.length; i++) {
        output = output.replace('___PROTECTED_' + i + '___', protectedBlocks[i]);
    }
    
    // Escape HTML to prevent browser from interpreting LaTeX as HTML
    // Use a safer method: create a text node and get its HTML representation
    var textNode = document.createTextNode(output);
    var tempDiv = document.createElement('div');
    tempDiv.appendChild(textNode);
    var escapedOutput = tempDiv.innerHTML;
    
    // But we need LaTeX backslashes, so we need to unescape them
    // The textContent method escapes everything, but we need LaTeX commands
    // So let's manually escape only the problematic characters
    // Actually, let's use a different approach: escape < > & but keep LaTeX intact
    output = output
        .replace(/&(?!#?\w+;)/g, '&amp;')  // Escape & but not HTML entities
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Convert newlines to <br> for proper line breaks
    output = output.replace(/\n/g, '<br>');
    
    // Wrap in a container div with tex2jax_process class so MathJax processes it
    // Add overflow handling
    output = '<div class="latex-content tex2jax_process" style="overflow-x: auto; overflow-y: visible; word-wrap: break-word; max-width: 100%;">' + output + '</div>';
    
    // Set the HTML content
    document.getElementById(outputId).innerHTML = output;
    
    // Process with MathJax
    MathJax.typesetPromise([document.getElementById(outputId)]).then(() => {
        // Adjust MathJax elements for overflow
        const mathElements = document.getElementById(outputId).querySelectorAll('.MathJax, .MathJax_Display');
        for (let elem of mathElements) {
            elem.style.fontSize = '1.1em';
            elem.style.maxWidth = '100%';
            elem.style.overflowX = 'auto';
        }
    }).catch(function(err) {
        console.error('MathJax rendering error:', err);
    });
}

// Update the theme toggle code
document.getElementById('toggleTheme').addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
});

// // Update this part of the toggle button functionality
// document.getElementById('togglePanel').addEventListener('click', function() {
//     const rightPanel = document.querySelector('.right-panel');
//     const leftPanel = document.querySelector('.left-panel');
//     const container = document.querySelector('.container');
    
//     rightPanel.classList.toggle('collapsed');
    
//     if (rightPanel.classList.contains('collapsed')) {
//         // container.style.justifyContent = 'flex-start';
//         leftPanel.style.flexGrow = '1';
//         rightPanel.style.flexGrow = '0';
//     } else {
//         // container.style.justifyContent = 'space-between';
//         leftPanel.style.flexGrow = '1';
//         rightPanel.style.flexGrow = '0';
//     }
// });

function saveCurrentProblem() {
    // iterate through all editor class elements and get the values
    for (let editor of document.querySelectorAll('.editor')) {
        if (editor.id == "relationAnswerEditor") {
            let ans = "";
            for (let radio of document.querySelectorAll('.relation-radio')) {
                if (radio.checked) {
                    ans = radio.value;
                    break;
                }
            }
            currData["Answer"] = ans;
        } else {
            const fieldName = editor.id.replace('latexInput', '');
            const value = editor.value;
            
            // For solution field, if it contains multiple solutions, split them back into array
            if (fieldName === 'solution' && value.includes('[Solution')) {
                // Split by [Solution X] markers and clean up
                const solutions = value.split(/\[Solution \d+\]\s*/).filter(s => s.trim());
                currData[fieldName] = solutions;
            } else {
                currData[fieldName] = value;
            }
        }
    }

    // save the comments
    const selectedTags = Array.from(document.querySelectorAll('#commentTags input[type="checkbox"]:checked'))
                            .map(checkbox => checkbox.value);
    currData["comments"] = {
        tags: selectedTags,
        text: document.getElementById('commentText').value
    };
    
    // Add problem_id for RefineBench
    currData["problem_id"] = currProblemName;
    currData["index"] = currData.index || currData.data_id || '';

    return fetch('/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(currData),
    })
    .then(response => response.json())
    .then(result => {
        console.log('Save result:', result);
        alert('Problem saved successfully!');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving data');
    });
}

function loadProblem(problemName) {
    // Handle problem_id which may contain underscores
    const encodedProblemName = encodeURIComponent(problemName);
    fetch(`/problem/${encodedProblemName}`)
        .then(response => response.json())
        .then(data => {
            currData = data;
            currProblemName = problemName;
            currProblemId = problem_names.indexOf(problemName);

            console.log(data);
            // reset latex sections
            document.getElementById('dynamicLatexSections').innerHTML = '';

            // For RefineBench, always show problem and solution
            for (let sec of sections) {
                let sec_data = '';
                if (sec === 'solution') {
                    // Handle multiple solutions (RefineBench reference_answer is an array)
                    if (Array.isArray(data.solution)) {
                        sec_data = data.solution.map((sol, index) => 
                            `[Solution ${index + 1}]\n${sol}`
                        ).join('\n\n');
                    } else {
                        sec_data = data.solution || '';
                    }
                } else {
                    sec_data = data[sec] || '';
                }

                createLatexSection(sec, sec_data);
            }

            // render latex
            let latex_inputs = document.querySelectorAll('.latex-input');
            for (let latex_input of latex_inputs) {
                processLatex(latex_input.id, latex_input.id.replace('latexInput', 'latexOutput'));
            }

            // Update comment tags and text
            if (data.comments) {
                // Clear existing checkboxes
                document.querySelectorAll('#commentTags input[type="checkbox"]').forEach(cb => {
                    cb.checked = data.comments.tags.includes(cb.value);
                });
                
                // Update comment text
                document.getElementById('commentText').value = data.comments.text || '';
            }
            
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading problem');
        });
}

// next problem
document.getElementById('nextNavButton').addEventListener('click', function() {
    console.log("next button clicked");
    currProblemId = (currProblemId + 1) % problem_names.length;
    const select = document.getElementById('problems-select');
    select.value = problem_names[currProblemId];
    loadProblem(problem_names[currProblemId]);
});

// prev problem
document.getElementById('prevNavButton').addEventListener('click', function() {
    console.log("prev button clicked");
    currProblemId = (currProblemId - 1 + problem_names.length) % problem_names.length;
    const select = document.getElementById('problems-select');
    select.value = problem_names[currProblemId];
    loadProblem(problem_names[currProblemId]);
});

// save current problem
document.getElementById('saveButton').addEventListener('click', function() {
    console.log("save button clicked");
    saveCurrentProblem();
});

// save and next problem
document.getElementById('nextButton').addEventListener('click', function() {
    console.log("save and next button clicked");
    saveCurrentProblem();
    currProblemId = (currProblemId + 1) % problem_names.length;
    const select = document.getElementById('problems-select');
    select.value = problem_names[currProblemId];
    loadProblem(problem_names[currProblemId]);
});

