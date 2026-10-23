"""Frotas · Financeiro: gastos de manutenção por equipamento, categoria e fornecedor.

Aqui o gerador imita o caminho real: primeiro inventa as ocorrências de
manutenção (uma linha por conserto) e depois agrega igual ao ETL faria.
"""
import datetime as dt
from collections import defaultdict

from comum import HOJE, AGORA, MESES_ABREV, rng, salvar_js

TIPOS = [  # (tipo, modelo, marca, energia, capacidade em t, valor de compra, aluguel mensal) — tudo fictício
    ("Equipamento classe A", "EA-20", "Marca A", "Tipo 1", 2.0, 190000, 5800),
    ("Equipamento classe A", "EA-40", "Marca B", "Tipo 2", 4.0, 300000, 8100),
    ("Equipamento classe B", "EB-15", "Marca C", "Tipo 3", 1.5, 160000, 4900),
    ("Equipamento classe C", "EC-80", "Marca B", "Tipo 2", 8.0, 450000, 12800),
    ("Equipamento classe D", "ED-10", "Marca D", "Tipo 3", 1.0, 42000, 1400),
    ("Equipamento classe E", "EE-25", "Marca A", "Tipo 3", 2.5, 88000, 2600),
]
FORNECEDORES = ["Fornecedor Norte", "Fornecedor Sul", "Própria"]
CATEGORIAS = [("Peças", .38), ("Pneus", .14), ("Bateria", .12), ("Mão de obra", .2),
              ("Hidráulica", .08), ("Elétrica", .05), ("Revisão", .03)]
CLASSIFICACOES = [("Corretiva", .55), ("Preventiva", .3), ("Mau uso", .15)]
DESCRICOES = {
    "Peças": ["Troca de peça desgastada", "Substituição de componente", "Reparo estrutural"],
    "Pneus": ["Pneu danificado", "Troca de par de pneus"],
    "Bateria": ["Bateria com baixa autonomia", "Troca de conector"],
    "Mão de obra": ["Diagnóstico de falha", "Ajuste geral"],
    "Hidráulica": ["Vazamento no sistema hidráulico", "Troca de mangueira"],
    "Elétrica": ["Falha no painel", "Reparo de fiação"],
    "Revisão": ["Revisão periódica A", "Revisão periódica B"],
}


def sorteio_ponderado(r, opcoes):
    return r.choices([o for o, _ in opcoes], weights=[p for _, p in opcoes])[0]


def mes_label(chave):
    ano, mes = chave.split("-")
    return f"{MESES_ABREV[int(mes) - 1]}/{ano[2:]}"


def montar_bloco(regs, totais, chave, chaves, evolucao, equip):
    gasto = sum(x["valor"] for x in regs)
    variacao = None
    idx = len(chaves) - 1 if chave == "todos" else chaves.index(chave)
    if idx > 0 and totais[chaves[idx - 1]]:
        variacao = round((totais[chaves[idx]] - totais[chaves[idx - 1]]) / totais[chaves[idx - 1]] * 100, 1)

    def soma_por(campo):
        acc = defaultdict(float)
        for x in regs:
            acc[x[campo]] += x["valor"]
        return sorted(acc.items(), key=lambda kv: -kv[1])

    por_frota = defaultdict(lambda: [0.0, 0])
    for x in regs:
        por_frota[x["frota"]][0] += x["valor"]
        por_frota[x["frota"]][1] += 1
    fornec = defaultdict(float)
    for x in regs:
        fornec[equip[x["frota"]]["fornecedora"]] += x["valor"]
    detalhe = {}
    for f in por_frota:
        cats = defaultdict(float)
        for x in regs:
            if x["frota"] == f:
                cats[x["categoria"]] += x["valor"]
        detalhe[f] = {"gasto_total": sum(cats.values()), "ocorrencias": por_frota[f][1],
                      "por_categoria": [{"categoria": k, "gasto": v} for k, v in sorted(cats.items(), key=lambda kv: -kv[1])]}
    ocorr = []
    if chave == "todos":
        ocorr = sorted(({"frota": x["frota"], "data": x["data"].strftime("%d/%m/%Y"), "data_ord": x["data"].isoformat(),
                         "categoria": x["categoria"], "classificacao": x["classificacao"],
                         "descricao": x["descricao"], "valor": x["valor"]} for x in regs),
                       key=lambda o: o["data_ord"], reverse=True)
    return {
        "geral": {"gasto_total": gasto, "ticket_medio": gasto / len(regs) if regs else 0.0,
                  "ocorrencias": len(regs), "variacao_pct": variacao, "evolucao": evolucao},
        "por_frota": [{"frota": f, "gasto": v[0], "ocorrencias": v[1]}
                      for f, v in sorted(por_frota.items(), key=lambda kv: -kv[1][0])],
        "por_categoria": [{"categoria": k, "gasto": v} for k, v in soma_por("categoria")],
        "por_classificacao": [{"classificacao": k, "gasto": v} for k, v in soma_por("classificacao")],
        "detalhe_por_frota": detalhe,
        "ocorrencias_detalhe": ocorr,
        "contratos": {"orcado": None, "realizado": gasto,
                      "fornecedores": [{"nome": k, "gasto": v} for k, v in sorted(fornec.items(), key=lambda kv: -kv[1])]},
    }


def main():
    r = rng(4410)
    equip = {}
    for n in range(1, 41):
        tipo = r.choices(TIPOS, weights=[6, 3, 8, 2, 5, 2])[0]
        forn = r.choices(FORNECEDORES, weights=[5, 3, 2])[0]
        equip[f"EQ-{n:03d}"] = {"tipo": tipo[0], "modelo": tipo[1], "marca": tipo[2], "combustao": tipo[3],
                                "cap_ton": tipo[4], "fornecedora": forn,
                                "valor": tipo[5] if forn == "Própria" or r.random() < .3 else None,
                                "valor_aluguel": tipo[6] if forn != "Própria" else None}

    regs = []
    inicio = dt.date(2026, 3, 1)
    for d in range((HOJE - inicio).days + 1):
        data = inicio + dt.timedelta(days=d)
        for _ in range(r.choices([0, 1, 2, 3], weights=[3, 4, 2, 1])[0]):
            cat = sorteio_ponderado(r, CATEGORIAS)
            regs.append({"frota": r.choice(list(equip)), "data": data, "categoria": cat,
                         "classificacao": sorteio_ponderado(r, CLASSIFICACOES),
                         "descricao": r.choice(DESCRICOES[cat]),
                         "valor": round(r.lognormvariate(7.2, .8), 2)})

    grupos = defaultdict(list)
    for x in regs:
        grupos[x["data"].strftime("%Y-%m")].append(x)
    chaves = sorted(grupos)
    totais = {c: sum(x["valor"] for x in grupos[c]) for c in chaves}
    evolucao = {"meses": [mes_label(c) for c in chaves], "meses_chave": chaves,
                "valores": [round(totais[c], 2) for c in chaves]}

    periodos_disp = [{"chave": "todos", "label": "Todo o Período"}]
    periodos = {"todos": montar_bloco(regs, totais, "todos", chaves, evolucao, equip)}
    for c in reversed(chaves):
        periodos_disp.append({"chave": c, "label": mes_label(c)})
        periodos[c] = montar_bloco(grupos[c], totais, c, chaves, evolucao, equip)

    salvar_js("frotas", "DADOS_FROTAS", {
        "atualizado_em": AGORA.strftime("%d/%m/%Y %H:%M"),
        "periodos_disponiveis": periodos_disp, "periodos": periodos, "equipamentos": equip,
    })


if __name__ == "__main__":
    main()
