const PX_POR_CATEGORIA_SCROLL = 46;

const PX_POR_CATEGORIA_SCROLL_AGREGADO = 68;

function ajustarLarguraScroll(canvasId, numPontos, chart, pxPorCategoria = PX_POR_CATEGORIA_SCROLL) {
  const inner = document.getElementById("inner-" + canvasId);
  if (!inner || !chart) return;
  const wrap = inner.parentElement;
  const larguraWrap = wrap ? wrap.clientWidth : 0;
  const larguraNecessaria = (numPontos || 0) * pxPorCategoria;
  inner.style.width = Math.max(larguraWrap, larguraNecessaria) + "px";
  requestAnimationFrame((() => chart.resize()));
}

function hojeIsoLocal() {
  const d = new Date;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

let SERIE_COMPLETA = {
  ent: [],
  sai: []
};

const CHART_INSTANTRANSPORTADORAS = {};

const CHART_INSTANTRANSPORTADORAS_CMP = {};

let DADOS_MESES = {};

document.addEventListener("DOMContentLoaded", (() => {
  const dados = window.__DATA__;
  if (!dados) {
    mostrarErroCarregamento("data.js não carregou (verifique se o arquivo existe na pasta e se o ETL já rodou pelo menos uma vez).");
    return;
  }
  if (!window.Chart) {
    mostrarErroCarregamento("chart.umd.min.js não carregou (verifique se o arquivo está na pasta do projeto, junto com index.html).");
  }
  DADOS_MESES = dados.meses || {};
  renderUpdatedTag(dados.atualizado_em);
  montarAbasDeMes(DADOS_MESES, dados.mes_atual_chave);
  montarAbaComparativoMensal();
  montarAbaComparativoAnual();
  renderGrafico("chart-lote-ent", [], "lote_recebido", "lote_entregue", "Lotes", "ent");
  renderGrafico("chart-lote-sai", [], "lote_recebido", "lote_entregue", "Lotes", "sai");
  renderGrafico("chart-ton-ent", [], "ton_recebida", "ton_entregue", "t", "ent");
  renderGrafico("chart-ton-sai", [], "ton_recebida", "ton_entregue", "t", "sai");
  inicializarFiltroData();
  carregarMes(dados.mes_atual_chave);
  inicializarResizeScroll();
}));

function inicializarResizeScroll() {
  let timer = null;
  window.addEventListener("resize", (() => {
    clearTimeout(timer);
    timer = setTimeout((() => {
      Object.entries(CHART_INSTANTRANSPORTADORAS).forEach((([canvasId, info]) => {
        ajustarLarguraScroll(canvasId, info.chart.data.labels.length, info.chart);
      }));
      Object.entries(CHART_INSTANTRANSPORTADORAS_CMP).forEach((([canvasId, chart]) => {
        ajustarLarguraScroll(canvasId, chart.data.labels.length, chart, PX_POR_CATEGORIA_SCROLL_AGREGADO);
      }));
    }), 150);
  }));
}

function mostrarView(idViewAlvo, btnAtivo, titulo) {
  [ "view-mes-atual", "view-comparativo-mensal", "view-comparativo-anual" ].forEach((id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === idViewAlvo ? "" : "none";
  }));
  document.getElementById("top-row-resumo-faixa").style.display = idViewAlvo === "view-mes-atual" ? "" : "none";
  document.querySelector(".date-filter").style.display = idViewAlvo === "view-mes-atual" ? "" : "none";
  document.getElementById("page-title").textContent = titulo;
  setAbaAtiva(btnAtivo);
}

function montarAbaComparativoMensal() {
  const btn = document.getElementById("tab-comparativo-mensal");
  if (!btn) return;
  btn.addEventListener("click", (() => {
    mostrarView("view-comparativo-mensal", btn, "Tonelagem Mês x Mês");
    requestAnimationFrame((() => renderComparativoMensal()));
  }));
}

function montarAbaComparativoAnual() {
  const btn = document.getElementById("tab-comparativo-anual");
  if (!btn) return;
  btn.addEventListener("click", (() => {
    mostrarView("view-comparativo-anual", btn, "Tonelagem Ano x Ano");
    requestAnimationFrame((() => renderComparativoAnual()));
  }));
}

