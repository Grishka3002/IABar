import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "data" / "source_dialogues.json"
OUTPUT_PATH = ROOT / "data" / "bartender_unsloth.jsonl"


def main() -> None:
    samples = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    export_count = 0

    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
      for sample in samples:
        validate_sample(sample)
        handle.write(
            json.dumps(
                {
                    "id": sample["id"],
                    "messages": sample["messages"],
                },
                ensure_ascii=False,
            )
        )
        handle.write("\n")
        export_count += 1

    print(f"Exported {export_count} samples to {OUTPUT_PATH}")


def validate_sample(sample: dict) -> None:
    messages = sample.get("messages", [])
    if not messages:
        raise ValueError(f"Sample {sample.get('id')} has no messages")

    if messages[0].get("role") != "system":
        raise ValueError(f"Sample {sample.get('id')} must start with system message")

    if messages[-1].get("role") != "assistant":
        raise ValueError(f"Sample {sample.get('id')} must end with assistant message")

    assistant_questions = 0
    for message in messages:
        content = message.get("content", "").strip()
        if not content:
            raise ValueError(f"Sample {sample.get('id')} has empty content")

        if message.get("role") == "assistant" and "JSON:" not in content and "?" in content:
            assistant_questions += 1

    if assistant_questions > 3:
        raise ValueError(f"Sample {sample.get('id')} exceeds 3 clarifying questions")

    final_message = messages[-1]["content"]
    if "JSON:" not in final_message:
        raise ValueError(f"Sample {sample.get('id')} final assistant message must include JSON:")

    _, json_blob = final_message.split("JSON:", 1)
    json.loads(json_blob.strip())


if __name__ == "__main__":
    main()
