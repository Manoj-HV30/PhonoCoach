from fastapi import FastAPI, File, UploadFile, Form
import uvicorn
import os
from fastapi.middleware.cors import CORSMiddleware
import whisper
import difflib
import pronouncing

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


model = whisper.load_model("small")

def calculate_similarity(expected: str, actual: str) -> float:
    seq = difflib.SequenceMatcher(None, expected.split(), actual.split())
    return seq.ratio()


def text_to_phonemes(text: str) -> str:
    words = text.lower().split()
    phoneme_list = []
    for word in words:
        phones = pronouncing.phones_for_word(word)
        if phones:
            phoneme_list.append(phones[0])
        else:
            phoneme_list.append("[UNK]")  # mark as unknown pronunciation
    return " ".join(phoneme_list)


def phoneme_diff(expected: str, actual: str):
    expected_list = expected.split()
    actual_list = actual.split()
    diff_result = []
    matcher = difflib.SequenceMatcher(None, expected_list, actual_list)

    for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
        if opcode == "equal":
            diff_result.extend([(p, "match") for p in expected_list[i1:i2]])
        elif opcode == "replace":
            diff_result.extend([(p, "mismatch") for p in expected_list[i1:i2]])
        elif opcode == "delete":
            diff_result.extend([(p, "missing") for p in expected_list[i1:i2]])
        elif opcode == "insert":
            diff_result.extend([(p, "extra") for p in actual_list[j1:j2]])
    return diff_result

@app.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    expected_text: str = Form(...)
):

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())


    result = model.transcribe(file_path)
    transcript = result["text"]

    expected_phonemes = text_to_phonemes(expected_text)
    actual_phonemes = text_to_phonemes(transcript)


    similarity = calculate_similarity(expected_phonemes, actual_phonemes)
    differences = phoneme_diff(expected_phonemes, actual_phonemes)

    return {
        "message": "Audio processed successfully",
        "transcript": transcript,
        "expected_text": expected_text,
        "expected_phonemes": expected_phonemes,
        "actual_phonemes": actual_phonemes,
        "similarity_score": round(similarity, 3),
        "phoneme_diff": differences
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
