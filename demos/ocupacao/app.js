const MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";

const PX_POR_CATEGORIA_SCROLL = 46;

const PX_POR_CATEGORIA_SCROLL_COMPACTO = 58;

const ALPHA_HOJE = .45;

const CHART_INSTANTRANSPORTADORAS = {};

const FILTRO = {
  areas: new Set,
  dias: new Set
};

const MEDIA_TOQUE = "(hover: none)";

const ALPHA_FORA_DO_FILTRO = .16;

let PAINEIS = [];

let DIAS_PESO = [];

let LIMITES = null;

document.addEventListener("DOMContentLoaded", (() => {
  const dados = window.__DATA__;
  if (!dados) {
    mostrarErroCarregamento("data.js não carregou (verifique se o arquivo existe na pasta e se o ETL já rodou pelo menos uma vez).");
    return;
  }
  if (!window.Chart) {
    mostrarErroCarregamento("chart.umd.min.js não carregou (verifique se o arquivo está na pasta do projeto, junto com index.html).");
  }
  if (dados.avisos && dados.avisos.length) {
    mostrarErroCarregamento(dados.avisos.join(" · "));
  }
  PAINEIS = dados.ocupacao && dados.ocupacao.paineis || [];
  DIAS_PESO = dados.tonelagem && dados.tonelagem.dias || [];
  LIMITES = dados.limites || null;
  renderUpdatedTag(dados.atualizado_em);
  renderLegenda(LIMITES);
  renderGrupos();
  renderGraficoPeso("chart-ent", "ent_recebida", "ent_entregue");
  renderGraficoPeso("chart-sai", "sai_recebida", "sai_entregue");
  atualizarResumosPeso();
  inicializarFiltro();
  inicializarResize();
}));

function ehCompacto() {
  return window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches;
}

function fmtNum(v, casas = 0) {
  if (v === null || v === undefined) return "–";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function fmtPct(pctArred) {
  return pctArred === null || pctArred === undefined ? "–" : `${pctArred}%`;
}

function mostrarErroCarregamento(msg) {
  console.error(msg);
  const faixa = document.createElement("div");
  faixa.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999;background:#a30e22;color:#fff;font-family:sans-serif;font-size:13px;font-weight:700;padding:8px 16px;text-align:center;";
  faixa.textContent = "⚠ " + msg;
  document.body.prepend(faixa);
}

function renderUpdatedTag(atualizadoEm) {
  const el = document.getElementById("updated-tag");
  if (el) el.textContent = `Atualizado em:\n${atualizadoEm || "–"}`;
}

function renderLegenda(lim) {
  const box = document.getElementById("legenda-status");
  if (!box || !lim) return;
  box.innerHTML = "";
  [ [ "verde", `< ${lim.amarelo}%`, "Tranquilo" ], [ "amarelo", `${lim.amarelo}–${lim.laranja - 1}%`, "Alerta" ], [ "laranja", `${lim.laranja}–${lim.vermelho - 1}%`, "Perigoso" ], [ "vermelho", `≥ ${lim.vermelho}%`, "Crítico" ] ].forEach((([cor, faixa, nome]) => {
    const item = el("span");
    item.title = nome;
    item.appendChild(el("i", `dot ${cor}`));
    item.appendChild(document.createTextNode(faixa));
    box.appendChild(item);
  }));
}

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach((([k, v]) => e.setAttribute(k, v)));
  return e;
}

function chaveArea(painel, area) {
  return `${painel.id}|${area.nome}`;
}

function cliqueAditivo(evt) {
  return !!(evt && (evt.ctrlKey || evt.metaKey || evt.shiftKey)) || window.matchMedia(MEDIA_TOQUE).matches;
}

function alternarSelecao(conjunto, chave, aditivo) {
  if (aditivo) {
    if (conjunto.has(chave)) conjunto.delete(chave); else conjunto.add(chave);
    return;
  }
  const eraUnico = conjunto.size === 1 && conjunto.has(chave);
  conjunto.clear();
  if (!eraUnico) conjunto.add(chave);
}