function montarAbasDeMes(meses, mesAtualChave) {
  const container = document.getElementById("tab-meses-container");
  const btnMesAtual = document.getElementById("tab-mes-atual");
  if (!container) return;
  const chavesOrdenadas = Object.keys(meses).sort();
  chavesOrdenadas.forEach((chave => {
    if (chave === mesAtualChave) return;
    const bloco = meses[chave];
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.textContent = bloco.label;
    btn.dataset.mes = chave;
    btn.addEventListener("click", (() => {
      carregarMes(chave);
      mostrarView("view-mes-atual", btn, "Tonelagem");
    }));
    container.appendChild(btn);
  }));
  if (btnMesAtual) {
    btnMesAtual.addEventListener("click", (() => {
      carregarMes(mesAtualChave);
      mostrarView("view-mes-atual", btnMesAtual, "Tonelagem");
    }));
  }
}

function setAbaAtiva(btnAtivo) {
  document.querySelectorAll(".tab-bar .tab-btn").forEach((b => b.classList.remove("active")));
  btnAtivo.classList.add("active");
}

function carregarMes(chave) {
  const bloco = DADOS_MESES[chave];
  if (!bloco) return;
  SERIE_COMPLETA = bloco.diario;
  renderResumo(bloco.resumo.armazem);
  renderFaixa(bloco.faixas);
  atualizarLimitesFiltroData(bloco.diario);
}

function inicializarFiltroData() {
  const inputDe = document.getElementById("filtro-data-de");
  const inputAte = document.getElementById("filtro-data-ate");
  if (!inputDe || !inputAte) return;
  const aplicar = () => aplicarFiltroData(inputDe.value, inputAte.value);
  inputDe.addEventListener("change", aplicar);
  inputAte.addEventListener("change", aplicar);
}

function atualizarLimitesFiltroData(diario) {
  const inputDe = document.getElementById("filtro-data-de");
  const inputAte = document.getElementById("filtro-data-ate");
  if (!inputDe || !inputAte) return;
  const todasDatas = [ ...diario.ent, ...diario.sai ].map((d => d.data_iso)).sort();
  if (!todasDatas.length) return;
  inputDe.min = todasDatas[0];
  inputDe.max = todasDatas[todasDatas.length - 1];
  inputAte.min = todasDatas[0];
  inputAte.max = todasDatas[todasDatas.length - 1];
  inputDe.value = todasDatas[0];
  inputAte.value = todasDatas[todasDatas.length - 1];
  aplicarFiltroData(inputDe.value, inputAte.value);
}

function aplicarFiltroData(de, ate) {
  if (!de || !ate) return;
  Object.entries(CHART_INSTANTRANSPORTADORAS).forEach((([canvasId, info]) => {
    const serieFonte = SERIE_COMPLETA[info.direcao] || [];
    const filtrada = serieFonte.filter((d => d.data_iso >= de && d.data_iso <= ate));
    info.chart.data.labels = filtrada.map((d => d.data));
    info.chart.data.datasets[0].data = filtrada.map((d => d[info.campoRecebido]));
    info.chart.data.datasets[1].data = filtrada.map((d => d[info.campoEntregue]));
    info.chart.update();
    ajustarLarguraScroll(canvasId, filtrada.length, info.chart);
  }));
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
  if (el) el.textContent = `Atualizado em:\n${atualizadoEm}`;
}

function fmtNum(v, casas = 0) {
  if (v === null || v === undefined) return "–";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function renderResumo(armazens) {
  const tbody = document.querySelector("#tabela-resumo tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  armazens.forEach((a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `\n      <td>${a.nome}</td>\n      <td class="col-ton">${fmtNum(a.tonelagem)}</td>\n      <td class="col-proj">${fmtNum(a.projecao)}</td>\n    `;
    tbody.appendChild(tr);
  }));
}

