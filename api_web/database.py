"""
database.py — Todas as operações com o Supabase.
Coloque este arquivo em: api_web/database.py
"""
from supabase import create_client, Client

SUPABASE_URL = "https://ihtckkhsohmolejtqbpf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodGNra2hzb2htb2xlanRxYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzQ5MzYsImV4cCI6MjA4OTQxMDkzNn0.f_k8TdOyJ1KXofuWeNkDO6D50n9THvlgt0ZzhQnBufc"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_all_companies() -> list[dict]:
    """Retorna todas as empresas e cargos com entrevistas aprovadas."""
    result = (
        supabase.table("interviews")
        .select("company, role")
        .eq("approved", True)
        .execute()
    )
    companies: dict = {}
    for row in result.data:
        c, r = row["company"], row["role"]
        if c not in companies:
            companies[c] = set()
        companies[c].add(r)

    return [
        {"name": name, "roles": sorted(list(roles))}
        for name, roles in sorted(companies.items())
    ]


def get_interviews_by_company(company: str, role: str) -> list[dict]:
    """Retorna entrevistas aprovadas de uma empresa + cargo."""
    result = (
        supabase.table("interviews")
        .select("id, stage, difficulty, questions, submitted_by, created_at")
        .ilike("company", company)
        .ilike("role", role)
        .eq("approved", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def get_interview_full(interview_id: str) -> dict | None:
    """Retorna uma entrevista completa pelo ID."""
    result = (
        supabase.table("interviews")
        .select("*")
        .eq("id", interview_id)
        .single()
        .execute()
    )
    return result.data


def submit_interview(data: dict) -> dict:
    """Insere uma nova entrevista aprovada no banco."""
    result = supabase.table("interviews").insert(data).execute()
    return result.data


def approve_interview(interview_id: str) -> dict:
    """Marca uma entrevista como aprovada."""
    result = (
        supabase.table("interviews")
        .update({"approved": True})
        .eq("id", interview_id)
        .execute()
    )
    return result.data


def reject_interview(interview_id: str) -> dict:
    """Remove uma entrevista rejeitada."""
    result = (
        supabase.table("interviews")
        .delete()
        .eq("id", interview_id)
        .execute()
    )
    return result.data