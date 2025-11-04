from flask import Flask, jsonify
from datasets import load_dataset
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ============================================================
# ✅ 1️⃣ 데이터셋 한 번만 로드 (서버 시작 시)
# ============================================================
print("📦 Loading RefineBench dataset into memory...")
DATASET = load_dataset("RefineBench/RefineBench", split="train")
print(f"✅ Loaded {len(DATASET)} samples.")

# field 리스트 미리 정규화 (중복 제거)
FIELDS = sorted(set([
    str(x.get("field", "")).strip()
    for x in DATASET if x.get("field")
]))

# ============================================================
# ✅ 루트 안내
# ============================================================
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "RefineBench API is running ✅",
        "available_endpoints": ["/fields", "/indices/<field>", "/problem/<idx>"]
    })


# ============================================================
# ✅ 2️⃣ API: Field 목록
# ============================================================
@app.route("/fields", methods=["GET"])
def get_fields():
    return jsonify(FIELDS)


# ============================================================
# ✅ 3️⃣ API: 특정 Field 내 Index 목록
# ============================================================
@app.route("/indices/<field>", methods=["GET"])
def get_indices(field):
    # 요청 필드 전처리: `_` → `/`, 소문자 및 공백 제거
    normalized_field = str(field).replace("_", "/").strip().lower()

    indices = []
    for i, item in enumerate(DATASET):
        item_field = str(item.get("field", "")).strip().lower()
        # "/" 및 공백 제거 후 비교 (둘 다 동일한 방식으로)
        if item_field.replace(" ", "").replace("/", "_") == normalized_field.replace(" ", "").replace("/", "_"):
            indices.append(str(i))

    print(f"✅ Field '{field}' → Found {len(indices)} problems")
    return jsonify(indices)


# ============================================================
# ✅ 4️⃣ API: 문제 상세 정보
# ============================================================
@app.route("/problem/<idx>", methods=["GET"])
def get_problem(idx):
    try:
        idx = int(idx)
    except ValueError:
        return jsonify({"error": "Invalid index"}), 400

    if idx >= len(DATASET):
        return jsonify({"error": "Index out of range"}), 404

    item = DATASET[idx]
    result = {
        "index": item.get("index"),
        "field": item.get("field"),
        "subject": item.get("subject"),
        "question": item.get("question"),
        "reference_answer": item.get("reference_answer", []),
        "materials": item.get("materials", []),
        "comment": item.get("comment", []),
        "checklist": item.get("checklist", []),
        "institution": item.get("institution", ""),
        "year": item.get("year", ""),
        "month": item.get("month", ""),
        "exam_type": item.get("exam_type", ""),
        "problem_set": item.get("problem_set", ""),
        "sub_problem": item.get("sub_problem", ""),
    }
    print(f"📘 Loaded problem #{idx} (field={result['field']})")
    return jsonify(result)


# ============================================================
# ✅ 5️⃣ 서버 실행
# ============================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
