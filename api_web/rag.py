"""
rag.py — Retrieval-Augmented Generation: busca perguntas reais do Supabase
         e injeta no prompt da IA entrevistadora.
Coloque este arquivo em: api_web/rag.py
"""
from database import supabase


def build_rag_context_text(company: str, role: str) -> str:
    """
    Busca perguntas reais da empresa no Supabase.
    Retorna uma string formatada para injetar no system prompt.
    """
    try:
        result = (
            supabase.table("interviews")
            .select("stage, difficulty, questions")
            .ilike("company", company)
            .ilike("role", role)
            .eq("approved", True)
            .limit(20)
            .execute()
        )

        if not result.data:
            print(f"DEBUG RAG: nenhum dado encontrado para {company} — {role}")
            return ""

        lines = [f"Real interview questions submitted by the community for {company} ({role}):"]
        for row in result.data:
            lines.append(f"\n[{row['stage']} stage — {row['difficulty']} difficulty]")
            for q in row["questions"]:
                lines.append(f"  • {q}")

        context = "\n".join(lines)
        print(f"DEBUG RAG: {len(result.data)} registros encontrados para {company} — {role}")
        return context

    except Exception as e:
        print(f"⚠️ RAG falhou: {e}")
        return ""


def build_interview_prompt(base_prompt: str, company: str, role: str) -> tuple[str, bool]:
    """
    Combina o prompt base com o contexto RAG da empresa.
    Retorna (system_prompt_final, has_real_data).
    """
    rag_context = build_rag_context_text(company, role) if company else ""

    if rag_context:
        system_prompt = (
            base_prompt
            + "\n\nIMPORTANT: Use the following real questions from this company's actual interview "
            "process, submitted by people who went through it. Ask them naturally, one at a time, "
            "as if you are conducting the real interview. Do NOT reveal this list to the candidate:\n\n"
            + rag_context
        )
        return system_prompt, True
    else:
        return base_prompt, False