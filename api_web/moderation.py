"""
moderation.py — Moderação automática de submissões usando o DeepSeek local.
Coloque este arquivo em: api_web/moderation.py
"""
import re
import json
import ollama

MODERATION_MODEL = "deepseek-r1:7b"

MODERATION_PROMPT = """You are a content moderator for a professional interview question database.
Analyze the following interview submission and respond ONLY with a JSON object.
No markdown, no explanation, no extra text — just the raw JSON.

{{
  "approved": true or false,
  "reason": "brief reason if rejected, empty string if approved",
  "cleaned_questions": ["list of cleaned, well-formatted questions"]
}}

Approve if:
- Questions are relevant to job interviews for the given role
- Content is professional and respectful
- Questions make sense for the given company and stage

Reject if:
- Questions are offensive, spam, or completely irrelevant
- Content is not related to job interviews
- Questions are nonsensical or too short (less than 5 words)

Submission:
Company: {company}
Role: {role}
Stage: {stage}
Questions:
{questions}
"""


def moderate_submission(company: str, role: str, stage: str, questions: list[str]) -> dict:
    prompt = MODERATION_PROMPT.format(
        company=company,
        role=role,
        stage=stage,
        questions="\n".join(f"- {q}" for q in questions),
    )

    try:
        response = ollama.chat(
            model=MODERATION_MODEL,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.message.content
        print(f"DEBUG moderação raw: {raw}")  # <-- veja o que está saindo

        # Remove tags <think> do DeepSeek
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()

        # Extrai só o bloco JSON — pega o primeiro { ... } encontrado
        match = re.search(r'\{.*\}', raw, flags=re.DOTALL)
        if not match:
            print("⚠️ Nenhum JSON encontrado, aprovando.")
            return {"approved": True, "reason": "", "cleaned_questions": questions}

        json_str = match.group(0)
        result = json.loads(json_str)
        print(f"DEBUG moderação: approved={result.get('approved')}, reason={result.get('reason')}")
        return result

    except json.JSONDecodeError as e:
        print(f"⚠️ JSON inválido: {e}. Aprovando.")
        return {"approved": True, "reason": "", "cleaned_questions": questions}

    except Exception as e:
        print(f"⚠️ Erro inesperado: {e}. Aprovando.")
        return {"approved": True, "reason": "", "cleaned_questions": questions}