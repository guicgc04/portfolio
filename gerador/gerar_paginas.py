"""Monta as páginas de cada dashboard (projetos/<slug>.html) e a grade de cards da home.

O conteúdo de cada projeto fica em PROJETOS, abaixo. Para editar um texto, mude aqui e
rode `python gerar_paginas.py`.
"""
import html
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PROJETOS = [
    {
        "slug": "performance-turnos",
        "categoria": "operacao",
        "cor": "iris",
        "rotulo": "Tempo real",
        "titulo": "Performance Operacional",
        "titulo_em": "Performance",
        "resumo": "Os indicadores de prazo da operação, turno a turno, com atualização automática.",
        "serve": "Mostra, quase em tempo real, se cada indicador de prazo (SLA) da operação está dentro da meta, separado pelos turnos do dia. Também lista cada lote em andamento com o prazo dele.",
        "quem": "Supervisores e líderes de turno, em qualquer dispositivo.",
        "decisao": "Onde colocar gente agora, qual turno está atrasando e o que o turno anterior deixou pendente para o próximo.",
        "fluxo": ["Um robô baixa os relatórios do sistema de gestão", "O ETL em Python aplica a regra de prazo de cada indicador", "Cada lote ganha status: no prazo, prestes a vencer ou vencido", "O painel recarrega os dados a cada poucos minutos"],
        "experimente": ["Clique nos cabeçalhos da tabela para ordenar e filtrar", "Abra a aba Lotes para ver cada lote com prazo e status, e baixe a planilha", "Na aba Pendências por Turno, veja o que cada turno herdou, realizou e passou adiante", "Use o botão Dia anterior para comparar com ontem"],
        "stack": ["Python", "Pandas", "JavaScript", "Excel (openpyxl)"],
    },
    {
        "slug": "hora-a-hora",
        "categoria": "operacao",
        "cor": "orchid",
        "rotulo": "Hora a hora",
        "titulo": "SLAs Hora a Hora",
        "titulo_em": "Hora",
        "resumo": "Cada indicador quebrado por hora: o que entrou, o que saiu no prazo e o que atrasou.",
        "serve": "Mostra cada indicador de prazo hora por hora: quanto trabalho entrou, quanto foi feito dentro da meta e quanto atrasou, comparado com a capacidade esperada para aquele horário.",
        "quem": "Supervisores e coordenação, para entender o dia enquanto ele acontece.",
        "decisao": "Em que horário o gargalo aparece e qual percentual ainda precisa ser atingido no resto do mês para bater a meta.",
        "fluxo": ["Os mesmos relatórios do sistema de gestão entram no ETL", "Python agrupa por hora, turno e tipo de operação", "Um histórico mensal guarda os dias anteriores", "O painel calcula o % necessário até o fim do mês"],
        "experimente": ["Troque de indicador na barra inferior", "Clique numa barra do gráfico para filtrar aquela hora", "Filtre por tipo de operação e por turno", "Volte até 4 dias no seletor de dia"],
        "stack": ["Python", "Pandas", "JavaScript", "Chart.js"],
    },
    {
        "slug": "sla-consolidado",
        "categoria": "gestao",
        "cor": "periwinkle",
        "rotulo": "Mensal",
        "titulo": "SLA Consolidado Mensal",
        "titulo_em": "Consolidado",
        "resumo": "A fotografia do mês: acumulado, tendência e se ainda dá para bater cada meta.",
        "serve": "Junta o mês inteiro de cada indicador: o percentual acumulado, a tendência do dia e uma projeção que diz se a meta ainda é possível e quantas operações no prazo ainda faltam.",
        "quem": "Gestão e coordenação, e serve de base para a reunião mensal de resultados.",
        "decisao": "Em quais indicadores concentrar esforço: os que estão Dentro, os que ainda dá para recuperar (com a quantidade necessária) e os que já estão perdidos no mês.",
        "fluxo": ["O ETL lê o mês inteiro de movimentações", "Calcula o acumulado e a tendência de cada indicador", "Projeta o volume dos dias que faltam e a quantidade necessária", "O painel mostra o status e o responsável de cada grupo de indicadores"],
        "experimente": ["Alterne entre as visões Semanal, Diária e Mensal na barra inferior", "Ordene e filtre pelos cabeçalhos", "Veja a coluna Status: Dentro, quantidade necessária ou Perdido"],
        "stack": ["Python", "Pandas", "JavaScript"],
    },
    {
        "slug": "produtividade-linhas",
        "categoria": "operacao",
        "cor": "deep",
        "rotulo": "Conferência",
        "titulo": "Produtividade por Linha",
        "titulo_em": "Produtividade",
        "resumo": "Desempenho de cada linha de conferência, por hora, viagem e palete.",
        "serve": "Mostra o desempenho de cada linha onde os lotes que chegam são descarregados e conferidos: volume por hora, prazo, tempo de descarga de cada palete e o detalhe de cada viagem.",
        "quem": "Líderes da área de conferência.",
        "decisao": "Qual linha está lenta, qual viagem travou o fluxo e se a capacidade por hora está sendo atingida.",
        "fluxo": ["O ETL cruza dois relatórios: chegada dos paletes e conferência de cada lote", "Python liga cada lote à sua linha, viagem e palete", "Calcula o tempo de descarga e o prazo de cada lote", "O painel permite descer do geral até um palete específico"],
        "experimente": ["Use as abas de cada linha na barra inferior", "Clique numa linha da tabela para abrir o detalhe", "Filtre por turno e tipo de lote", "Esconda ou mostre as séries clicando na legenda do gráfico"],
        "stack": ["Python", "Pandas", "JavaScript", "Chart.js"],
    },
    {
        "slug": "ocupacao",
        "categoria": "operacao",
        "cor": "pale",
        "rotulo": "Armazém",
        "titulo": "Ocupação do Armazém",
        "titulo_em": "Ocupação",
        "resumo": "Quanto de cada área do armazém está ocupado, com alerta por cor e histórico.",
        "serve": "Mostra quanto de cada área do armazém está ocupado, com cores de alerta (do verde ao vermelho), quanto tempo os lotes ficam parados em média e o peso recebido e entregue na semana.",
        "quem": "Planejamento e supervisão do armazém.",
        "decisao": "Onde guardar o próximo lote, quando acionar a área de reserva e se o armazém está enchendo mais rápido do que esvazia.",
        "fluxo": ["O ETL lê o inventário de posições do armazém", "Classifica cada posição em uma área e cada lote pelo peso", "Calcula a ocupação e guarda uma foto por dia no histórico", "O painel pinta cada área conforme os limites de alerta"],
        "experimente": ["Clique numa área para destacá-la", "Compare a ocupação com e sem a área automatizada", "Veja o peso recebido e entregue dos últimos 7 dias"],
        "stack": ["Python", "Pandas", "JavaScript", "Chart.js"],
    },
    {
        "slug": "tonelagem",
        "categoria": "gestao",
        "cor": "iris",
        "rotulo": "Volume",
        "titulo": "Tonelagem",
        "titulo_em": "Tonelagem",
        "resumo": "Peso movimentado por dia e a projeção do mês contra a meta de volume.",
        "serve": "Mostra o peso recebido e entregue por dia, na entrada e na saída, e projeta o fechamento do mês numa meta dividida em níveis de volume.",
        "quem": "Gestão e área financeira.",
        "decisao": "Em que nível de volume o mês deve fechar e como ele se compara com os meses e anos anteriores.",
        "fluxo": ["Um robô baixa o relatório de peso do mês", "O ETL soma os dias fechados e projeta o restante do mês", "Calcula o nível atual e o projetado", "O painel compara com meses e anos anteriores"],
        "experimente": ["Use as abas Mês atual, Comparativo mensal e Comparativo anual", "Abra um mês anterior na barra inferior", "Mude o filtro de datas no topo"],
        "stack": ["Python", "openpyxl", "JavaScript", "Chart.js"],
    },
    {
        "slug": "frotas",
        "categoria": "gestao",
        "cor": "orchid",
        "rotulo": "Financeiro",
        "titulo": "Frotas · Financeiro",
        "titulo_em": "Frotas",
        "resumo": "Quanto custa manter cada equipamento: por mês, categoria, tipo de manutenção e fornecedor.",
        "serve": "Mostra quanto custa manter cada equipamento da frota: gasto por mês, por categoria, por tipo de manutenção e por fornecedor, cruzado com o cadastro de cada máquina.",
        "quem": "Gestão e controladoria.",
        "decisao": "Qual máquina está custando demais, quanto do gasto vem de mau uso e quanto vai para cada fornecedor.",
        "fluxo": ["Cada manutenção é registrada num checklist feito em Power Apps", "As respostas caem numa lista e o ETL em Python lê tudo", "Cruza cada ocorrência com o cadastro do equipamento", "O painel agrega por período, categoria e fornecedor"],
        "experimente": ["Troque o período no seletor do topo", "Abra a aba Por Frota para ver o histórico de uma máquina", "Passe o mouse nos gráficos de rosca para ver os valores"],
        "stack": ["Power Apps", "Python", "openpyxl", "JavaScript"],
    },
    {
        "slug": "gestao-operacional",
        "categoria": "gestao",
        "cor": "periwinkle",
        "rotulo": "Liderança",
        "titulo": "Gestão Operacional",
        "titulo_em": "Gestão",
        "resumo": "Ranking gamificado das lideranças em Processos, Pessoas e Segurança.",
        "serve": "Um ranking gamificado: cada líder ganha pontos por cumprir rotinas de Processos, Pessoas e Segurança com a sua equipe, e vê também os indicadores de prazo da sua área.",
        "quem": "Líderes, supervisores e coordenação, em qualquer dispositivo.",
        "decisao": "Quem precisa de apoio e em quê. O painel mostra a cada líder exatamente onde focar para ganhar pontos.",
        "fluxo": ["O ETL lê planilhas de várias áreas (capacitação, ponto, segurança, ocorrências)", "Python cruza tudo pela pessoa e aplica as regras de pontuação", "Guarda um retrato por dia para mostrar a evolução", "O painel monta o ranking e o detalhamento de cada pessoa"],
        "experimente": ["Troque entre Líderes, Supervisores e Coordenadores", "Abra a aba Detalhamento e escolha uma pessoa", "Veja a evolução no mês e onde focar para ganhar pontos"],
        "stack": ["Python", "Pandas", "JavaScript"],
    },
]