function statusPorPct(pctArred) {
  if (pctArred === null || pctArred === undefined || !LIMITES) return null;
  if (pctArred >= LIMITES.vermelho) return "vermelho";
  if (pctArred >= LIMITES.laranja) return "laranja";
  if (pctArred >= LIMITES.amarelo) return "amarelo";
  return "verde";
}

function totalDaSelecao(areas) {
  const semDado = areas.some((a => a.cargas === null || a.cargas === undefined));
  const posicoes = areas.reduce(((s, a) => s + a.posicoes), 0);
  const diasN = areas.reduce(((s, a) => s + (a.dias_n || 0)), 0);
  const diasSoma = areas.reduce(((s, a) => s + (a.dias_soma || 0)), 0);
  const dias = diasN > 0 ? diasSoma / diasN : null;
  if (semDado || !posicoes) return {
    cargas: null,
    posicoes: posicoes,
    pct: null,
    pct_arred: null,
    status: null,
    dias: dias
  };
  const cargas = areas.reduce(((s, a) => s + a.cargas), 0);
  const pctArred = Math.round(cargas * 100 / posicoes);
  return {
    cargas: cargas,
    posicoes: posicoes,
    pct: cargas / posicoes,
    pct_arred: pctArred,
    status: statusPorPct(pctArred),
    dias: dias
  };
}

function aoMudarFiltroAreas() {
  renderGrupos();
  atualizarBotaoLimpar();
}

function aoMudarFiltroDias() {
  Object.values(CHART_INSTANTRANSPORTADORAS).forEach((chart => chart.update("none")));
  atualizarResumosPeso();
  atualizarBotaoLimpar();
}

function atualizarBotaoLimpar() {
  const btn = document.getElementById("limpar-filtro");
  if (btn) btn.hidden = FILTRO.areas.size === 0 && FILTRO.dias.size === 0;
}

function limparFiltro() {
  if (FILTRO.areas.size === 0 && FILTRO.dias.size === 0) return;
  FILTRO.areas.clear();
  FILTRO.dias.clear();
  aoMudarFiltroAreas();
  aoMudarFiltroDias();
}

function inicializarFiltro() {
  const btn = document.getElementById("limpar-filtro");
  if (btn) btn.addEventListener("click", limparFiltro);
  document.addEventListener("keydown", (evt => {
    if (evt.key === "Escape") limparFiltro();
  }));
  atualizarBotaoLimpar();
}

function renderGrupos() {
  const raiz = document.getElementById("grupos");
  if (!raiz) return;
  const focada = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.chave : null;
  raiz.innerHTML = "";
  PAINEIS.forEach((painel => {
    const coluna = el("div", "grupo");
    coluna.appendChild(montarHero(painel));
    coluna.appendChild(montarAreas(painel));
    raiz.appendChild(coluna);
  }));
  if (focada) {
    const alvo = Array.from(raiz.querySelectorAll(".area-row")).find((r => r.dataset.chave === focada));
    if (alvo) alvo.focus({
      preventScroll: true
    });
  }
}

