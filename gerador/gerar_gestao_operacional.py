"""Gestão Operacional: ranking gamificado das lideranças em pilares de Processos, Pessoas e Segurança.

Pessoas, pontos e pendências são todos inventados. As fotos viram avatares com iniciais.
"""
import datetime as dt
import os

from comum import DEMOS, HOJE, AGORA, INDICADORES, MESES_PT, TURNOS, nomes_ficticios, rng, salvar_js

AREAS = [
    {"id": "processos", "nome": "Processos", "cor": "#8a3b45", "pontos_max": 50},
    {"id": "pessoas", "nome": "Pessoas", "cor": "#3b6b8a", "pontos_max": 29},
    {"id": "seguranca_area", "nome": "Segurança", "cor": "#8a7a3b", "pontos_max": 21},
]
# Pilares e critérios inventados para a demonstração
PILARES = [
    {"id": "retrabalho", "area": "processos", "nome": "Retrabalho", "responsavel": "Equipe de Processos", "pontos_max": 25,
     "itens": [
         {"id": "retrabalho_registrado", "nome": "Sem retrabalho no mês", "pontos_max": 6,
          "criterio": "Nenhum retrabalho no mês = 6 pts; qualquer registro zera o item"},
         {"id": "analise_causa", "nome": "Análise de causa no prazo", "pontos_max": 10,
          "criterio": "Acima de 85% = 10 pts; 60% a 85% = 7 pts; 30% a 60% = 3 pts; abaixo de 30% = 0"},
         {"id": "acoes_melhoria", "nome": "Ações de melhoria no prazo", "pontos_max": 9,
          "criterio": "Acima de 85% = 9 pts; 60% a 85% = 5 pts; 30% a 60% = 2 pts; abaixo de 30% = 0"}]},
    {"id": "capacitacao", "area": "processos", "nome": "Capacitação", "responsavel": "Equipe de Processos", "pontos_max": 25,
     "itens": [
         {"id": "capacitacao_lider", "nome": "Capacitação do líder", "pontos_max": 5,
          "criterio": "100% das capacitações atribuídas concluídas"},
         {"id": "capacitacao_equipe", "nome": "Equipe acima de 75% capacitada", "pontos_max": 10,
          "criterio": "Acima de 75% das capacitações da equipe concluídas"},
         {"id": "integracao_novos", "nome": "Integração de novos colaboradores", "pontos_max": 10,
          "criterio": "Novos colaboradores com prazo vencendo no mês: 60% ou mais das capacitações em até 45 dias"}]},
    {"id": "presenca", "area": "pessoas", "nome": "Presença", "responsavel": "Equipe de Pessoas", "pontos_max": 15,
     "itens": [
         {"id": "faltas_equipe", "nome": "Faltas até 4%", "pontos_max": 4,
          "criterio": "Até 4% de faltas pontuação completa; acima perde a pontuação"},
         {"id": "conversa_retorno", "nome": "Conversa de retorno", "pontos_max": 11,
          "criterio": "Conversa em até 5 dias após a falta. Acima de 85% = 11; 65–85% = 7; 45–65% = 4; abaixo = 0"}]},
    {"id": "escala_ponto", "area": "pessoas", "nome": "Escala e ponto", "responsavel": "Equipe de Pessoas", "pontos_max": 14,
     "itens": [
         {"id": "ajuste_escala", "nome": "Ajustes de escala no prazo", "pontos_max": 6,
          "criterio": "Ajustes enviados antes do dia; um ajuste fora do prazo zera o item"},
         {"id": "fechamento_ponto", "nome": "Fechamento de ponto semanal", "pontos_max": 8,
          "criterio": "Devolvido completo no prazo. 2 pts por semana OK (até 8)"}]},
    {"id": "seguranca", "area": "seguranca_area", "nome": "Segurança", "responsavel": "Equipe de Segurança", "pontos_max": 21,
     "itens": [
         {"id": "rotina_seguranca", "nome": "Rotina de segurança do líder", "pontos_max": 9,
          "criterio": "Atividades de segurança registradas no mês"},
         {"id": "conversa_seguranca", "nome": "Conversa de segurança na área", "pontos_max": 6,
          "criterio": "Conversas de segurança registradas em até 3 dias"},
         {"id": "acoes_seguranca", "nome": "Ações de segurança no prazo", "pontos_max": 6,
          "criterio": "Ações de segurança concluídas dentro do prazo"}]},
]
NIVEIS = {6: [0, 6], 10: [0, 3, 7, 10], 9: [0, 2, 5, 9], 5: [0, 5], 4: [0, 4], 11: [0, 4, 7, 11], 8: [0, 2, 4, 6, 8]}
SLA_INDICADORES = {item: nome for item, _, nome, _ in INDICADORES}
METAS = {item: meta for item, _, _, meta in INDICADORES}
CORES_AVATAR = ["#4b49aa", "#00839f", "#a2477d", "#3b6b8a", "#8a3b45", "#5b7a3b", "#7a5b3b", "#2b3140"]


def avatar(nome, cor):
    """Cria um avatar SVG com as iniciais e devolve o caminho relativo."""
    iniciais = "".join(p[0] for p in nome.split()[:2]).upper()
    arquivo = "img/" + nome.lower().replace(" ", "-").replace("í", "i").replace("é", "e").replace("á", "a") \
        .replace("ú", "u").replace("ó", "o").replace("ê", "e").replace("â", "a") + ".svg"
    caminho = os.path.join(DEMOS, "gestao-operacional", arquivo)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">'
                f'<rect width="96" height="96" rx="48" fill="{cor}"/><text x="48" y="58" text-anchor="middle" '
                f'font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700" fill="#fff">{iniciais}</text></svg>')
    return arquivo


