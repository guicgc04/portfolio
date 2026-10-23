"""Funções compartilhadas pelos geradores de dados fictícios.

Todos os dashboards do portfólio usam dados 100% inventados. Nenhum número,
nome ou código vem da operação real: tudo é sorteado aqui, com semente fixa
para o resultado ser o mesmo a cada execução.
"""
import datetime as dt
import json
import math
import os
import random

# Data de referência da demonstração (o "hoje" dos dashboards)
HOJE = dt.date(2026, 10, 16)
AGORA = dt.datetime(2026, 10, 16, 14, 35, 0)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMOS = os.path.join(RAIZ, "demos")

MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
               "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
TURNOS = ["Manhã", "Tarde", "Noite"]

# Operação fictítransp: um centro de distribuição inventado. Nomes, metas e volumes
# não têm relação com nenhuma operação real.
SETORES = ("Entrada", "Saída")
TIPOS_OPERACAO = ["Mecanizado", "Manual", "Automatizado"]
INDICADORES = [  # (item, setor, nome, meta)
    (1, "Entrada", "Conferência de recebimento", .93),
    (2, "Entrada", "Endereçamento", .90),
    (3, "Entrada", "Reposição de estoque", .88),
    (4, "Entrada", "Controle de qualidade", .92),
    (5, "Entrada", "Liberação de lotes", .91),
    (6, "Entrada", "Inventário cíclico", .94),
    (7, "Saída", "Separação de pedidos", .96),
    (8, "Saída", "Conferência de saída", .95),
    (9, "Saída", "Embalagem", .92),
    (10, "Saída", "Etiquetagem", .97),
    (11, "Saída", "Devoluções", .89),
    (12, "Saída", "Pontualidade de despacho", .94),
]


def turno_da_hora(h):
    """Manhã 06h–14h, Tarde 14h–22h, Noite 22h–06h."""
    if h < 6 or h >= 22:
        return "Noite"
    return "Manhã" if h < 14 else "Tarde"

PRIMEIROS = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela",
             "Heitor", "Isabela", "João", "Karen", "Lucas", "Marina", "Nicolas",
             "Olívia", "Pedro", "Rafaela", "Samuel", "Tatiane", "Vinícius",
             "Yasmin", "Caio", "Débora", "Enzo", "Flávia", "Gustavo", "Helena",
             "Igor", "Júlia", "Leonardo", "Mariana", "Otávio", "Paula", "Renan"]
SOBRENOMES = ["Almeida", "Barros", "Campos", "Duarte", "Esteves", "Freitas",
              "Gomes", "Lima", "Moraes", "Nunes", "Oliveira", "Pires",
              "Queiroz", "Ramos", "Santos", "Teixeira", "Vieira", "Xavier"]


def rng(semente):
    """Gerador aleatório com semente fixa (resultado reproduzível)."""
    return random.Random(semente)


def nomes_ficticios(r, qtd):
    """Lista de nomes inventados, sem repetição."""
    usados, saida = set(), []
    while len(saida) < qtd:
        nome = f"{r.choice(PRIMEIROS)} {r.choice(SOBRENOMES)}"
        if nome not in usados:
            usados.add(nome)
            saida.append(nome)
    return saida


def onda(r, base, amplitude, i, periodo=7, ruido=0.12):
    """Valor com sazonalidade semanal + ruído: dá cara de dado real."""
    v = base + amplitude * math.sin(2 * math.pi * i / periodo)
    v *= 1 + r.uniform(-ruido, ruido)
    return max(0, v)


def dias_do_mes(ano, mes):
    inicio = dt.date(ano, mes, 1)
    fim = dt.date(ano + (mes == 12), (mes % 12) + 1, 1)
    return [(inicio + dt.timedelta(d)) for d in range((fim - inicio).days)]


def salvar_js(slug, variavel, dados, arquivo="data.js"):
    """Grava `window.<variavel> = {...};` dentro de demos/<slug>/."""
    caminho = os.path.join(DEMOS, slug, arquivo)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(f"window.{variavel} = ")
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"  {slug}/{arquivo}: {os.path.getsize(caminho) / 1024:.0f} KB")


def salvar_json(slug, dados, arquivo):
    caminho = os.path.join(DEMOS, slug, arquivo)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {slug}/{arquivo}: {os.path.getsize(caminho) / 1024:.0f} KB")
