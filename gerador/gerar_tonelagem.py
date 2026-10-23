"""Tonelagem: peso recebido e entregue por dia, na entrada e na saída (operação fictítransp)."""
from comum import HOJE, AGORA, MESES_ABREV, dias_do_mes, onda, rng, salvar_js

# Meta de volume fictítransp (10 níveis, em toneladas por mês)
FAIXAS = [round(10800 + 900 * i, 1) for i in range(10)]
ESCALA_MIN, ESCALA_MAX = 10000.0, 20000.0


def serie(r, dias, base_ton, base_lote, fator_hoje=1.0):
    saida = []
    for i, d in enumerate(dias):
        fator = fator_hoje if d == HOJE else 1.0
        ton_rec = onda(r, base_ton, base_ton * 0.18, i) * fator
        ton_ent = ton_rec * r.uniform(0.86, 1.04)
        saida.append({
            "data": d.strftime("%d/%m"),
            "data_iso": d.isoformat(),
            "lote_recebido": int(onda(r, base_lote, base_lote * 0.15, i) * fator),
            "lote_entregue": int(onda(r, base_lote * 0.95, base_lote * 0.15, i) * fator),
            "ton_recebida": round(ton_rec, 3),
            "ton_entregue": round(ton_ent, 3),
        })
    return saida


def indice(valor):
    return sum(1 for f in FAIXAS if valor >= f)


def fracao(valor):
    return (valor - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)


def main():
    r = rng(2026)
    meses = {}
    for mes in range(1, HOJE.month + 1):
        dias = [d for d in dias_do_mes(HOJE.year, mes) if d <= HOJE]
        atual = mes == HOJE.month
        sazonal = 1 + 0.08 * ((mes % 4) - 1.5) / 1.5
        ent = serie(r, dias, 330 * sazonal, 880, fator_hoje=0.55)
        sai = serie(r, dias, 185 * sazonal, 520, fator_hoje=0.55)

        ton_ent = sum(x["ton_recebida"] for x in ent if x["data_iso"] != HOJE.isoformat())
        ton_sai = sum(x["ton_recebida"] for x in sai if x["data_iso"] != HOJE.isoformat())
        if atual:
            total_dias = len(dias_do_mes(HOJE.year, mes))
            decorridos, restantes = len(dias), total_dias - len(dias)
            proj = lambda t: t + (t / (decorridos - 1)) * (restantes + 1)  # noqa: E731
            proj_ent, proj_sai = proj(ton_ent), proj(ton_sai)
        else:
            proj_ent, proj_sai = ton_ent, ton_sai
        total, proj_total = ton_ent + ton_sai, proj_ent + proj_sai

        meses[f"{HOJE.year}-{mes:02d}"] = {
            "mes_fechado": not atual,
            "resumo": {"armazem": [
                {"nome": "Entrada", "tonelagem": round(ton_ent, 3), "projecao": round(proj_ent, 3)},
                {"nome": "Saída", "tonelagem": round(ton_sai, 3), "projecao": round(proj_sai, 3)},
                {"nome": "Total", "tonelagem": round(total, 3), "projecao": round(proj_total, 3)},
            ]},
            "faixas": {
                "valores": FAIXAS, "escala_min": ESCALA_MIN, "escala_max": ESCALA_MAX,
                "atual_idx": indice(total), "atual_fracao": round(fracao(total), 4),
                "atual_valor": round(total, 3),
                "projetado_idx": indice(proj_total), "projetado_fracao": round(fracao(proj_total), 4),
                "projetado_valor": round(proj_total, 3),
            },
            "diario": {"ent": ent, "sai": sai},
            "label": f"{MESES_ABREV[mes - 1]}/{str(HOJE.year)[2:]}",
        }

    salvar_js("tonelagem", "__DATA__", {
        "atualizado_em": AGORA.strftime("%d/%m/%Y %H:%M:%S"),
        "mes_atual_chave": f"{HOJE.year}-{HOJE.month:02d}",
        "meses": meses,
        "pendencias": {"check_carga_aerea": False},
    })


if __name__ == "__main__":
    main()
