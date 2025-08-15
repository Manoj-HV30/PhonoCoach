chrome.storage.local.get("selectedText", (data) => {
  document.getElementById("displayText").textContent =
    data.selectedText || "No text selected";
});

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

const recordBtn = document.getElementById("recordBtn");
const status = document.getElementById("status");
const similarityScoreElem = document.getElementById("similarityScore");

async function requestMicPermission() {
  try {
    const permissionStatus = await navigator.permissions.query({
      name: "microphone",
    });
    if (permissionStatus.state === "granted") {
      return true;
    } else if (permissionStatus.state === "prompt") {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error("Permission API error:", err);
    return false;
  }
}

recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        recordBtn.disabled = true;

        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");

        const expectedText =
          document.getElementById("displayText").textContent || "";
        formData.append("expected_text", expectedText);

        status.textContent = "Uploading...";
        similarityScoreElem.textContent = "";

        try {
          const response = await fetch("http://127.0.0.1:8000/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();

            similarityScoreElem.textContent = `Pronunciation Accuracy: ${(result.similarity_score * 100).toFixed(1)}%`;

            const tipsElem = document.getElementById("pronunciationTips");
            const score = result.similarity_score;

            if (score > 0.9) {
              tipsElem.textContent =
                "Great job! Keep practicing to maintain your clear pronunciation.";
            } else if (score > 0.7) {
              tipsElem.textContent =
                "Good effort! Try slowing down and emphasizing each word.";
            } else {
              tipsElem.textContent =
                "Keep practicing! Focus on vowel sounds and word stress.";
            }

            const legendElem = document.getElementById("colorLegend");
            legendElem.innerHTML = `
                            <h4>Color Coding:</h4>
                            <ul>
                                <li style="color: green;">Green: Correct phoneme</li>
                                <li style="color: red;">Red: Incorrect phoneme</li>
                                <li style="color: orange;">Orange: Missing phoneme</li>
                                <li style="color: blue;">Blue: Extra phoneme</li>
                                <li style="color: gray;">[UNK]: Unknown/Unrecognized phoneme</li>
                            </ul>
                                <h3>Note: This extension leverages OpenAI’s Whisper ASR model for automatic speech recognition, enabling accurate transcription and pronunciation analysis.</h3>`;

            const phonemeDiffElem = document.getElementById("phonemeDiff");
            phonemeDiffElem.innerHTML = "";
            result.phoneme_diff.forEach(([phoneme, status]) => {
              const span = document.createElement("span");
              span.textContent = phoneme + " ";
              if (status === "match") span.style.color = "green";
              else if (status === "mismatch") span.style.color = "red";
              else if (status === "missing") span.style.color = "orange";
              else if (status === "extra") span.style.color = "blue";
              phonemeDiffElem.appendChild(span);
            });

            status.textContent = "✅ Uploaded successfully!";
          } else {
            status.textContent = "❌ Upload failed.";
          }
        } catch (err) {
          console.error(err);
          status.textContent = "⚠️ Error uploading.";
        } finally {
          recordBtn.disabled = false;
        }
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = "⏹ Stop";
      status.textContent = "🎙 Recording...";
      similarityScoreElem.textContent = "";
    } catch (err) {
      console.error(err);
      status.textContent = "⚠️ Microphone access denied.";
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.textContent = "🎙 Record";
  }
});