def sla_itens(r, itens, qualidade):
    saida = []
    for item in itens:
        total = r.randint(400, 3000)
        pct = min(.999, max(.6, METAS[item] + r.uniform(-.06, .03) + (qualidade - .5) * .04))
        dentro = int(total * pct)
        saida.append({"item": item, "indicador": SLA_INDICADORES[item], "pct": round(dentro / total * 100, 1),
                      "meta": METAS[item] * 100, "dentro": dentro, "fora": total - dentro})
    return saida


def pontuar(r, habilidade, progresso):
    """Pontos por item: líder mais 'habilidoso' tende a cumprir mais itens."""
    pontos, detalhe = {}, {}
    for p in PILARES:
        for it in p["itens"]:
            niveis = NIVEIS[it["pontos_max"]]
            chance = habilidade * (0.45 + 0.4 * progresso)
            idx = min(len(niveis) - 1, int(chance * len(niveis) + r.uniform(-.6, .6)))
            pontos[it["id"]] = niveis[max(0, idx)]
            if it["id"] in ("acoes_melhoria", "acoes_seguranca", "fechamento_ponto", "conversa_seguranca"):
                linhas = []
                for n in range(r.randint(1, 4)):
                    prazo = (HOJE + dt.timedelta(days=r.randint(-8, 10))).strftime("%d/%m")
                    st = r.choices(["ok", "pendente", "aberto"], weights=[5, 2, 2])[0]
                    marca = {"ok": "status: No prazo", "pendente": "status: Atrasado", "aberto": "ainda sem marcação"}[st]
                    linhas.append({"rotulo": f"Ação {r.randint(100, 999)} · etapa {n + 1}",
                                   "status": st, "detalhe": f"Prazo: {prazo} - {marca}"})
                detalhe[it["id"]] = linhas
    area = {"processos": 0, "pessoas": 0, "seguranca_area": 0}
    for p in PILARES:
        area[p["area"]] += sum(pontos[it["id"]] for it in p["itens"])
    return pontos, area, detalhe


def main():
    r = rng(2410)
    nomes = nomes_ficticios(r, 3 + 6 + 18)
    coord_nomes, sup_nomes, lid_nomes = nomes[:3], nomes[3:9], nomes[9:]
    sla_por_coord = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 12]]
    coordenadores = []
    for i, nome in enumerate(coord_nomes):
        chave = nome.split()[1]
        coordenadores.append({"chave": chave, "nome": nome, "foto": avatar(nome, CORES_AVATAR[i]),
                              "sla_correspondente": " · ".join(f"SLA {x}" for x in sla_por_coord[i]),
                              "sla_itens": sla_itens(r, sla_por_coord[i], .6)})

    pessoas = []
    turnos = TURNOS
    for s_idx, sup in enumerate(sup_nomes):
        turno = turnos[s_idx // 2]
        coord = coordenadores[s_idx % 3]
        pessoas.append({"nome": sup, "cargo": "Supervisor", "turno": turno, "supervisor": None, "coord": coord})
        for nome in lid_nomes[s_idx * 3:(s_idx + 1) * 3]:
            pessoas.append({"nome": nome, "cargo": "Líder", "turno": turno, "supervisor": sup, "coord": coord})

    lideres, historico = [], {}
    dias_retrato = [HOJE.replace(day=d) for d in (2, 5, 8, 11, 14, 16)]
    for i, p in enumerate(pessoas):
        hab = r.uniform(.25, .9)
        itens_sla = sla_por_coord[coordenadores.index(p["coord"])][:2]
        pid = f"p{i + 1:02d}"
        for d in dias_retrato:
            prog = d.day / HOJE.day
            pts, area, _ = pontuar(r, hab, prog)
            historico.setdefault(d.isoformat(), {})[pid] = {
                "pontos_total": sum(area.values()), "pontos_por_area": area, "pontos_por_item": pts,
                "sla_itens": sla_itens(r, itens_sla, hab)}
        snap = historico[HOJE.isoformat()][pid]
        _, _, detalhe = pontuar(r, hab, 1)
        lideres.append({
            "id": pid, "nome": p["nome"], "cargo": p["cargo"], "turno": p["turno"],
            "foto": avatar(p["nome"], CORES_AVATAR[(i + 3) % len(CORES_AVATAR)]),
            "pontos_total": snap["pontos_total"], "porcentagem_geral": snap["pontos_total"],
            "sla_correspondente": " · ".join(f"SLA {x}" for x in itens_sla), "sla_itens": snap["sla_itens"],
            "posicao_anterior": None, "coordenador": p["coord"]["chave"], "supervisor": p["supervisor"],
            "evolucao_mes": [], "pontos_por_area": snap["pontos_por_area"], "pontos_por_item": snap["pontos_por_item"],
            "detalhe_por_item": detalhe,
        })

    salvar_js("gestao-operacional", "DASHBOARD_DATA", {
        "periodo": f"{MESES_PT[HOJE.month - 1]} {HOJE.year}",
        "mes_referencia": HOJE.strftime("%Y-%m"),
        "atualizado_em": AGORA.strftime("%Y-%m-%d %H:%M"),
        "areas": AREAS, "pilares": PILARES, "coordenadores": coordenadores, "lideres": lideres,
    })
    salvar_js("gestao-operacional", "HISTORICO_DIARIO", historico, "historico.js")


if __name__ == "__main__":
    main()
