(function() {
  "use strict";
  var temDataLabels = typeof ChartDataLabels !== "undefined";
  if (temDataLabels) Chart.register(ChartDataLabels);
  var D = window.DADOS_FROTAS;
  if (!D) {
    document.body.innerHTML = '<p style="padding:40px;color:red">Erro: data.js não carregado.</p>';
    return;
  }
  var VIEWS = [ {
    id: "geral",
    label: "Visão Geral",
    subtitulo: "Visão Geral",
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>'
  }, {
    id: "frota",
    label: "Por Frota",
    subtitulo: "Gasto por Frota e Categoria",
    icon: '<svg viewBox="0 0 24 24"><rect x="1" y="7" width="13" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>'
  } ];
  var PALETA = [ "#c8172f", "#e2465b", "#f2828f", "#2b3140", "#5a6175", "#8b91a0", "#b6bbc7", "#dfe2e8" ];
  function cor(i) {
    return PALETA[i % PALETA.length];
  }
  var st = {
    view: "geral",
    periodo: null,
    frotaFiltro: null
  };
  var charts = {};
  var elFollow = null;
  var MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";
  function ehMobile() {
    return window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches;
  }
  function fmtMoeda(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    });
  }
  function fmtMoedaCompacta(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    if (Math.abs(v) >= 1e3) return "R$ " + (v / 1e3).toLocaleString("pt-BR", {
      maximumFractionDigits: 1
    }) + "k";
    return fmtMoeda(v);
  }
  function fmtNumero(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    return v.toLocaleString("pt-BR");
  }
  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "–";
    var sinal = v > 0 ? "+" : "";
    return sinal + v.toLocaleString("pt-BR", {
      maximumFractionDigits: 1
    }) + "%";
  }
  function destruir(nome) {
    if (charts[nome]) {
      charts[nome].destroy();
      charts[nome] = null;
    }
  }
  function buildSeletorPeriodo() {
    var sel = document.getElementById("sel-periodo");
    if (!sel || !D.periodos_disponiveis) return;
    sel.innerHTML = "";
    D.periodos_disponiveis.forEach((function(p) {
      var opt = document.createElement("option");
      opt.value = p.chave;
      opt.textContent = p.label;
      sel.appendChild(opt);
    }));
    if (D.periodos_disponiveis.length) {
      st.periodo = D.periodos_disponiveis[0].chave;
      sel.value = st.periodo;
    }
    sel.addEventListener("change", (function() {
      st.periodo = sel.value;
      st.frotaFiltro = null;
      atualizarChipFiltro();
      renderView(st.view);
    }));
  }
  function selecionarPeriodo(chave) {
    if (!D.periodos || !D.periodos[chave]) return;
    st.periodo = chave;
    st.frotaFiltro = null;
    atualizarChipFiltro();
    var sel = document.getElementById("sel-periodo");
    if (sel) sel.value = chave;
    renderView(st.view);
  }
  function buildTabBar() {
    var bar = document.getElementById("tab-bar");
    bar.innerHTML = "";
    elFollow = document.createElement("div");
    elFollow.className = "tab-follow";
    elFollow.id = "tab-follow";
    bar.appendChild(elFollow);
    VIEWS.forEach((function(v) {
      var btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.view = v.id;
      btn.innerHTML = v.icon + '<span class="tab-label">' + v.label + "</span>";
      btn.addEventListener("click", (function() {
        activateView(v.id);
      }));
      bar.appendChild(btn);
    }));
  }
  function positionFollow() {
    if (!elFollow) return;
    var btnA = document.querySelector("#tab-bar .tab-btn.active");
    if (!btnA) {
      elFollow.style.opacity = "0";
      return;
    }
    var largura = elFollow.offsetWidth || 60;
    var centro = btnA.offsetLeft + btnA.offsetWidth / 2;
    elFollow.style.left = centro - largura / 2 + "px";
  }
  function activateView(id) {
    st.view = id;
    document.querySelectorAll(".view").forEach((function(el) {
      el.classList.toggle("active", el.id === "view-" + id);
    }));
    document.querySelectorAll("#tab-bar .tab-btn").forEach((function(btn) {
      btn.classList.toggle("active", btn.dataset.view === id);
    }));
    var info = VIEWS.filter((function(v) {
      return v.id === id;
    }))[0];
    document.getElementById("header-subtitle").textContent = info ? info.subtitulo : "";
    positionFollow();
    renderView(id);
  }
  function renderView(id) {
    if (id === "geral") renderGeral();
    if (id === "frota") renderFrota();
  }
  function dadosPeriodo() {
    return D.periodos && D.periodos[st.periodo] || {};
  }
  function enriquecerPorFrota(lista) {
    var equipamentos = D.equipamentos || {};
    return (lista || []).map((function(l) {
      var info = equipamentos[l.frota] || {};
      return {
        frota: l.frota,
        gasto: l.gasto,
        ocorrencias: l.ocorrencias,
        tipo: info.tipo,
        modelo: info.modelo,
        marca: info.marca,
        combustao: info.combustao,
        cap_ton: info.cap_ton,
        fornecedora: info.fornecedora,
        valor: info.valor,
        valor_aluguel: info.valor_aluguel
      };
    }));
  }
  var COLUNAS_FROTA = [ {
    header: "Tipo",
    key: "tipo"
  }, {
    header: "Modelo",
    key: "modelo"
  }, {
    header: "Marca",
    key: "marca"
  }, {
    header: "Energia",
    key: "combustao"
  }, {
    header: "Capacidade (t)",
    key: "cap_ton"
  }, {
    header: "Fornecedora",
    key: "fornecedora"
  }, {
    header: "Valor Máquina",
    key: "valor",
    money: true
  }, {
    header: "Aluguel/Mês",
    key: "valor_aluguel",
    money: true
  } ];
  function renderGeral() {
    var p = dadosPeriodo();
    var geral = p.geral || {};
    document.getElementById("kpi-gasto-total").textContent = fmtMoeda(geral.gasto_total);
    document.getElementById("kpi-ticket-medio").textContent = fmtMoeda(geral.ticket_medio);
    document.getElementById("kpi-ocorrencias").textContent = fmtNumero(geral.ocorrencias);
    var elVar = document.getElementById("kpi-variacao");
    var iconeVar = document.getElementById("icone-variacao");
    elVar.textContent = fmtPct(geral.variacao_pct);
    elVar.classList.remove("ok", "nok");
    iconeVar.classList.remove("kpi-icon-ok", "kpi-icon-nok");
    iconeVar.style.transform = "";
    if (typeof geral.variacao_pct === "number") {
      var caiu = geral.variacao_pct <= 0;
      elVar.classList.add(caiu ? "ok" : "nok");
      iconeVar.classList.add(caiu ? "kpi-icon-ok" : "kpi-icon-nok");
      if (caiu) iconeVar.style.transform = "scaleY(-1)";
    }
    renderGraficoEvolucao(geral.evolucao);
    renderGraficoDonut(p.por_categoria || []);
    renderGraficoDonutClassificacao(p.por_classificacao || []);
    renderGraficoDonutFornecedor(p.contratos && p.contratos.fornecedores || []);
    renderDetailTable("detalhe-geral", enriquecerPorFrota(p.por_frota), "frota", (function(nome) {
      activateView("frota");
      setTimeout((function() {
        highlightRow("detalhe-frota", nome);
      }), 80);
    }), COLUNAS_FROTA);
  }
  function renderGraficoEvolucao(evolucao) {
    var canvas = document.getElementById("grafico-evolucao");
    var semDado = document.getElementById("sem-dado-msg");
    var mob = ehMobile();
    if (!evolucao || !evolucao.meses || !evolucao.meses.length) {
      destruir("evolucao");
      semDado.style.display = "flex";
      return;
    }
    semDado.style.display = "none";
    var labels = evolucao.meses;
    var valores = evolucao.valores || [];
    var chaves = evolucao.meses_chave || [];
    var idxSelecionado = chaves.indexOf(st.periodo);
    var ctx = canvas.getContext("2d");
    var gradiente = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 220);
    gradiente.addColorStop(0, "#e2465b");
    gradiente.addColorStop(1, "#c8172f");
    var corSelecionada = "#a30e22";
    var corNaoSelecionada = idxSelecionado === -1 ? gradiente : "#f2b0b9";
    var backgroundColors = valores.map((function(_, i) {
      return i === idxSelecionado ? corSelecionada : corNaoSelecionada;
    }));
    var borderColors = valores.map((function(_, i) {
      return i === idxSelecionado ? "#7a0a1a" : "transparent";
    }));
    var borderWidths = valores.map((function(_, i) {
      return i === idxSelecionado ? 2 : 0;
    }));
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: mob ? 14 : 26
        }
      },
      onClick: function(evt, elements) {
        if (!elements || !elements.length) return;
        var idx = elements[0].index;
        var chave = (evolucao.meses_chave || [])[idx];
        if (!chave) return;
        selecionarPeriodo(chave);
      },
      onHover: function(evt, elements) {
        if (evt.native && evt.native.target) {
          evt.native.target.style.cursor = elements && elements.length ? "pointer" : "default";
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(25,28,50,0.95)",
          borderColor: "#e7e9f1",
          borderWidth: 1,
          titleColor: "#e0e0ec",
          bodyColor: "#b8bccf",
          padding: 10,
          filter: function(item) {
            return item.dataset.type === "bar";
          },
          callbacks: {
            label: function(ctx) {
              return " " + fmtMoeda(ctx.parsed.y);
            }
          }
        },
        datalabels: temDataLabels ? mob ? {
          display: false
        } : {
          clip: false,
          anchor: "end",
          align: "top",
          color: "#2b3140",
          font: {
            size: 13,
            weight: "800",
            family: "'Poppins', sans-serif"
          },
          formatter: function(v) {
            return fmtMoedaCompacta(v);
          }
        } : false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: mob ? 9 : 11
            }
          }
        },
        y: {
          grid: {
            color: "rgba(0,0,0,0.05)"
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: mob ? 9 : 11
            },
            callback: function(v) {
              return fmtMoedaCompacta(v);
            }
          }
        }
      }
    };
    var datasets = [ {
      type: "bar",
      label: "Gasto Mensal",
      data: valores,
      backgroundColor: backgroundColors,
      borderColor: borderColors,
      borderWidth: borderWidths,
      borderRadius: 8,
      maxBarThickness: 44,
      order: 2
    }, {
      type: "line",
      label: "Tendência",
      data: valores,
      borderColor: "#2b3140",
      backgroundColor: "#2b3140",
      borderWidth: 2.5,
      pointRadius: mob ? 3 : 4,
      pointHoverRadius: 6,
      pointBackgroundColor: "#2b3140",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 1.5,
      tension: .35,
      fill: false,
      order: 1,
      datalabels: {
        display: false
      }
    } ];
    if (charts.evolucao) {
      charts.evolucao.data.labels = labels;
      charts.evolucao.data.datasets = datasets;
      charts.evolucao.options = opts;
      charts.evolucao.update();
    } else {
      charts.evolucao = new Chart(canvas, {
        type: "bar",
        data: {
          labels: labels,
          datasets: datasets
        },
        options: opts
      });
    }
  }
  function renderDetailTable(tableId, linhas, labelKey, aoClicarLinha, colunasExtras) {
    var tbl = document.getElementById(tableId);
    if (!tbl) return;
    colunasExtras = colunasExtras || [];
    var thExtras = colunasExtras.map((function(c) {
      return '<th class="dt-col-extra">' + c.header + "</th>";
    })).join("");
    var head = "<thead><tr><th>Nome</th>" + thExtras + '<th class="dt-col-valor">Gasto</th><th class="dt-col-pct">Distribuição</th></tr></thead>';
    var colspanTotal = 2 + colunasExtras.length;
    if (!linhas.length) {
      tbl.innerHTML = head + '<tbody><tr class="dt-sem-dado"><td colspan="' + colspanTotal + '">Sem dado</td></tr></tbody>';
      return;
    }
    var total = linhas.reduce((function(s, l) {
      return s + (l.gasto || 0);
    }), 0);
    var max = linhas.reduce((function(m, l) {
      return Math.max(m, l.gasto || 0);
    }), 0) || 1;
    var corpo = linhas.map((function(l) {
      var valor = l.gasto || 0;
      var pctTotal = total ? valor / total * 100 : 0;
      var pctBarra = valor / max * 100;
      var nome = String(l[labelKey] || "–");
      var tdsExtras = colunasExtras.map((function(c) {
        var v = l[c.key];
        if (c.status) {
          var texto = v ? String(v) : "–";
          var classe = texto.indexOf("Completo") === 0 ? "dt-status-ok" : "dt-status-falta";
          return '<td class="dt-extra ' + classe + '">' + texto + "</td>";
        }
        var texto = c.money ? fmtMoeda(v) : v ? String(v) : "–";
        return '<td class="dt-extra">' + texto + "</td>";
      })).join("");
      return '<tr data-nome="' + nome.replace(/"/g, "&quot;") + '">' + '<td class="dt-nome" title="' + nome.replace(/"/g, "&quot;") + '">' + nome + "</td>" + tdsExtras + '<td class="dt-valor">' + fmtMoeda(valor) + "</td>" + '<td class="dt-barra-cell"><div class="dt-barra-row">' + '<div class="dt-barra-track"><div class="dt-barra-fill" style="width:' + pctBarra.toFixed(1) + '%"></div></div>' + '<span class="dt-pct">' + pctTotal.toFixed(1) + "%</span>" + "</div></td>" + "</tr>";
    })).join("");
    var tdVazioExtras = colunasExtras.map((function() {
      return "<td></td>";
    })).join("");
    var linhaTotal = '<tr class="dt-total"><td>Total</td>' + tdVazioExtras + '<td class="dt-valor">' + fmtMoeda(total) + '</td><td class="dt-col-pct">100%</td></tr>';
    tbl.innerHTML = head + "<tbody>" + corpo + linhaTotal + "</tbody>";
    if (aoClicarLinha) {
      tbl.querySelectorAll("tbody tr[data-nome]").forEach((function(tr) {
        tr.addEventListener("click", (function() {
          aoClicarLinha(tr.dataset.nome);
        }));
      }));
    }
  }
  function renderOcorrenciasTable(tableId, ocorrencias) {
    var tbl = document.getElementById(tableId);
    if (!tbl) return;
    var head = "<thead><tr>" + '<th class="dt-col-data">Data</th>' + "<th>Frota</th>" + "<th>Categoria</th>" + '<th class="dt-col-classif">Classificação</th>' + '<th class="dt-col-desc">Descrição do ocorrido</th>' + '<th class="dt-col-valor">Valor</th>' + "</tr></thead>";
    if (!ocorrencias || !ocorrencias.length) {
      tbl.innerHTML = head + '<tbody><tr class="dt-sem-dado"><td colspan="6">Sem dado</td></tr></tbody>';
      return;
    }
    var corpo = ocorrencias.map((function(o) {
      var desc = o.descricao ? String(o.descricao) : "–";
      return "<tr>" + '<td class="dt-data">' + (o.data || "–") + "</td>" + '<td class="dt-nome">' + (o.frota || "–") + "</td>" + '<td class="dt-extra">' + (o.categoria || "–") + "</td>" + '<td class="dt-extra">' + (o.classificacao || "–") + "</td>" + '<td class="dt-desc" title="' + desc.replace(/"/g, "&quot;") + '">' + desc + "</td>" + '<td class="dt-valor">' + fmtMoeda(o.valor) + "</td>" + "</tr>";
    })).join("");
    tbl.innerHTML = head + "<tbody>" + corpo + "</tbody>";
  }
  function highlightRow(tableId, nome) {
    var tbl = document.getElementById(tableId);
    if (!tbl) return;
    var alvo = null;
    tbl.querySelectorAll("td.dt-nome").forEach((function(td) {
      if (!alvo && td.textContent === nome) alvo = td.closest("tr");
    }));
    if (!alvo) return;
    alvo.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    alvo.classList.remove("dt-row-highlight");
    void alvo.offsetWidth;
    alvo.classList.add("dt-row-highlight");
    setTimeout((function() {
      alvo.classList.remove("dt-row-highlight");
    }), 1600);
  }
  function renderGraficoDonut(porCategoria) {
    var canvas = document.getElementById("grafico-categorias-donut");
    var semDado = document.getElementById("sem-dado-donut");
    var legendEl = document.getElementById("donut-legend");
    var centerLabel = document.getElementById("donut-center-label");
    var centerValor = document.getElementById("donut-center-valor");
    if (!porCategoria.length) {
      destruir("donut");
      semDado.style.display = "flex";
      legendEl.innerHTML = "";
      centerLabel.textContent = "–";
      centerValor.textContent = "";
      return;
    }
    semDado.style.display = "none";
    var top = porCategoria.slice(0, 5);
    var restante = porCategoria.slice(5).reduce((function(s, c) {
      return s + (c.gasto || 0);
    }), 0);
    var itens = top.map((function(c) {
      return {
        label: c.categoria,
        valor: c.gasto
      };
    }));
    if (restante > 0) itens.push({
      label: "Outros",
      valor: restante
    });
    var total = itens.reduce((function(s, i) {
      return s + i.valor;
    }), 0);
    var cores = itens.map((function(_, i) {
      return cor(i);
    }));
    var topItem = top[0];
    var nomeTop = String(topItem.categoria || "–");
    centerLabel.textContent = nomeTop.length > 20 ? nomeTop.slice(0, 18) + "…" : nomeTop;
    centerLabel.title = nomeTop;
    centerValor.textContent = fmtMoedaCompacta(topItem.gasto);
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      onClick: function(evt, elements) {
        if (!elements || !elements.length) return;
        var idx = elements[0].index;
        var item = itens[idx];
        if (!item || item.label === "Outros") return;
        activateView("frota");
        setTimeout((function() {
          highlightRow("detalhe-categoria", item.label);
        }), 80);
      },
      onHover: function(evt, elements) {
        if (evt.native && evt.native.target) {
          evt.native.target.style.cursor = elements && elements.length ? "pointer" : "default";
        }
        var centerEl = document.getElementById("donut-center");
        if (centerEl) centerEl.classList.toggle("is-hover", !!(elements && elements.length));
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(25,28,50,0.95)",
          borderColor: "#e7e9f1",
          borderWidth: 1,
          titleColor: "#e0e0ec",
          bodyColor: "#b8bccf",
          padding: 10,
          callbacks: {
            label: function(ctx) {
              var pct = total ? ctx.parsed / total * 100 : 0;
              return " " + fmtMoeda(ctx.parsed) + " (" + pct.toFixed(1) + "%)";
            }
          }
        },
        datalabels: false
      }
    };
    var datasets = [ {
      data: itens.map((function(i) {
        return i.valor;
      })),
      backgroundColor: cores,
      borderColor: "#ffffff",
      borderWidth: 2
    } ];
    if (charts.donut) {
      charts.donut.data.labels = itens.map((function(i) {
        return i.label;
      }));
      charts.donut.data.datasets = datasets;
      charts.donut.options = opts;
      charts.donut.update();
    } else {
      charts.donut = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: itens.map((function(i) {
            return i.label;
          })),
          datasets: datasets
        },
        options: opts
      });
    }
    legendEl.innerHTML = itens.map((function(i, idx) {
      var pct = total ? i.valor / total * 100 : 0;
      var nomeCurto = i.label.length > 24 ? i.label.slice(0, 22) + "…" : i.label;
      return '<span title="' + i.label.replace(/"/g, "&quot;") + '" data-idx="' + idx + '">' + '<i style="background:' + cor(idx) + '"></i>' + nomeCurto + " · " + pct.toFixed(0) + "%</span>";
    })).join("");
    legendEl.querySelectorAll("span").forEach((function(span) {
      span.addEventListener("click", (function() {
        var idx = parseInt(span.dataset.idx, 10);
        var item = itens[idx];
        if (!item || item.label === "Outros") return;
        activateView("frota");
        setTimeout((function() {
          highlightRow("detalhe-categoria", item.label);
        }), 80);
      }));
    }));
  }
  function renderGraficoDonutClassificacao(porClassificacao) {
    var canvas = document.getElementById("grafico-classificacao-donut");
    var semDado = document.getElementById("sem-dado-donut-classif");
    var legendEl = document.getElementById("donut-legend-classif");
    var centerLabel = document.getElementById("donut-center-classif-label");
    var centerValor = document.getElementById("donut-center-classif-valor");
    if (!porClassificacao.length) {
      destruir("donutClassificacao");
      semDado.style.display = "flex";
      legendEl.innerHTML = "";
      centerLabel.textContent = "–";
      centerValor.textContent = "";
      return;
    }
    semDado.style.display = "none";
    var itens = porClassificacao.map((function(c) {
      return {
        label: c.classificacao,
        valor: c.gasto
      };
    }));
    var total = itens.reduce((function(s, i) {
      return s + i.valor;
    }), 0);
    var cores = itens.map((function(_, i) {
      return cor(i);
    }));
    var topItem = porClassificacao[0];
    var nomeTop = String(topItem.classificacao || "–");
    centerLabel.textContent = nomeTop.length > 20 ? nomeTop.slice(0, 18) + "…" : nomeTop;
    centerLabel.title = nomeTop;
    centerValor.textContent = fmtMoedaCompacta(topItem.gasto);
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      onHover: function(evt, elements) {
        var centerEl = document.getElementById("donut-center-classif");
        if (centerEl) centerEl.classList.toggle("is-hover", !!(elements && elements.length));
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(25,28,50,0.95)",
          borderColor: "#e7e9f1",
          borderWidth: 1,
          titleColor: "#e0e0ec",
          bodyColor: "#b8bccf",
          padding: 10,
          callbacks: {
            label: function(ctx) {
              var pct = total ? ctx.parsed / total * 100 : 0;
              return " " + fmtMoeda(ctx.parsed) + " (" + pct.toFixed(1) + "%)";
            }
          }
        },
        datalabels: false
      }
    };
    var datasets = [ {
      data: itens.map((function(i) {
        return i.valor;
      })),
      backgroundColor: cores,
      borderColor: "#ffffff",
      borderWidth: 2
    } ];
    if (charts.donutClassificacao) {
      charts.donutClassificacao.data.labels = itens.map((function(i) {
        return i.label;
      }));
      charts.donutClassificacao.data.datasets = datasets;
      charts.donutClassificacao.options = opts;
      charts.donutClassificacao.update();
    } else {
      charts.donutClassificacao = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: itens.map((function(i) {
            return i.label;
          })),
          datasets: datasets
        },
        options: opts
      });
    }
    legendEl.innerHTML = itens.map((function(i, idx) {
      var pct = total ? i.valor / total * 100 : 0;
      var nomeCurto = i.label.length > 24 ? i.label.slice(0, 22) + "…" : i.label;
      return '<span title="' + i.label.replace(/"/g, "&quot;") + '">' + '<i style="background:' + cor(idx) + '"></i>' + nomeCurto + " · " + pct.toFixed(0) + "%</span>";
    })).join("");
  }
  function renderGraficoDonutFornecedor(fornecedores) {
    var canvas = document.getElementById("grafico-fornecedor-donut");
    var semDado = document.getElementById("sem-dado-donut-fornecedor");
    var legendEl = document.getElementById("donut-legend-fornecedor");
    var centerLabel = document.getElementById("donut-center-fornecedor-label");
    var centerValor = document.getElementById("donut-center-fornecedor-valor");
    if (!canvas || !semDado || !legendEl || !centerLabel || !centerValor) return;
    if (!fornecedores.length) {
      destruir("donutFornecedor");
      semDado.style.display = "flex";
      legendEl.innerHTML = "";
      centerLabel.textContent = "–";
      centerValor.textContent = "";
      return;
    }
    semDado.style.display = "none";
    var top = fornecedores.slice(0, 5);
    var restante = fornecedores.slice(5).reduce((function(s, f) {
      return s + (f.gasto || 0);
    }), 0);
    var itens = top.map((function(f) {
      return {
        label: f.nome,
        valor: f.gasto
      };
    }));
    if (restante > 0) itens.push({
      label: "Outros",
      valor: restante
    });
    var total = itens.reduce((function(s, i) {
      return s + i.valor;
    }), 0);
    var cores = itens.map((function(_, i) {
      return cor(i);
    }));
    var topItem = top[0];
    var nomeTop = String(topItem.nome || "–");
    centerLabel.textContent = nomeTop.length > 20 ? nomeTop.slice(0, 18) + "…" : nomeTop;
    centerLabel.title = nomeTop;
    centerValor.textContent = fmtMoedaCompacta(topItem.gasto);
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      onHover: function(evt, elements) {
        var centerEl = document.getElementById("donut-center-fornecedor");
        if (centerEl) centerEl.classList.toggle("is-hover", !!(elements && elements.length));
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(25,28,50,0.95)",
          borderColor: "#e7e9f1",
          borderWidth: 1,
          titleColor: "#e0e0ec",
          bodyColor: "#b8bccf",
          padding: 10,
          callbacks: {
            label: function(ctx) {
              var pct = total ? ctx.parsed / total * 100 : 0;
              return " " + fmtMoeda(ctx.parsed) + " (" + pct.toFixed(1) + "%)";
            }
          }
        },
        datalabels: false
      }
    };
    var datasets = [ {
      data: itens.map((function(i) {
        return i.valor;
      })),
      backgroundColor: cores,
      borderColor: "#ffffff",
      borderWidth: 2
    } ];
    if (charts.donutFornecedor) {
      charts.donutFornecedor.data.labels = itens.map((function(i) {
        return i.label;
      }));
      charts.donutFornecedor.data.datasets = datasets;
      charts.donutFornecedor.options = opts;
      charts.donutFornecedor.update();
    } else {
      charts.donutFornecedor = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: itens.map((function(i) {
            return i.label;
          })),
          datasets: datasets
        },
        options: opts
      });
    }
    legendEl.innerHTML = itens.map((function(i, idx) {
      var pct = total ? i.valor / total * 100 : 0;
      var nomeCurto = i.label.length > 24 ? i.label.slice(0, 22) + "…" : i.label;
      return '<span title="' + i.label.replace(/"/g, "&quot;") + '">' + '<i style="background:' + cor(idx) + '"></i>' + nomeCurto + " · " + pct.toFixed(0) + "%</span>";
    })).join("");
  }
  function renderFrota() {
    var p = dadosPeriodo();
    var porFrota = p.por_frota || [];
    var porCategoria = p.por_categoria || [];
    document.getElementById("kpi-top-frota").textContent = porFrota.length ? porFrota[0].frota + " — " + fmtMoeda(porFrota[0].gasto) : "–";
    document.getElementById("kpi-top-categoria").textContent = porCategoria.length ? porCategoria[0].categoria + " — " + fmtMoeda(porCategoria[0].gasto) : "–";
    var detalheFrota = (p.detalhe_por_frota || {})[st.frotaFiltro];
    var categoriaExibida = st.frotaFiltro && detalheFrota ? detalheFrota.por_categoria : porCategoria;
    var headerTabela = document.getElementById("header-categoria-tabela");
    headerTabela.textContent = st.frotaFiltro && detalheFrota ? "Detalhamento por Categoria — Frota " + st.frotaFiltro : "Detalhamento Completo por Categoria";
    renderDetailTable("detalhe-frota", enriquecerPorFrota(porFrota), "frota", setFrotaFiltro, COLUNAS_FROTA);
    renderDetailTable("detalhe-categoria", categoriaExibida, "categoria");
    var todosOcorrencias = D.periodos.todos && D.periodos.todos.ocorrencias_detalhe || [];
    var ocorrenciasBase = st.periodo === "todos" || !D.periodos[st.periodo] ? todosOcorrencias : todosOcorrencias.filter((function(o) {
      return o.data_ord && o.data_ord.indexOf(st.periodo) === 0;
    }));
    var ocorrenciasExibidas = st.frotaFiltro ? ocorrenciasBase.filter((function(o) {
      return o.frota === st.frotaFiltro;
    })) : ocorrenciasBase;
    var headerOcorrencias = document.getElementById("header-ocorrencias-tabela");
    headerOcorrencias.textContent = st.frotaFiltro ? "Histórico de Ocorrências — Frota " + st.frotaFiltro : "Histórico de Ocorrências";
    renderOcorrenciasTable("detalhe-ocorrencias", ocorrenciasExibidas);
    marcarFrotaSelecionada();
  }
  function marcarFrotaSelecionada() {
    var tbl = document.getElementById("detalhe-frota");
    if (!tbl) return;
    tbl.querySelectorAll("tbody tr[data-nome]").forEach((function(tr) {
      tr.classList.toggle("dt-row-selecionada", tr.dataset.nome === st.frotaFiltro);
    }));
  }
  function setFrotaFiltro(nome) {
    st.frotaFiltro = st.frotaFiltro === nome ? null : nome;
    atualizarChipFiltro();
    renderFrota();
  }
  function limparFrotaFiltro() {
    st.frotaFiltro = null;
    atualizarChipFiltro();
    renderFrota();
  }
  function atualizarChipFiltro() {
    var chip = document.getElementById("filtro-frota-chip");
    var nomeEl = document.getElementById("filtro-frota-nome");
    if (!chip) return;
    if (st.frotaFiltro) {
      nomeEl.textContent = st.frotaFiltro;
      chip.style.display = "flex";
    } else {
      chip.style.display = "none";
    }
  }
  var btnLimparFrota = document.getElementById("btn-limpar-filtro-frota");
  if (btnLimparFrota) btnLimparFrota.addEventListener("click", limparFrotaFiltro);
  document.getElementById("updated-tag").textContent = "Atualizado em:\n" + (D.atualizado_em || "–");
  buildSeletorPeriodo();
  buildTabBar();
  activateView("geral");
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then((function() {
      positionFollow();
    }));
  }
  var resizeTimer = null;
  function onResize() {
    positionFollow();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout((function() {
      Object.keys(charts).forEach((function(k) {
        if (charts[k]) charts[k].resize();
      }));
      renderView(st.view);
    }), 150);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
})();
