"""Acompanhamento de indicadores hora a hora, por turno e tipo de operação (operação fictítransp)."""
import datetime as dt

from comum import HOJE, AGORA, INDICADORES, TIPOS_OPERACAO, TURNOS, rng, salvar_js, turno_da_hora

SLAS = {f"{item:02d}": (f"SLA {item:02d} - {nome}", round(meta * 100)) for item, _, nome, meta in INDICADORES}
TIPOS = TIPOS_OPERACAO
AREAS = [f"Área {c}{n}" for c in "ABCD" for n in (1, 2)]
# Volume médio por hora (escala do indicador)
VOLUME = {"01": 150, "07": 120, "06": 60, "11": 30, "12": 45}
COM_SUB = "07"                      # indicador com subdivisão (pedido padrão / expresso)
SEM_ENTRADA_SEPARADA = {"05", "10"}


def turno(hora):
    return turno_da_hora(hora)


def curva_hora(h):
    """Movimento ao longo do dia: pico de manhã e no fim da tarde."""
    return {0: .55, 1: .45, 2: .4, 3: .35, 4: .4, 5: .5, 6: .7, 7: .9, 8: 1.1, 9: 1.2, 10: 1.25,
            11: 1.2, 12: 1.0, 13: 1.05, 14: 1.15, 15: 1.2, 16: 1.25, 17: 1.2, 18: 1.05, 19: .95,
            20: .85, 21: .75, 22: .7, 23: .6}[h]


def gerar_sla(r, sid, ultima_hora):
    label, meta = SLAS[sid]
    vol = VOLUME.get(sid, r.randint(6, 30))
    qualidade = min(0.995, max(0.7, meta / 100 + r.uniform(-0.06, 0.03)))
    linhas, entrada, origem_t = [], [], {}
    for h in range(ultima_hora + 1):
        for tipo in TIPOS:
            peso = {"Mecanizado": .5, "Manual": .3, "Automatizado": .2}[tipo]
            total = int(vol * curva_hora(h) * peso * r.uniform(.6, 1.4))
            if total == 0:
                continue
            q = min(1, qualidade + r.uniform(-.08, .05))
            dentro = int(round(total * q))
            l = {"hora": h, "turno": turno(h), "tipo": tipo, "dentro": dentro, "fora": total - dentro}
            if sid == COM_SUB:
                l["sub"] = r.choice(["padrao", "expresso"])
            if sid in SEM_ENTRADA_SEPARADA:
                l["entrada"] = total
            else:
                entrada.append({"hora": h, "turno": turno(h), "tipo": tipo,
                                "entrada": int(total * r.uniform(.9, 1.2))})
            linhas.append(l)
    for t in TURNOS:
        dentro_t = sum(l["dentro"] for l in linhas if l["turno"] == t)
        fora_t = sum(l["fora"] for l in linhas if l["turno"] == t)
        pesos = [r.random() for _ in AREAS]
        s = sum(pesos)
        origem_t[t] = {
            "destinos": AREAS,
            "dentro": [int(dentro_t * p / s) for p in pesos],
            "fora": [int(fora_t * p / s) for p in pesos],
        }
    origem = {"destinos": AREAS,
              "dentro": [sum(origem_t[t]["dentro"][i] for t in origem_t) for i in range(len(AREAS))],
              "fora": [sum(origem_t[t]["fora"][i] for t in origem_t) for i in range(len(AREAS))]}
    return {"label": label, "meta_pct": meta, "tem_sub": sid == COM_SUB, "linhas": linhas,
            "origem": origem, "origem_turnos": origem_t,
            "entrada_linhas": [] if sid in SEM_ENTRADA_SEPARADA else entrada}


def main():
    r = rng(1802)
    dias = {}
    for i in range(5):
        d = HOJE - dt.timedelta(days=i)
        ultima = AGORA.hour if i == 0 else 23
        dias[d.isoformat()] = {"data": d.strftime("%d/%m/%Y"), "offset": i,
                               "slas": {sid: gerar_sla(r, sid, ultima) for sid in SLAS}}
    mensal = {}
    for sid, (_, meta) in SLAS.items():
        vol = VOLUME.get(sid, 18) * 24 * (HOJE.day - 1)
        dentro = int(vol * min(.995, meta / 100 + r.uniform(-.05, .02)))
        mensal[sid] = {"dentro_hist": dentro, "fora_hist": vol - dentro,
                       "dias_restantes": 31 - HOJE.day,
                       "pct_necessaria": round(meta + r.uniform(-4, 6), 1)}
    salvar_js("hora-a-hora", "DADOS_HH", {
        "atualizado_em": AGORA.strftime("%d/%m/%Y %H:%M"),
        "opcoes_tipo": TIPOS, "dias": dias, "mensal": mensal,
    })


if __name__ == "__main__":
    main()
