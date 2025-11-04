from flask import Flask, request, jsonify, render_template
import json
import os
import re
from urllib.parse import unquote

app = Flask(__name__)

# Load data once at startup
DATA_FILE = './data/refinebench_samples.json'
all_problems = []

def load_data():
    """Load and flatten RefineBench data structure"""
    global all_problems
    all_problems = []
    
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    
    # Flatten the nested structure (field -> list of problems)
    for field_name, problems in data.items():
        for problem in problems:
            # Create unique identifier: field_index
            problem_id = f"{field_name.replace('/', '_')}_{problem['index']}"
            # Map RefineBench fields to expected format
            mapped_problem = {
                'data_id': problem['index'],
                'problem': problem.get('question', ''),
                'solution': problem.get('reference_answer', []),
                'answer': '',  # RefineBench doesn't have a direct answer field
                'field': problem.get('field', ''),
                'subject': problem.get('subject', ''),
                'index': problem.get('index', ''),
                'materials': problem.get('materials', []),
                'comment': problem.get('comment', []),
                'checklist': problem.get('checklist', []),
                'institution': problem.get('institution', ''),
                'year': problem.get('year', ''),
                'month': problem.get('month', ''),
                'exam_type': problem.get('exam_type', ''),
                'problem_set': problem.get('problem_set', ''),
                'sub_problem': problem.get('sub_problem', ''),
                'filename': 'refinebench_samples'  # Single file name
            }
            # Store the problem_id for lookup
            mapped_problem['problem_id'] = problem_id
            all_problems.append(mapped_problem)
    
    print(f"✅ Loaded {len(all_problems)} problems from RefineBench")

# Load data at startup
load_data()

@app.route('/')
def index():
    return render_template('editor.html')

@app.route('/problems', methods=['GET'])
def get_problems():
    """Return list of all problem identifiers"""
    problem_keys = [p['problem_id'] for p in all_problems]
    return jsonify(problem_keys)

@app.route('/problem/<problem_id>', methods=['GET'])
def get_problem(problem_id):
    """Get a specific problem by ID"""
    # Decode URL-encoded problem_id
    problem_id = unquote(problem_id)
    
    # Find the problem by problem_id
    for problem in all_problems:
        if problem['problem_id'] == problem_id:
            # Return a copy without the problem_id field
            result = {k: v for k, v in problem.items() if k != 'problem_id'}
            return jsonify(result)
    
    return jsonify({'error': 'Problem not found'}), 404

@app.route('/save', methods=['POST'])
def save_problem():
    """Save changes to a problem"""
    data = request.json
    problem_id = data.get('problem_id') or data.get('index')
    
    if not problem_id:
        return jsonify({'error': 'No problem identifier provided'}), 400
    
    # Find the problem and update it
    found = False
    for idx, problem in enumerate(all_problems):
        if problem.get('problem_id') == problem_id or problem.get('index') == problem_id:
            # Update the problem with new data
            # Keep important fields, update editable ones
            updated_problem = all_problems[idx].copy()
            
            # Handle solution field - if it's a string, try to convert back to array if needed
            solution = data.get('solution', updated_problem.get('solution', []))
            if isinstance(solution, str) and solution.strip():
                # If it's a string with [Solution X] markers, try to split
                if '[Solution' in solution:
                    import re
                    solutions = [s.strip() for s in re.split(r'\[Solution \d+\]\s*', solution) if s.strip()]
                    solution = solutions if solutions else [solution]
                else:
                    solution = [solution]
            elif not isinstance(solution, list):
                solution = [solution] if solution else []
            
            updated_problem.update({
                'problem': data.get('problem', updated_problem.get('problem', '')),
                'solution': solution,
                'answer': data.get('answer', updated_problem.get('answer', '')),
                'comments': data.get('comments', updated_problem.get('comments', {}))
            })
            all_problems[idx] = updated_problem
            found = True
            break
    
    if not found:
        return jsonify({'error': 'Problem not found'}), 404
    
    # Save back to file
    # Reconstruct the nested structure
    saved_data = {}
    for problem in all_problems:
        field = problem.get('field', 'Unknown')
        if field not in saved_data:
            saved_data[field] = []
        
        # Convert back to original format
        original_problem = {
            'index': problem.get('index', ''),
            'field': field,
            'subject': problem.get('subject', ''),
            'question': problem.get('problem', ''),
            'reference_answer': problem.get('solution', []),
            'materials': problem.get('materials', []),
            'comment': problem.get('comment', []),
            'checklist': problem.get('checklist', []),
            'institution': problem.get('institution', ''),
            'year': problem.get('year', ''),
            'month': problem.get('month', ''),
            'exam_type': problem.get('exam_type', ''),
            'problem_set': problem.get('problem_set', ''),
            'sub_problem': problem.get('sub_problem', '')
        }
        saved_data[field].append(original_problem)
    
    # Write back to file
    with open(DATA_FILE, 'w') as f:
        json.dump(saved_data, f, indent=2)
    
    return jsonify({'message': 'Problem saved'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
