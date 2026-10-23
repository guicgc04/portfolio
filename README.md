# Portfólio · Cauã Chiaradia

Automação de processos e dashboards feitos em código.

**Site:** https://guicgc04.github.io/portfolio/

## Estrutura

```
portfolio/
├── index.html              página inicial
├── projetos/               uma página por dashboard (geradas por gerador/gerar_paginas.py)
├── assets/
│   ├── css/
│   │   ├── base.css        cores, reset, tipografia, botões e animações
│   │   ├── layout.css      hero, barra lateral, navegação, seções, rodapé e foto
│   │   ├── home.css        seções da página inicial
│   │   ├── projeto.css     páginas de cada dashboard
│   │   └── responsivo.css  ajustes para tablet e celular (carregado por último)
│   ├── js/
│   │   ├── comum.js        menu ativo e animações (todas as páginas)
│   │   ├── home.js         cards de automação e filtros do portfólio
│   │   └── projeto.js      encaixe da demo interativa
│   └── img/                fotos
├── demos/                  os dashboards funcionando, com dados 100% fictícios
└── gerador/                scripts Python que inventam os dados e montam as páginas
```

Ordem dos estilos: `base` → `layout` → `home` ou `projeto` → `responsivo`.

## Sobre os dados

Nenhum número, nome, indicador, regra ou código das demos vem de uma operação real. Pessoas, lotes,
indicadores, equipamentos, metas e regras são inventados e gerados pelos scripts da pasta `gerador/`, com semente fixa.

Para gerar tudo de novo:

```bash
cd gerador
python gerar_tudo.py      # dados de todos os dashboards
python gerar_paginas.py   # páginas de projeto e cards da home
```
