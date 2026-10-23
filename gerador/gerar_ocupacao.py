"""Ocupação do armazém: quanto de cada área está ocupado, com histórico diário (operação fictítransp)."""
import datetime as dt

from comum import HOJE, AGORA, rng, onda, salvar_js

LIMITES = {"amarelo": 65, "laranja": 80, "vermelho": 92}
PAINEIS = [
    {"id": "ent_seca", "grupo": "Entrada", "titulo": "Estoque geral", "sem": ["Área automatizada"],
     "areas": [("Área A", 1200, .8), ("Área B", 700, 1.02), ("Reserva", 600, .93),
               ("Área C", 1500, .76), ("Área D", 300, .86), ("Área automatizada", 4000, .72)]},
    {"id": "ent_perecivel", "grupo": "Entrada", "titulo": "Estoque climatizado", "detalhar": True,
     "areas": [("Zona 1", 900, .84), ("Zona 2", 250, .35), ("Zona 3", 500, .81), ("Zona 4", 80, .25)]},
    {"id": "sai", "grupo": "Saída", "titulo": "Geral + Climatizado", "detalhar": True,
     "areas": [("Geral", 1800, .55), ("Climatizado", 150, .66)]},
]


def status(pct_arred):
    if pct_arred >= LIMITES["vermelho"]:
        return "vermelho"
    if pct_arred >= LIMITES["laranja"]:
        return "laranja"
    return "amarelo" if pct_arred >= LIMITES["amarelo"] else "verde"


def total(areas):
    c, p = sum(a["cargas"] for a in areas), sum(a["posicoes"] for a in areas)
    arred = round(c * 100 / p)
    return {"cargas": c, "posicoes": p, "pct": round(c / p, 6), "pct_arred": arred, "status": status(arred)}


def foto(r, i):
    """Retrato do armazém num dia (i = dias atrás)."""
    paineis = []
    for p in PAINEIS:
        areas = []
        for nome, pos, base in p["areas"]:
            cargas = int(pos * onda(r, base, base * .06, -i, periodo=9, ruido=.04))
            arred = round(cargas * 100 / pos)
            dias = round(r.uniform(6, 18), 1)
            areas.append({"nome": nome, "posicoes": pos, "cargas": cargas, "pct": round(cargas / pos, 6),
                          "pct_arred": arred, "status": status(arred),
                          "dias_soma": round(dias * cargas, 2), "dias_n": cargas, "dias": dias})
        sem = None
        if p.get("sem"):
            sem = total([a for a in areas if a["nome"] not in p["sem"]])
            sem.update({"rotulo": "Sem área automatizada", "excluidas": p["sem"]})
        paineis.append({"id": p["id"], "grupo": p["grupo"], "titulo": p["titulo"], "areas": areas,
                        "detalhar_areas": bool(p.get("detalhar")), "total": total(areas), "total_sem": sem,
                        "permanencia_dias": round(r.uniform(8, 15), 1),
                        "permanencia_lotes": sum(a["cargas"] for a in areas)})
    return paineis


def main():
    r = rng(3107)
    historico = []
    for i in range(29, -1, -1):
        d = HOJE - dt.timedelta(days=i)
        ps = foto(r, i)
        historico.append({"data_iso": d.isoformat(), "data": d.strftime("%d/%m/%Y"), "paineis": {
            p["id"]: {"pct": p["total"]["pct"], "cargas": p["total"]["cargas"],
                      "posicoes": p["total"]["posicoes"],
                      "pct_sem": p["total_sem"]["pct"] if p["total_sem"] else None,
                      "dias": p["permanencia_dias"],
                      "areas": {a["nome"]: {"cargas": a["cargas"], "posicoes": a["posicoes"],
                                            "pct": a["pct"], "dias": a["dias"]} for a in p["areas"]}}
            for p in ps}})
    paineis_hoje = ps

    serie = []
    for i in range(6, -1, -1):
        d = HOJE - dt.timedelta(days=i)
        f = .55 if i == 0 else 1
        serie.append({"data_iso": d.isoformat(), "data": d.strftime("%d/%m"), "hoje": i == 0,
                      "ent_recebida": int(onda(r, 330, 50, i) * f), "ent_entregue": int(onda(r, 315, 50, i) * f),
                      "sai_recebida": int(onda(r, 185, 30, i) * f), "sai_entregue": int(onda(r, 178, 30, i) * f)})

    salvar_js("ocupacao", "__DATA__", {
        "atualizado_em": AGORA.strftime("%d/%m/%Y %H:%M:%S"),
        "hoje_iso": HOJE.isoformat(),
        "inventario": {"arquivo": "inventario_ficticio.xlsx",
                       "modificado_em": AGORA.strftime("%d/%m/%Y %H:%M:%S"),
                       "linhas": sum(p["total"]["cargas"] for p in paineis_hoje),
                       "excluidas_observacao": 0, "excluidas_data_recebimento": 0},
        "ocupacao": {"paineis": paineis_hoje},
        "tonelagem": {"dias": serie, "arquivos": []},
        "historico": historico,
        "limites": LIMITES,
        "avisos": [],
    })


if __name__ == "__main__":
    main()