LINKEDIN = "https://www.linkedin.com/in/guilherme-cau%C3%A3-genova-chiaradia-0ba5562b8/"

ICONE = {
    "inicio": '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',
    "sobre": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    "trajetoria": '<rect x="3" y="7" width="18" height="13" rx="1"/><path d="M9 7V4h6v3M3 13h18"/>',
    "portfolio": '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    "processo": '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    "ferramentas": '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    "contato": '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
}
SECOES = [("inicio", "Início"), ("sobre", "Sobre mim"), ("trajetoria", "Trajetória"), ("portfolio", "Portfólio"),
          ("ferramentas", "Ferramentas"), ("contato", "Contato")]


def svg(nome):
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONE[nome]}</svg>')


def lado(base="", ativo=None):
    raiz = "../" if base.startswith("..") else ""
    itens = "\n".join(
        f'          <li><a href="{base}#{i}"{" class=\"ativo\"" if i == ativo else ""} data-secao="{i}">{n}</a></li>'
        for i, n in SECOES)
    return f'''<aside class="lado">
      <a class="lado__topo" href="{base}#inicio" aria-label="Início">
        <img class="lado__foto" src="{raiz}img/caua-mini.webp" alt="" width="96" height="96">
        <span class="lado__nome">Cauã Chiaradia</span>
        <span class="lado__cargo">Processos · Dados · Automação</span>
      </a>
      <nav class="lado__nav" aria-label="Seções">
        <ol>
{itens}
        </ol>
      </nav>
    </aside>'''