function renderFaixa(faixas) {
  const track = document.getElementById("faixa-track");
  const fillAtual = document.getElementById("faixa-fill-atual");
  const fillProj = document.getElementById("faixa-fill-projetado");
  if (!track || !fillAtual || !fillProj) return;
  track.querySelectorAll(".faixa-tick, .faixa-tick-line, .faixa-tick-valor, .faixa-marker").forEach((el => el.remove()));
  const min = faixas.escala_min;
  const max = faixas.escala_max;
  const span = max - min;
  faixas.valores.forEach(((valor, i) => {
    const posPct = Math.min(100, Math.max(0, (valor - min) / span * 100));
    const tick = document.createElement("div");
    tick.className = "faixa-tick";
    tick.style.left = posPct + "%";
    tick.textContent = i + 1;
    track.appendChild(tick);
    const line = document.createElement("div");
    line.className = "faixa-tick-line";
    line.style.left = posPct + "%";
    track.appendChild(line);
    const valorTick = document.createElement("div");
    valorTick.className = "faixa-tick-valor";
    valorTick.style.left = posPct + "%";
    valorTick.textContent = Math.round(valor).toLocaleString("pt-BR");
    track.appendChild(valorTick);
  }));
  const fracaoAtualClamp = Math.min(1, Math.max(0, faixas.atual_fracao));
  const fracaoProjClamp = Math.min(1, Math.max(0, faixas.projetado_fracao));
  fillAtual.style.width = fracaoAtualClamp * 100 + "%";
  fillProj.style.left = fracaoAtualClamp * 100 + "%";
  fillProj.style.width = Math.max(0, fracaoProjClamp - fracaoAtualClamp) * 100 + "%";
  const markerAtual = document.createElement("div");
  markerAtual.className = "faixa-marker atual";
  markerAtual.style.left = fracaoAtualClamp * 100 + "%";
  markerAtual.title = `Atual: ${fmtNum(faixas.atual_valor)} t`;
  track.appendChild(markerAtual);
  const markerProj = document.createElement("div");
  markerProj.className = "faixa-marker projetado";
  markerProj.style.left = fracaoProjClamp * 100 + "%";
  markerProj.title = `Projetado: ${fmtNum(faixas.projetado_valor)} t`;
  track.appendChild(markerProj);
  const elAtual = document.getElementById("faixa-val-atual");
  const elProj = document.getElementById("faixa-val-projetado");
  if (elAtual) elAtual.textContent = `${fmtNum(faixas.atual_valor)} t (nível ${faixas.atual_idx}/${faixas.valores.length})`;
  if (elProj) elProj.textContent = `${fmtNum(faixas.projetado_valor)} t (nível ${faixas.projetado_idx}/${faixas.valores.length})`;
}