function montarHero(painel) {
  const selecionadas = painel.areas.filter((a => FILTRO.areas.has(chaveArea(painel, a))));
  const filtrado = selecionadas.length > 0;
  const t = filtrado ? totalDaSelecao(selecionadas) : painel.total;
  const sem = filtrado ? null : painel.total_sem;
  const card = el("div", `card hero${t.status ? " status-" + t.status : ""}${filtrado ? " filtrado" : ""}`);
  const head = el("div", "hero-head");
  const titulo = el("span", "titulo-bloco");
  const sobrelinha = el("small", null, painel.grupo);
  if (filtrado) sobrelinha.appendChild(el("span", "filtro-tag", "filtro"));
  titulo.appendChild(sobrelinha);
  titulo.appendChild(document.createTextNode(painel.titulo));
  head.appendChild(titulo);
  head.appendChild(montarDiasPill(filtrado ? t.dias : painel.permanencia_dias, filtrado));
  card.appendChild(head);
  const corpo = el("div", "hero-body");
  if (sem) {
    corpo.appendChild(montarGauge([ {
      pct: t.pct,
      status: t.status
    }, {
      pct: sem.pct,
      status: sem.status
    } ], fmtPct(t.pct_arred), "total"));
    const stats = el("div", "hero-stats");
    stats.appendChild(montarLinhaVariante("Com área automatizada", t, "cheia"));
    stats.appendChild(montarLinhaVariante(sem.rotulo || "Sem área automatizada", sem, "anel"));
    corpo.appendChild(stats);
  } else if (!filtrado && painel.detalhar_areas) {
    corpo.appendChild(montarGauge(painel.areas.map((a => ({
      pct: a.pct,
      status: a.status,
      titulo: `${a.nome}: ${fmtPct(a.pct_arred)}`
    }))), fmtPct(t.pct_arred), "total"));
    const stats = el("div", "hero-stats detalhe");
    painel.areas.forEach((area => stats.appendChild(montarLinhaArea(area))));
    const rodape = el("div", "stat-total");
    rodape.appendChild(el("span", null, `Total ${fmtNum(t.cargas)} / ${fmtNum(t.posicoes)}`));
    const folga = textoFolga(t);
    if (folga) rodape.appendChild(el("b", `valor c-${t.status}`, folga));
    stats.appendChild(rodape);
    corpo.appendChild(stats);
  } else {
    corpo.appendChild(montarGauge([ {
      pct: t.pct,
      status: t.status
    } ], fmtPct(t.pct_arred), filtrado ? "seleção" : "ocupado"));
    const stats = el("div", "hero-stats");
    const bloco = el("div");
    let rotulo = "Lotes armazenados";
    if (filtrado) {
      rotulo = selecionadas.length === 1 ? selecionadas[0].nome : `${selecionadas.length} áreas selecionadas`;
    }
    const elRotulo = el("div", "stat-rotulo", rotulo);
    if (filtrado) elRotulo.title = selecionadas.map((a => a.nome)).join(" + ");
    bloco.appendChild(elRotulo);
    bloco.appendChild(el("div", "stat-grande", fmtNum(t.cargas)));
    bloco.appendChild(el("div", "stat-sub", `de ${fmtNum(t.posicoes)} posições`));
    stats.appendChild(bloco);
    const folga = textoFolga(t);
    if (folga) stats.appendChild(el("div", `stat-sub valor c-${t.status}`, folga));
    corpo.appendChild(stats);
  }
  card.appendChild(corpo);
  return card;
}

function textoFolga(total) {
  if (total.cargas === null || total.cargas === undefined) return null;
  const livre = total.posicoes - total.cargas;
  if (livre >= 0) return `${fmtNum(livre)} posições livres`;
  return `${fmtNum(-livre)} lotes acima da capacidade`;
}

function montarLinhaVariante(nome, total, amostra) {
  const linha = el("div", "stat-linha");
  linha.appendChild(el("span", `amostra ${amostra} c-${total.status || "verde"}`));
  const n = el("span", "nome", nome);
  n.appendChild(el("small", null, `${fmtNum(total.cargas)} / ${fmtNum(total.posicoes)}`));
  linha.appendChild(n);
  linha.appendChild(el("span", `valor c-${total.status || "verde"}`, fmtPct(total.pct_arred)));
  return linha;
}

function montarLinhaArea(area) {
  const linha = el("div", "stat-linha compacta");
  linha.appendChild(el("span", `amostra cheia ${area.status ? "c-" + area.status : "c-sem-dado"}`));
  linha.appendChild(el("span", "nome", area.nome));
  linha.appendChild(el("span", "contagem", `${fmtNum(area.cargas)} / ${fmtNum(area.posicoes)}`));
  linha.appendChild(el("span", `valor${area.status ? " c-" + area.status : ""}`, fmtPct(area.pct_arred)));
  return linha;
}