def pilula(base=""):
    return '<nav class="pilula" aria-label="Atalhos">' + "".join(
        f'<a href="{base}#{i}" data-nome="{n}" data-secao="{i}" aria-label="{n}">{svg(i)}</a>' for i, n in SECOES) + "</nav>"


HEAD = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{titulo}</title>
  <meta name="description" content="{descricao}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{base}style.css?v=5">
</head>'''


def esc(t):
    return html.escape(t, quote=True)


def titulo_html(p):
    t = esc(p["titulo"])
    em = esc(p["titulo_em"])
    return t.replace(em, f"<em>{em}</em>", 1)


CAT_NOME = {"operacao": "Operação", "gestao": "Gestão", "automacao": "Automação"}


def pagina(i, p):
    ant, prox = PROJETOS[i - 1], PROJETOS[(i + 1) % len(PROJETOS)]
    fluxo = "".join(f"<li>{esc(x)}</li>" for x in p["fluxo"])
    exp = "".join(f"<li>{esc(x)}</li>" for x in p["experimente"])
    stack = "".join(f'<span class="tag tag--linha">{esc(x)}</span>' for x in p["stack"])
    demo = f"../demos/{p['slug']}/index.html"
    head = HEAD.format(titulo=esc(p["titulo"]) + " | Cauã Chiaradia", descricao=esc(p["resumo"]), base="../")
    return f'''{head}
