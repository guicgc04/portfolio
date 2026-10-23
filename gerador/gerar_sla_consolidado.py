"""SLA consolidado do mês: acumulado de cada indicador, tendência e projeção de meta."""
import datetime as dt

from comum import HOJE, AGORA, INDICADORES, rng, onda, salvar_json

VOLUMES = {1: 2100, 2: 1500, 3: 600, 4: 450, 5: 300, 6: 250, 7: 2600, 8: 1800, 9: 1200, 10: 900, 11: 200, 12: 700}
QUALIDADE = {1: .92, 2: .90, 3: .87, 4: .93, 5: .905, 6: .95, 7: .955, 8: .95, 9: .925, 10: .968, 11: .88, 12: .935}
SLAS = [(item, setor, nome, meta, VOLUMES[item], QUALIDADE[item]) for item, setor, nome, meta in INDICADORES]
AJUSTE_META = 0.0049


def main():
    r = rng(1812)
    dias = [HOJE.replace(day=1) + dt.timedelta(d) for d in range(HOJE.day - 1)]  # dias fechados
    chaves = [d.isoformat() for d in dias]
    total_dias_mes = 31
    restantes = total_dias_mes - HOJE.day + 1

    diario, mensal = [], []
    for item, setor, nome, meta, vol, q in SLAS:
        por_dia = {}
        for i, c in enumerate(chaves):
            total = max(1, int(onda(r, vol, vol * .1, i)))
            dentro = int(total * min(1, max(.4, q + r.uniform(-.05, .03))))
            por_dia[c] = {"dentro": dentro, "fora": total - dentro, "total": total, "pct": round(dentro / total, 4)}
        diario.append({"item": item, "setor": setor, "indicador": nome, "meta": meta, "por_dia": por_dia})

        dentro_m = sum(v["dentro"] for v in por_dia.values())
        fora_m = sum(v["fora"] for v in por_dia.values())
        total_m = dentro_m + fora_m
        ultimo = por_dia[chaves[-1]]
        pct_sem_ultimo = (dentro_m - ultimo["dentro"]) / (total_m - ultimo["total"])
        pct = round(dentro_m / total_m, 4)
        diff = pct - pct_sem_ultimo
        seta = "▼" if diff <= -0.00006 else ("▲" if diff >= 0.000006 else "-")
        reg = {"item": item, "setor": setor, "indicador": nome, "meta": meta, "dentro_mes": dentro_m,
               "fora_mes": fora_m, "total_mes": total_m, "pct_atual": pct}
        if True:
            media = total_m / len(chaves)
            restante = media * restantes
            m = meta - AJUSTE_META
            necessaria = ((total_m * m) - dentro_m) / (1 - m)
            conclusao = "Dentro" if necessaria < 0 else ("Perdido" if necessaria > restante else round(necessaria))
            reg.update({"seta": seta, "media_diaria": round(media, 2), "qtde_restante_mensal": round(restante, 2),
                        "qtde_necessaria_atual": round(necessaria, 2), "conclusao": conclusao})
        mensal.append(reg)

    ton = []
    for i, c in enumerate(chaves):
        ent = round(onda(r, 560, 80, i), 1)
        ton.append({"data": c, "ent": ent, "sai": round(onda(r, 480, 70, i), 1),
                    "perfil": "Baixo" if ent < 520 else ("Normal" if ent < 620 else "Alto")})

    extra = {m["item"]: {"total_mes_pct": m["pct_atual"], "seta": m["seta"], "conclusao": m["conclusao"]}
             for m in mensal}
    semanal = [{**s, "por_dia": {c: s["por_dia"][c] for c in chaves[-7:]}, **extra[s["item"]]} for s in diario]
    salvar_json("sla-consolidado", {
        "atualizado_em": AGORA.isoformat(),
        "mes_referencia": HOJE.strftime("%Y-%m"),
        "dias_restantes_mes": restantes,
        "total_dias_com_dado": len(chaves),
        "diario": {"dias": chaves, "slas": diario},
        "semanal": {"dias": chaves[-7:], "slas": semanal},
        "mensal": {"slas": mensal, "tonelagem": {"por_dia": ton,
                                                 "total_ent": round(sum(t["ent"] for t in ton), 1),
                                                 "total_sai": round(sum(t["sai"] for t in ton), 1)}},
    }, "dados_sla_mensal.json")


if __name__ == "__main__":
    main()