function montarDiasPill(dias, filtrado) {
  const pill = el("div", "dias-pill");
  pill.title = filtrado ? "Média de dias armazenados das áreas selecionadas (lotes armazenados)" : "Média de dias armazenados (lotes do setor)";
  const icone = svgEl("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.2",
    "stroke-linecap": "round"
  });
  icone.appendChild(svgEl("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }));
  icone.appendChild(svgEl("path", {
    d: "M12 7v5l3 2"
  }));
  pill.appendChild(icone);
  pill.appendChild(el("b", null, fmtNum(dias, 1)));
  const legenda = el("span");
  legenda.innerHTML = "dias<br>médios";
  pill.appendChild(legenda);
  return pill;
}

const GEOMETRIA_ANEIS = {
  1: [ {
    r: 50,
    w: 13
  } ],
  2: [ {
    r: 52,
    w: 11
  }, {
    r: 36,
    w: 8
  } ],
  3: [ {
    r: 55.5,
    w: 7
  }, {
    r: 46.5,
    w: 7
  }, {
    r: 37.5,
    w: 7
  } ],
  4: [ {
    r: 56.5,
    w: 5.5
  }, {
    r: 49.5,
    w: 5.5
  }, {
    r: 42.5,
    w: 5.5
  }, {
    r: 35.5,
    w: 5.5
  } ]
};

function montarGauge(aneis, textoCentro, legendaCentro) {
  const n = Math.min(aneis.length, 4);
  const wrap = el("div", `gauge aneis-${n}${n > 1 ? " duplo" : ""}`);
  const svg = svgEl("svg", {
    viewBox: "0 0 120 120"
  });
  const geometria = GEOMETRIA_ANEIS[n];
  aneis.slice(0, n).forEach(((anel, i) => {
    const {r: r, w: w} = geometria[i];
    const grupo = svgEl("g", {});
    if (anel.titulo) {
      const dica = svgEl("title", {});
      dica.textContent = anel.titulo;
      grupo.appendChild(dica);
    }
    svg.appendChild(grupo);
    grupo.appendChild(svgEl("circle", {
      class: "g-track",
      cx: "60",
      cy: "60",
      r: r,
      "stroke-width": w
    }));
    if (anel.pct === null || anel.pct === undefined || !anel.status) return;
    const base = Math.min(anel.pct, 1) * 100;
    if (base > 0) {
      grupo.appendChild(svgEl("circle", {
        class: `g-${anel.status}`,
        cx: "60",
        cy: "60",
        r: r,
        "stroke-width": w,
        pathLength: "100",
        "stroke-dasharray": `${base} 100`
      }));
    }
    const excesso = Math.min(Math.max(anel.pct - 1, 0), 1) * 100;
    if (excesso > 0) {
      grupo.appendChild(svgEl("circle", {
        class: `g-excesso g-${anel.status}`,
        cx: "60",
        cy: "60",
        r: r,
        "stroke-width": w * .72,
        pathLength: "100",
        "stroke-dasharray": `${excesso} 100`
      }));
    }
  }));
  wrap.appendChild(svg);
  const centro = el("div", "gauge-centro");
  centro.appendChild(el("b", null, textoCentro));
  centro.appendChild(el("span", null, legendaCentro));
  wrap.appendChild(centro);
  return wrap;
}

function montarAreas(painel) {
  const card = el("div", "card areas");
  const head = el("div", "areas-head");
  head.appendChild(el("span", null, "Áreas"));
  head.appendChild(el("span", null, "Lotes / posições"));
  card.appendChild(head);
  const escala = Math.max(1, ...painel.areas.map((a => a.pct || 0)));
  const excluidas = painel.total_sem && painel.total_sem.excluidas || [];
  const temSelecao = painel.areas.some((a => FILTRO.areas.has(chaveArea(painel, a))));
  const lista = el("div", "areas-lista");
  painel.areas.forEach((area => {
    const fora = excluidas.includes(area.nome);
    const chave = chaveArea(painel, area);
    const selecionada = FILTRO.areas.has(chave);
    const row = el("div", `area-row${fora ? " separada" : ""}${selecionada ? " selecionada" : ""}${temSelecao && !selecionada ? " apagada" : ""}`);
    row.dataset.chave = chave;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-pressed", selecionada ? "true" : "false");
    row.title = `Clique para filtrar · Ctrl+clique para selecionar várias${area.dias !== null && area.dias !== undefined ? ` · ${fmtNum(area.dias, 1)} dias médios` : ""}`;
    const acionar = evt => {
      alternarSelecao(FILTRO.areas, chave, cliqueAditivo(evt));
      aoMudarFiltroAreas();
    };
    row.addEventListener("click", acionar);
    row.addEventListener("keydown", (evt => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        acionar(evt);
      }
    }));
    const nome = el("div", "area-nome");
    const b = el("b", null, area.nome);
    if (fora) b.appendChild(el("span", "area-tag", "só no total"));
    nome.appendChild(b);
    nome.appendChild(el("small", null, `${fmtNum(area.cargas)} / ${fmtNum(area.posicoes)}`));
    row.appendChild(nome);
    const barra = el("div", "barra");
    if (area.pct !== null && area.pct !== undefined && area.status) {
      const fill = el("div", `barra-fill status-${area.status}`);
      fill.style.width = area.pct / escala * 100 + "%";
      barra.appendChild(fill);
    }
    if (escala > 1) {
      const marca = el("span", "barra-100");
      marca.style.left = 1 / escala * 100 + "%";
      marca.title = "100% da capacidade";
      barra.appendChild(marca);
    }
    row.appendChild(barra);
    row.appendChild(el("span", `pct ${area.status ? "status-" + area.status : "sem-dado"}`, fmtPct(area.pct_arred)));
    lista.appendChild(row);
  }));
  card.appendChild(lista);
  return card;
}