<body class="pagina-projeto">
  <a class="skip" href="#conteudo">Pular para o conteúdo</a>
  {pilula("../index.html")}
  <div class="layout">
    {lado("../index.html", "portfolio")}
    <main class="conteudo" id="conteudo">
      <section class="secao">
        <div class="largura">
          <a class="voltar" href="../index.html#portfolio">← Voltar ao portfólio</a>
          <h1 class="titulo-caixa">{esc(p["titulo"])}</h1>
          <div class="proj-cab"><span class="tag">{esc(p["rotulo"])}</span><span class="tag tag--escura">Dados fictícios</span>{stack}</div>
          <p class="proj-resumo">{esc(p["resumo"])}</p>
        </div>
      </section>

      <section class="secao secao--branca" aria-label="Demonstração interativa">
        <div class="largura">
          <div class="browser">
            <div class="browser__bar">
              <span class="browser__dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="browser__label">Demo interativa · clique à vontade</span>
              <a class="btn browser__full" href="{demo}" target="_blank" rel="noopener">Tela cheia ↗</a>
            </div>
            <div class="browser__view">
              <iframe class="browser__frame" src="{demo}" title="Demonstração do dashboard {esc(p["titulo"])}" loading="lazy"></iframe>
            </div>
          </div>
          <p class="demo-nota">No celular, o painel fica melhor em tela cheia ou com o aparelho deitado.</p>
        </div>
      </section>

      <section class="secao">
        <div class="largura">
          <h2 class="titulo-caixa">Para que serve</h2>
          <div class="explica">
            <article><p class="kicker">O que mostra</p><p>{esc(p["serve"])}</p></article>
            <article><p class="kicker">Quem usa</p><p>{esc(p["quem"])}</p></article>
            <article><p class="kicker">Que decisão apoia</p><p>{esc(p["decisao"])}</p></article>
          </div>
        </div>
      </section>

      <section class="secao secao--preta">
        <div class="largura">
          <h2 class="titulo-caixa">Como funciona</h2>
          <p class="intro">Os dados são tratados em Python e a tela é feita em código.</p>
          <ol class="fluxo">{fluxo}</ol>
        </div>
      </section>

      <section class="secao">
        <div class="largura experimente">
          <h2 class="titulo-caixa">Experimente</h2>
          <ul class="checklist">{exp}</ul>
        </div>
      </section>

      <nav class="proj-nav" aria-label="Outros dashboards">
        <a href="{ant["slug"]}.html"><span class="kicker">← Anterior</span><strong>{esc(ant["titulo"])}</strong></a>
        <a href="{prox["slug"]}.html"><span class="kicker">Próximo →</span><strong>{esc(prox["titulo"])}</strong></a>
      </nav>
      <footer class="rodape"><span>Cauã Chiaradia</span><span>Todos os números desta demo são fictícios</span></footer>
    </main>
  </div>
  <script src="../comum.js?v=5"></script>
  <script src="../projeto.js?v=5"></script>
</body>
</html>
'''


def cards_home():
    linhas = []
    for n, p in enumerate(PROJETOS, 1):
        linhas.append(f'''          <a class="card surge" data-cat="{p["categoria"]}" href="projetos/{p["slug"]}.html">
            <span class="card__painel"><span class="kicker">{esc(p["rotulo"])}</span><span class="card__num">{n:02d}</span><span class="card__seta" aria-hidden="true">→</span></span>
            <span class="card__corpo">
              <span class="card__titulo">{esc(p["titulo"])}</span>
              <span class="card__desc">{esc(p["resumo"])}</span>
              <span class="card__mais">Explorar demo →</span>
            </span>
          </a>''')
    return "\n".join(linhas)


def main():
    os.makedirs(os.path.join(RAIZ, "projetos"), exist_ok=True)
    for i, p in enumerate(PROJETOS):
        with open(os.path.join(RAIZ, "projetos", f"{p['slug']}.html"), "w", encoding="utf-8") as f:
            f.write(pagina(i, p))
    caminho = os.path.join(RAIZ, "index.html")
    home = open(caminho, encoding="utf-8").read()
    home = re.sub(r"(<!-- DASHBOARDS:INICIO -->)[\s\S]*?(<!-- DASHBOARDS:FIM -->)",
                  lambda m: m.group(1) + "\n" + cards_home() + "\n          " + m.group(2), home)
    for nome, bloco in (("LADO", lado("", "inicio")), ("PILULA", pilula(""))):
        home = re.sub(rf"(<!-- {nome}:INICIO -->)[\s\S]*?(<!-- {nome}:FIM -->)",
                      lambda m, b=bloco: m.group(1) + "\n    " + b + "\n    " + m.group(2), home)
    open(caminho, "w", encoding="utf-8").write(home)
    print(f"{len(PROJETOS)} páginas de projeto geradas")


if __name__ == "__main__":
    main()