function _configBarChart(labels, recebido, entregue, unidade, opts = {}) {
  const rotation = opts.rotation ?? 0;
  const fontSize = opts.fontSize ?? 11;
  const fmtLabel = v => v.toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  });
  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [ {
        label: "Recebido",
        data: recebido,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--chart-recebido").trim(),
        borderRadius: 3,
        maxBarThickness: 22
      }, {
        label: "Entregue",
        data: entregue,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--chart-entregue").trim(),
        borderRadius: 3,
        maxBarThickness: 22
      } ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 28
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("pt-BR")} ${unidade}`
          }
        },
        datalabels: window.ChartDataLabels ? {
          anchor: "end",
          align: "end",
          offset: 2,
          clip: false,
          rotation: rotation,
          font: {
            size: fontSize,
            weight: "700",
            family: "Inter, sans-serif"
          },
          color: "#000000",
          formatter: fmtLabel
        } : false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10
            }
          }
        },
        y: {
          grid: {
            color: "rgba(43,49,64,.06)"
          },
          ticks: {
            font: {
              size: 10
            }
          }
        }
      }
    }
  };
}

function renderGrafico(canvasId, serie, campoRecebido, campoEntregue, unidade, direcao) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!window.Chart) {
    const wrap = canvas.parentElement;
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:12px;text-align:center;padding:0 12px;">Chart.js não carregado</div>';
    return;
  }
  if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
    Chart.register(window.ChartDataLabels);
  }
  const labels = serie.map((d => d.data));
  const recebido = serie.map((d => d[campoRecebido]));
  const entregue = serie.map((d => d[campoEntregue]));
  const chart = new Chart(canvas.getContext("2d"), _configBarChart(labels, recebido, entregue, unidade, {
    rotation: -60,
    fontSize: 10.5
  }));
  CHART_INSTANTRANSPORTADORAS[canvasId] = {
    chart: chart,
    campoRecebido: campoRecebido,
    campoEntregue: campoEntregue,
    unidade: unidade,
    direcao: direcao
  };
}

function calcularAgregadosMensais() {
  const chaves = Object.keys(DADOS_MESES).sort();
  const hojeIso = hojeIsoLocal();
  const resultado = {
    ent: [],
    sai: []
  };
  chaves.forEach((chave => {
    const bloco = DADOS_MESES[chave];
    [ "ent", "sai" ].forEach((dir => {
      const serieCompleta = bloco.diario && bloco.diario[dir] || [];
      const serie = serieCompleta.filter((d => d.data_iso !== hojeIso));
      const soma = serie.reduce(((acc, d) => {
        acc.lote_recebido += d.lote_recebido || 0;
        acc.lote_entregue += d.lote_entregue || 0;
        acc.ton_recebida += d.ton_recebida || 0;
        acc.ton_entregue += d.ton_entregue || 0;
        return acc;
      }), {
        lote_recebido: 0,
        lote_entregue: 0,
        ton_recebida: 0,
        ton_entregue: 0
      });
      resultado[dir].push({
        data: bloco.label,
        ...soma
      });
    }));
  }));
  return resultado;
}

function _criarOuAtualizarChartCmp(canvasId, labels, recebido, entregue, unidade, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  if (CHART_INSTANTRANSPORTADORAS_CMP[canvasId]) {
    const chart = CHART_INSTANTRANSPORTADORAS_CMP[canvasId];
    chart.data.labels = labels;
    chart.data.datasets[0].data = recebido;
    chart.data.datasets[1].data = entregue;
    chart.update();
    return;
  }
  if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
    Chart.register(window.ChartDataLabels);
  }
  CHART_INSTANTRANSPORTADORAS_CMP[canvasId] = new Chart(canvas.getContext("2d"), _configBarChart(labels, recebido, entregue, unidade, opts));
}

function renderComparativoMensal() {
  const agregados = calcularAgregadosMensais();
  const montar = (canvasId, dir, campoRecebido, campoEntregue, unidade) => {
    const serie = agregados[dir];
    _criarOuAtualizarChartCmp(canvasId, serie.map((d => d.data)), serie.map((d => d[campoRecebido])), serie.map((d => d[campoEntregue])), unidade, {
      rotation: -60,
      fontSize: 10.5
    });
    ajustarLarguraScroll(canvasId, serie.length, CHART_INSTANTRANSPORTADORAS_CMP[canvasId], PX_POR_CATEGORIA_SCROLL_AGREGADO);
  };
  montar("chart-cmp-lote-ent", "ent", "lote_recebido", "lote_entregue", "Lotes");
  montar("chart-cmp-lote-sai", "sai", "lote_recebido", "lote_entregue", "Lotes");
  montar("chart-cmp-ton-ent", "ent", "ton_recebida", "ton_entregue", "t");
  montar("chart-cmp-ton-sai", "sai", "ton_recebida", "ton_entregue", "t");
}

const HISTORICO_ANUAL_FECHADO = {
  2019: {
    ent: 98420,
    sai: 61310
  },
  2020: {
    ent: 84150,
    sai: 52870
  },
  2021: {
    ent: 103680,
    sai: 66240
  },
  2022: {
    ent: 109930,
    sai: 70510
  },
  2023: {
    ent: 106210,
    sai: 68890
  },
  2024: {
    ent: 114760,
    sai: 73420
  },
  2025: {
    ent: 118340,
    sai: 76150
  }
};

function calcularAnoAtual() {
  const chaves = Object.keys(DADOS_MESES);
  if (!chaves.length) return null;
  const ano = chaves[0].split("-")[0];
  const hojeIso = hojeIsoLocal();
  let ent = 0, sai = 0;
  chaves.forEach((chave => {
    const bloco = DADOS_MESES[chave];
    (bloco.diario.ent || []).forEach((d => {
      if (d.data_iso !== hojeIso) ent += d.ton_recebida || 0;
    }));
    (bloco.diario.sai || []).forEach((d => {
      if (d.data_iso !== hojeIso) sai += d.ton_recebida || 0;
    }));
  }));
  return {
    ano: ano,
    ent: ent,
    sai: sai
  };
}

function _configBarChartSimples(labels, valores, unidade, cor, opts = {}) {
  const rotation = opts.rotation ?? 0;
  const fontSize = opts.fontSize ?? 11;
  const fmtLabel = v => v.toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  });
  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [ {
        data: valores,
        backgroundColor: cor,
        borderRadius: 3,
        maxBarThickness: 60
      } ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 28
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString("pt-BR")} ${unidade}`
          }
        },
        datalabels: window.ChartDataLabels ? {
          anchor: "end",
          align: "end",
          offset: 2,
          clip: false,
          rotation: rotation,
          font: {
            size: fontSize,
            weight: "700",
            family: "Inter, sans-serif"
          },
          color: "#000000",
          formatter: fmtLabel
        } : false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10.5
            }
          }
        },
        y: {
          grid: {
            color: "rgba(43,49,64,.06)"
          },
          ticks: {
            font: {
              size: 10
            }
          }
        }
      }
    }
  };
}

