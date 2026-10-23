# Portfólio · Cauã Chiaradia

Automação de processos e dashboards feitos em código.

**Site:** https://guicgc04.github.io/portfolio/

## O que tem aqui

- `index.html`: página inicial.
- `projetos/`: uma página por dashboard, explicando para que ele serve, quem usa e como funciona.
- `demos/`: os dashboards funcionando de verdade, com **dados 100% fictícios**.
- `gerador/`: scripts em Python que inventam esses dados no mesmo formato que os ETLs reais produzem.

## Sobre os dados

Nenhum número, nome, indicador, regra ou código das demos vem de uma operação real. Pessoas, lotes,
indicadores, equipamentos, metas e regras são inventados e gerados pelos scripts da pasta `gerador/`, com semente fixa.

Para gerar tudo de novo:

```bash
cd gerador
python gerar_tudo.py      # dados de todos os dashboards
python gerar_paginas.py   # páginas de projeto e cards da home
```
