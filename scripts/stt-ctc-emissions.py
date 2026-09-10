"""Offline Wav2Vec2 CTC emissions for AutoShow; no model downloads or remote code."""
import json
import hashlib
import os
import sys
import wave
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"


def main():
    import numpy as np
    import torch
    from transformers import AutoModelForCTC, AutoProcessor

    model_path, manifest_path, output_path = sys.argv[1:]
    processor = AutoProcessor.from_pretrained(model_path, local_files_only=True, trust_remote_code=False)
    model = AutoModelForCTC.from_pretrained(model_path, local_files_only=True, trust_remote_code=False).eval()
    tokenizer = processor.tokenizer
    vocabulary = tokenizer.get_vocab()
    model_hashes = {}
    for path in sorted(Path(model_path).glob("*")):
        if path.suffix not in (".json", ".safetensors"):
            continue
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        model_hashes[path.name] = digest.hexdigest()
    with open(manifest_path, encoding="utf-8") as source:
        manifest = json.load(source)
    results = []
    for clip in manifest:
        with wave.open(clip["audio"], "rb") as audio:
            if audio.getnchannels() != 1 or audio.getframerate() != 16000 or audio.getsampwidth() != 2:
                raise ValueError("Expected local mono 16 kHz PCM16 WAV")
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(np.float32) / 32768
        if not 0 < len(samples) <= 16000 * 30:
            raise ValueError("Align clips of at most 30 seconds")
        word_inputs = []
        for text in clip["words"]:
            # Keep display text unchanged. Refuse unsupported letters/numbers;
            # callers must explicitly spell numbers or edit missing speech first.
            normalized = "".join(c for c in text.upper().replace("’", "'") if c.isalnum() or c == "'").strip("'")
            normalized = "".join(c if c in vocabulary else c.lower() for c in normalized)
            if not normalized or any(c not in vocabulary for c in normalized):
                raise ValueError("Word cannot be represented by the local alignment vocabulary: " + text)
            word_inputs.append({"text": text, "tokens": [vocabulary[c] for c in normalized]})
        inputs = processor(samples, sampling_rate=16000, return_tensors="pt")
        with torch.inference_mode():
            frames = model(**inputs).logits[0].log_softmax(-1).cpu().tolist()
        results.append({"words": word_inputs, "frames": frames, "blank": model.config.pad_token_id,
                        "separator": vocabulary.get(tokenizer.word_delimiter_token),
                        "frameSeconds": model.config.inputs_to_logits_ratio / 16000})
    with open(output_path, "x", encoding="utf-8") as output:
        json.dump({"schemaVersion": 1, "backend": "transformers-wav2vec2-ctc", "torchVersion": torch.__version__, "modelHashes": model_hashes, "clips": results}, output)


if __name__ == "__main__":
    main()