function ajustarLarguraScroll(canvasId, numPontos, chart) {
  const inner = document.getElementById("inner-" + canvasId);
  if (!inner || !chart) return;
  const wrap = inner.parentElement;
  const larguraWrap = wrap ? wrap.clientWidth : 0;
  const px = ehCompacto() ? PX_POR_CATEGORIA_SCROLL_COMPACTO : PX_POR_CATEGORIA_SCROLL;
  inner.style.width = Math.max(larguraWrap, (numPontos || 0) * px) + "px";
  requestAnimationFrame((() => chart.resize()));
}

function comAlpha(cor, alpha) {
  const c = cor.trim();
  if (c.startsWith("#")) {
    const h = c.length === 4 ? c.slice(1).split("").map((x => x + x)).join("") : c.slice(1, 7);
    const n = parseInt(h, 16);
    return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${alpha})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x => x.trim()));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

function atualizarResumosPeso() {
  [ [ "chart-ent", "ent_recebida", "ent_entregue" ], [ "chart-sai", "sai_recebida", "sai_entregue" ] ].forEach((([id, cRec, cEnt]) => {
    const box = document.getElementById("resumo-" + id);
    if (!box) return;
    const filtrado = FILTRO.dias.size > 0;
    const dias = filtrado ? DIAS_PESO.filter((d => FILTRO.dias.has(d.data_iso))) : DIAS_PESO;
    const somar = campo => {
      const vals = dias.map((d => d[campo])).filter((v => v !== null && v !== undefined));
      return vals.length ? vals.reduce(((s, v) => s + v), 0) : null;
    };
    const rec = somar(cRec);
    const ent = somar(cEnt);
    const saldo = rec === null || ent === null ? null : rec - ent;
    let rotulo = `${DIAS_PESO.length} dias`;
    if (filtrado) rotulo = dias.length === 1 ? dias[0].hoje ? "Hoje" : dias[0].data : `${dias.length} dias selecionados`;
    box.innerHTML = "";
    box.classList.toggle("filtrado", filtrado);
    box.appendChild(el("span", "rotulo", rotulo));
    const item = (nome, valor) => {
      const s = el("span", null, nome + " ");
      s.appendChild(el("b", null, valor));
      return s;
    };
    box.appendChild(item("Recebido", rec === null ? "–" : `${fmtNum(rec)} t`));
    box.appendChild(item("Entregue", ent === null ? "–" : `${fmtNum(ent)} t`));
    const sinal = saldo === null ? "" : saldo > 0 ? "+" : saldo < 0 ? "−" : "";
    const elSaldo = item("Saldo", saldo === null ? "–" : `${sinal}${fmtNum(Math.abs(saldo))} t`);
    elSaldo.title = "Recebido − Entregue";
    box.appendChild(elSaldo);
  }));
}