function renderComparativoAnual() {
  const anoAtual = calcularAnoAtual();
  const anos = Object.keys(HISTORICO_ANUAL_FECHADO).map(Number).sort(((a, b) => a - b));
  const labels = anos.map(String);
  const serieEnt = anos.map((a => HISTORICO_ANUAL_FECHADO[a].ent));
  const serieSai = anos.map((a => HISTORICO_ANUAL_FECHADO[a].sai));
  const serieTotal = anos.map((a => HISTORICO_ANUAL_FECHADO[a].ent + HISTORICO_ANUAL_FECHADO[a].sai));
  if (anoAtual && !labels.includes(anoAtual.ano)) {
    labels.push(anoAtual.ano);
    serieEnt.push(Math.round(anoAtual.ent));
    serieSai.push(Math.round(anoAtual.sai));
    serieTotal.push(Math.round(anoAtual.ent + anoAtual.sai));
  }
  const canvasEntSai = document.getElementById("chart-anual-ent-sai");
  const canvasTotal = document.getElementById("chart-anual-total");
  if (!canvasEntSai || !canvasTotal || !window.Chart) return;
  if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
    Chart.register(window.ChartDataLabels);
  }
  if (CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-ent-sai"]) {
    const c = CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-ent-sai"];
    c.data.labels = labels;
    c.data.datasets[0].data = serieEnt;
    c.data.datasets[1].data = serieSai;
    c.update();
  } else {
    CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-ent-sai"] = new Chart(canvasEntSai.getContext("2d"), _configBarChart(labels, serieEnt, serieSai, "t", {
      rotation: -60,
      fontSize: 10.5
    }));
  }
  ajustarLarguraScroll("chart-anual-ent-sai", labels.length, CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-ent-sai"], PX_POR_CATEGORIA_SCROLL_AGREGADO);
  const corTotal = getComputedStyle(document.documentElement).getPropertyValue("--chart-recebido").trim();
  if (CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-total"]) {
    const c = CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-total"];
    c.data.labels = labels;
    c.data.datasets[0].data = serieTotal;
    c.update();
  } else {
    CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-total"] = new Chart(canvasTotal.getContext("2d"), _configBarChartSimples(labels, serieTotal, "t", corTotal, {
      rotation: -60,
      fontSize: 10.5
    }));
  }
  ajustarLarguraScroll("chart-anual-total", labels.length, CHART_INSTANTRANSPORTADORAS_CMP["chart-anual-total"], PX_POR_CATEGORIA_SCROLL_AGREGADO);
}