function _configBarChart(recebido, entregue) {
  const dias = DIAS_PESO;
  const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const corRec = cssVar("--chart-recebido");
  const corEnt = cssVar("--chart-entregue");
  const labels = dias.map((d => d.hoje ? "Hoje" : d.data));
  const foraDoFiltro = d => FILTRO.dias.size > 0 && !FILTRO.dias.has(d.data_iso);
  const corDoDia = cor => ctx => {
    const d = dias[ctx.dataIndex];
    if (!d) return cor;
    if (foraDoFiltro(d)) return comAlpha(cor, ALPHA_FORA_DO_FILTRO);
    return d.hoje ? comAlpha(cor, ALPHA_HOJE) : cor;
  };
  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [ {
        label: "Recebido",
        data: recebido,
        backgroundColor: corDoDia(corRec),
        borderRadius: 4,
        maxBarThickness: 30,
        categoryPercentage: .72,
        barPercentage: .9
      }, {
        label: "Entregue",
        data: entregue,
        backgroundColor: corDoDia(corEnt),
        borderRadius: 4,
        maxBarThickness: 30,
        categoryPercentage: .72,
        barPercentage: .9
      } ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          right: 6
        }
      },
      onClick: (evt, _els, chart) => {
        const pts = chart.getElementsAtEventForMode(evt, "index", {
          intersect: false
        }, false);
        if (!pts.length || !dias[pts[0].index]) return;
        alternarSelecao(FILTRO.dias, dias[pts[0].index].data_iso, cliqueAditivo(evt.native));
        aoMudarFiltroDias();
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: itens => {
              const d = dias[itens[0].dataIndex];
              return d.hoje ? `${d.data} (parcial)` : d.data;
            },
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y === null ? "–" : ctx.parsed.y.toLocaleString("pt-BR")} t`
          }
        },
        datalabels: window.ChartDataLabels ? {
          anchor: "end",
          align: "end",
          offset: 1,
          clip: false,
          font: () => ({
            size: ehCompacto() ? 10 : 11,
            weight: "700",
            family: "Inter, sans-serif"
          }),
          color: ctx => {
            const d = dias[ctx.dataIndex];
            if (foraDoFiltro(d)) return "#c3c7d1";
            return d.hoje ? "#8b91a0" : "#2b3140";
          },
          formatter: v => v === null || v === undefined ? "" : v.toLocaleString("pt-BR")
        } : false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            font: ctx => {
              const d = dias[ctx.index];
              const forte = d && (FILTRO.dias.size > 0 ? FILTRO.dias.has(d.data_iso) : d.hoje);
              return {
                size: 10.5,
                weight: forte ? "700" : "500"
              };
            },
            color: ctx => dias[ctx.index] && foraDoFiltro(dias[ctx.index]) ? "#b4b9c5" : "#5a6175"
          }
        },
        y: {
          display: false,
          beginAtZero: true,
          grace: "4%"
        }
      }
    }
  };
}

function renderGraficoPeso(canvasId, campoRecebido, campoEntregue) {
  const dias = DIAS_PESO;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!window.Chart) {
    canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:12px;">Chart.js não carregado</div>';
    return;
  }
  if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
    Chart.register(window.ChartDataLabels);
  }
  const chart = new Chart(canvas.getContext("2d"), _configBarChart(dias.map((d => d[campoRecebido])), dias.map((d => d[campoEntregue]))));
  CHART_INSTANTRANSPORTADORAS[canvasId] = chart;
  ajustarLarguraScroll(canvasId, dias.length, chart);
}

function inicializarResize() {
  let timer = null;
  window.addEventListener("resize", (() => {
    clearTimeout(timer);
    timer = setTimeout((() => {
      Object.entries(CHART_INSTANTRANSPORTADORAS).forEach((([canvasId, chart]) => {
        chart.update("none");
        ajustarLarguraScroll(canvasId, chart.data.labels.length, chart);
      }));
    }), 150);
  }));
}
