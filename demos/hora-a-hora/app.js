(function() {
  "use strict";
  var temDataLabels = typeof ChartDataLabels !== "undefined";
  if (temDataLabels) Chart.register(ChartDataLabels);
  var D = window.DADOS_HH;
  if (!D) {
    document.body.innerHTML = '<p style="padding:40px;color:red">Erro: data.js não carregado.</p>';
    return;
  }
  var st = {
    sla: null,
    turno: "",
    tipo: "",
    sub: "geral",
    dia: null,
    hora: null
  };
  var chart = null;
  var elFollow = null;
  var elHoraChip = null;
  var currentHoras = [];
  var MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";
  function ehMobile() {
    return window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches;
  }
  function diaAtual() {
    return D.dias && D.dias[st.dia] || {
      slas: {}
    };
  }
  function slasAtual() {
    return diaAtual().slas || {};
  }
  var SLA_COM_META = {
    "01": true,
    "07": true
  };
  var META_HORARIA = {
    "01": [ 90, 80, 75, 70, 75, 85, 110, 140, 160, 170, 175, 165, 150, 150, 160, 170, 165, 155, 140, 130, 120, 110, 100, 95 ],
    "07": new Array(24).fill(75)
  };
  var SLA_SEM_PIVOT = {
    "06": true,
    11: true
  };
  var SLA_DESTINO = {
    "02": true,
    "03": true
  };
  document.getElementById("updated-tag").textContent = "Atualizado em:\n" + (D.atualizado_em || "–");
  buildSeletorDia();
  buildFooter();
  buildFiltroTipo();
  bindSelects();
  buildHoraChip();
  activateSLA(slaIdsOrdenados()[0]);
  function slaIdsOrdenados() {
    return Object.keys(slasAtual()).sort((function(a, b) {
      return parseInt(a) - parseInt(b);
    }));
  }
  function buildSeletorDia() {
    var sel = document.getElementById("sel-dia");
    if (!sel || !D.dias) return;
    var chaves = Object.keys(D.dias).sort((function(a, b) {
      return (D.dias[a].offset || 0) - (D.dias[b].offset || 0);
    }));
    if (!chaves.length) return;
    st.dia = chaves[0];
    sel.innerHTML = "";
    chaves.forEach((function(chave) {
      var info = D.dias[chave];
      var opt = document.createElement("option");
      opt.value = chave;
      opt.textContent = info.offset === 0 ? "Hoje" : (info.data || "").slice(0, 5);
      sel.appendChild(opt);
    }));
    sel.value = st.dia;
    sel.addEventListener("change", (function() {
      st.dia = sel.value;
      st.hora = null;
      activateSLA(st.sla);
    }));
  }
  function buildHoraChip() {
    var chip = document.createElement("div");
    chip.id = "hora-chip";
    chip.style.cssText = [ "display:none", "align-items:center", "gap:6px", "padding:3px 10px 3px 12px", "background:rgba(61,107,228,0.10)", "border:1.5px solid rgba(61,107,228,0.32)", "border-radius:20px", "font-size:12px", "color:#3d6be4", "font-weight:600", "font-family:var(--font-body,'Inter',sans-serif)", "line-height:1.4", "margin:0 auto", "width:fit-content", "user-select:none" ].join(";");
    var label = document.createElement("span");
    label.id = "hora-chip-label";
    chip.appendChild(label);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Limpar filtro de hora";
    btn.style.cssText = [ "background:none", "border:none", "padding:0 0 0 2px", "margin:0", "color:#3d6be4", "cursor:pointer", "font-size:15px", "line-height:1", "font-weight:700", "opacity:0.75" ].join(";");
    btn.innerHTML = "&times;";
    btn.addEventListener("click", (function() {
      st.hora = null;
      render();
    }));
    chip.appendChild(btn);
    var leg = document.getElementById("legend");
    if (leg && leg.parentNode) leg.parentNode.insertBefore(chip, leg.nextSibling);
    elHoraChip = chip;
  }
  function buildFooter() {
    var bar = document.getElementById("tab-bar");
    bar.innerHTML = "";
    elFollow = document.createElement("div");
    elFollow.className = "tab-follow";
    elFollow.id = "tab-follow";
    bar.appendChild(elFollow);
    slaIdsOrdenados().forEach((function(id) {
      var btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.sla = id;
      btn.textContent = "SLA " + id;
      btn.addEventListener("click", (function() {
        activateSLA(id);
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
  function setStatusAtivo(status) {
    var bar = document.getElementById("tab-bar");
    var btnA = document.querySelector("#tab-bar .tab-btn.active");
    var classe = "status-" + status;
    [ bar, elFollow, btnA ].forEach((function(el) {
      if (!el) return;
      el.classList.remove("status-ok", "status-nok", "status-neutral");
      el.classList.add(classe);
    }));
  }
  function activateSLA(id) {
    st.hora = null;
    st.sla = id;
    document.querySelectorAll("#tab-bar .tab-btn").forEach((function(b) {
      b.classList.toggle("active", b.dataset.sla === id);
    }));
    var btnA = document.querySelector('#tab-bar .tab-btn[data-sla="' + id + '"]');
    if (btnA) btnA.scrollIntoView({
      inline: "center",
      block: "nearest"
    });
    positionFollow();
    var slaObj = slasAtual()[id];
    var temSub = !!(slaObj && slaObj.tem_sub);
    document.getElementById("filtro-sub-wrap").style.display = temSub ? "" : "none";
    if (!temSub) {
      st.sub = "geral";
      document.getElementById("sel-sub").value = "geral";
    }
    var infoDia = diaAtual();
    var diaLabel = infoDia.offset === 0 ? "Hoje" : infoDia.data;
    document.getElementById("header-subtitle").textContent = slaObj ? slaObj.label + " — META " + slaObj.meta_pct + "% · " + diaLabel : "–";
    if (SLA_SEM_PIVOT[id]) {
      document.body.classList.add("layout-finalizacao");
    } else {
      document.body.classList.remove("layout-finalizacao");
    }
    atualizarLegenda(id);
    render();
  }
  function atualizarLegenda(slaId) {
    var temMeta = SLA_COM_META[slaId];
    var isSla18 = slaId === "12";
    var leg = document.getElementById("legend");
    if (!leg) return;
    if (isSla18) {
      leg.innerHTML = '<span><i class="leg-box" style="background:rgba(37,99,235,0.88)"></i>Dentro (Mecanizado)</span>' + '<span><i class="leg-box" style="background:rgba(22,163,74,0.92)"></i>Dentro (Manual)</span>' + '<span><i class="leg-line" style="background:#1a5fa8"></i>Entrada Mecanizado</span>' + '<span><i class="leg-line" style="background:#1c8a4f"></i>Entrada Manual</span>';
    } else {
      var labelMeta = META_HORARIA[slaId] ? "Meta (capacidade/hora)" : "Meta %";
      leg.innerHTML = '<span><i class="leg-box" style="background:rgba(22,163,74,0.92)"></i>Dentro da Meta</span>' + '<span><i class="leg-box" style="background:rgba(220,38,38,0.90)"></i>Atrasado</span>' + '<span><i class="leg-line" style="background:#3d6be4"></i>Entrada Total</span>' + (temMeta ? '<span><i class="leg-line" style="background:#c8172f;border-top:2px dashed #c8172f;height:0"></i>' + labelMeta + "</span>" : "");
    }
  }
  function buildFiltroTipo() {
    var sel = document.getElementById("sel-tipo");
    sel.innerHTML = '<option value="">Todos</option>';
    (D.opcoes_tipo || []).forEach((function(t) {
      var o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    }));
  }
  function bindSelects() {
    [ [ "sel-turno", "turno" ], [ "sel-tipo", "tipo" ], [ "sel-sub", "sub" ] ].forEach((function(p) {
      document.getElementById(p[0]).addEventListener("change", (function() {
        st[p[1]] = this.value || (p[1] === "sub" ? "geral" : "");
        render();
      }));
    }));
  }
  function render() {
    if (!st.sla) return;
    var slaObj = slasAtual()[st.sla];
    if (!slaObj) return;
    var linhas = (slaObj.linhas || []).filter((function(l) {
      if (st.turno && l.turno !== st.turno) return false;
      if (st.tipo && l.tipo !== st.tipo) return false;
      if (slaObj.tem_sub && st.sub !== "geral" && l.sub !== st.sub) return false;
      return true;
    }));
    var temEntradaSeparada = !!(slaObj.entrada_linhas && slaObj.entrada_linhas.length);
    var entradaLinhas = (slaObj.entrada_linhas || []).filter((function(l) {
      if (st.turno && l.turno !== st.turno) return false;
      if (st.tipo && l.tipo !== st.tipo) return false;
      return true;
    }));
    var linhasKPI = st.hora !== null ? linhas.filter((function(l) {
      return l.hora === st.hora;
    })) : linhas;
    var entradaLinhasKPI = st.hora !== null ? entradaLinhas.filter((function(l) {
      return l.hora === st.hora;
    })) : entradaLinhas;
    var totD = 0, totF = 0;
    linhasKPI.forEach((function(l) {
      totD += l.dentro || 0;
      totF += l.fora || 0;
    }));
    var totE = 0;
    if (temEntradaSeparada) {
      entradaLinhasKPI.forEach((function(l) {
        totE += l.entrada || 0;
      }));
    } else {
      linhasKPI.forEach((function(l) {
        totE += l.entrada || 0;
      }));
    }
    var totDF = totD + totF;
    var pct = totDF > 0 ? (totD / totDF * 100).toFixed(1) : null;
    var semKPI = totDF + totE === 0;
    var totDAll = 0, totFAll = 0, totEAll = 0;
    linhas.forEach((function(l) {
      totDAll += l.dentro || 0;
      totFAll += l.fora || 0;
    }));
    if (temEntradaSeparada) {
      entradaLinhas.forEach((function(l) {
        totEAll += l.entrada || 0;
      }));
    } else {
      linhas.forEach((function(l) {
        totEAll += l.entrada || 0;
      }));
    }
    var sem = totDAll + totFAll + totEAll === 0;
    var ehHoje = diaAtual().offset === 0;
    var horas = [];
    if (!ehHoje) {
      for (var i = 0; i < 24; i++) horas.push(i);
    } else {
      var horaAtual = (new Date).getHours();
      for (var i = 0; i <= horaAtual; i++) horas.push(i);
    }
    document.getElementById("sem-dado-msg").style.display = sem ? "flex" : "none";
    currentHoras = horas;
    if (elHoraChip) {
      if (st.hora !== null) {
        var horaFmtada = (st.hora < 10 ? "0" : "") + st.hora + ":00";
        document.getElementById("hora-chip-label").textContent = "Hora: " + horaFmtada;
        elHoraChip.style.display = "flex";
      } else {
        elHoraChip.style.display = "none";
      }
    }
    setKPI("kpi-entrada", totE, semKPI);
    setKPI("kpi-dentro", totD, semKPI);
    setKPI("kpi-fora", totF, semKPI);
    setKPI("kpi-entrada-b", totE, semKPI);
    setKPI("kpi-dentro-b", totD, semKPI);
    setKPI("kpi-fora-b", totF, semKPI);
    var elPct = document.getElementById("kpi-pct");
    elPct.textContent = semKPI || pct === null ? "–" : pct + "%";
    elPct.className = "kpi-value" + (semKPI || pct === null ? "" : parseFloat(pct) >= slaObj.meta_pct ? " ok" : " nok");
    var elPctB = document.getElementById("kpi-pct-b");
    if (elPctB) {
      elPctB.textContent = semKPI || pct === null ? "–" : pct + "%";
      elPctB.className = "kpi-value" + (semKPI || pct === null ? "" : parseFloat(pct) >= slaObj.meta_pct ? " ok" : " nok");
    }
    setMetaKPI("kpi-meta");
    setMetaKPI("kpi-meta-b");
    if (semKPI || pct === null) {
      setStatusAtivo("neutral");
    } else {
      setStatusAtivo(parseFloat(pct) >= slaObj.meta_pct ? "ok" : "nok");
    }
    if (!sem) {
      if (st.sla === "12") {
        renderGraficoSLA18(horas, linhas, entradaLinhas);
      } else {
        var mapa = {};
        linhas.forEach((function(l) {
          if (!mapa[l.hora]) mapa[l.hora] = {
            entrada: 0,
            dentro: 0,
            fora: 0
          };
          mapa[l.hora].entrada += l.entrada || 0;
          mapa[l.hora].dentro += l.dentro || 0;
          mapa[l.hora].fora += l.fora || 0;
        }));
        var dArr = horas.map((function(h) {
          return (mapa[h] || {}).dentro || 0;
        }));
        var fArr = horas.map((function(h) {
          return (mapa[h] || {}).fora || 0;
        }));
        var eArr;
        if (temEntradaSeparada) {
          var mapaEntrada = {};
          entradaLinhas.forEach((function(l) {
            mapaEntrada[l.hora] = (mapaEntrada[l.hora] || 0) + (l.entrada || 0);
          }));
          eArr = horas.map((function(h) {
            return mapaEntrada[h] || 0;
          }));
        } else {
          eArr = horas.map((function(h) {
            return (mapa[h] || {}).entrada || 0;
          }));
        }
        var metaEhQtd = !!META_HORARIA[st.sla];
        var mArr = metaEhQtd ? horas.map((function(h) {
          return META_HORARIA[st.sla][h];
        })) : horas.map((function() {
          return slaObj.meta_pct;
        }));
        renderGrafico(horas, dArr, fArr, eArr, mArr, SLA_COM_META[st.sla], metaEhQtd);
      }
    }
    renderOrigem(slaObj, linhasKPI);
  }
  function setKPI(id, val, sem) {
    document.getElementById(id).textContent = sem ? "–" : val.toLocaleString("pt-BR");
  }
  function setMetaKPI(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var mensal = D.mensal && D.mensal[st.sla];
    var val = mensal ? mensal.pct_necessaria : null;
    if (val === null || val === undefined) {
      el.textContent = "–";
      el.className = "kpi-value meta";
      return;
    }
    el.textContent = val.toFixed(1).replace(".", ",") + "%";
    el.className = "kpi-value meta" + (val > 100 ? " nok" : "");
  }
  function renderGrafico(horas, dArr, fArr, eArr, mArr, comMeta, metaEhQtd) {
    var labels = horas.map((function(h) {
      return (h < 10 ? "0" : "") + h + ":00";
    }));
    var corD = horas.map((function(h) {
      return st.hora === null || h === st.hora ? "rgba(22,163,74,0.92)" : "rgba(22,163,74,0.22)";
    }));
    var corF = horas.map((function(h) {
      return st.hora === null || h === st.hora ? "rgba(220,38,38,0.90)" : "rgba(220,38,38,0.22)";
    }));
    var datasets = [ {
      type: "bar",
      label: "Dentro da Meta",
      data: dArr,
      backgroundColor: corD,
      borderWidth: 0,
      stack: "s",
      order: 2,
      yAxisID: "y",
      datalabels: {
        display: false
      }
    }, {
      type: "bar",
      label: "Atrasado",
      data: fArr,
      backgroundColor: corF,
      borderWidth: 0,
      stack: "s",
      order: 2,
      yAxisID: "y",
      datalabels: !temDataLabels ? {
        display: false
      } : {
        display: function(ctx) {
          var i = ctx.dataIndex;
          return dArr[i] + fArr[i] > 0;
        },
        formatter: function(val, ctx) {
          var i = ctx.dataIndex;
          return dArr[i] + fArr[i];
        },
        color: "#1f2233",
        font: {
          weight: "bold",
          size: 10,
          family: "'Inter',sans-serif"
        },
        anchor: "end",
        align: "top",
        offset: 2,
        clamp: true
      }
    }, {
      type: "line",
      label: "Entrada Total",
      data: eArr,
      borderColor: "#3d6be4",
      backgroundColor: "transparent",
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: "#3d6be4",
      tension: .35,
      fill: false,
      order: 1,
      yAxisID: "y2",
      datalabels: {
        display: false
      }
    } ];
    if (comMeta) {
      datasets.push({
        type: "line",
        label: metaEhQtd ? "Meta (capacidade/hora)" : "Meta %",
        data: mArr,
        borderColor: "#c8172f",
        borderWidth: 2.5,
        borderDash: [ 8, 5 ],
        pointRadius: 0,
        fill: false,
        order: 1,
        yAxisID: metaEhQtd ? "y" : "y2",
        suffix: metaEhQtd ? "" : " %",
        datalabels: {
          display: false
        }
      });
    }
    _renderChart(labels, datasets, true, "Entrada");
  }
  function renderGraficoSLA18(horas, linhas, entradaLinhas) {
    var labels = horas.map((function(h) {
      return (h < 10 ? "0" : "") + h + ":00";
    }));
    function buildMapaDentro(lines) {
      var m = {};
      lines.forEach((function(l) {
        if (!m[l.hora]) m[l.hora] = {
          dentro: 0
        };
        m[l.hora].dentro += l.dentro || 0;
      }));
      return m;
    }
    function buildMapaEntrada(lines) {
      var m = {};
      lines.forEach((function(l) {
        m[l.hora] = (m[l.hora] || 0) + (l.entrada || 0);
      }));
      return m;
    }
    var linhasEmp = linhas.filter((function(l) {
      return l.tipo === "Mecanizado";
    }));
    var linhasMan = linhas.filter((function(l) {
      return l.tipo === "Manual";
    }));
    var mapaDEmp = buildMapaDentro(linhasEmp);
    var mapaDMan = buildMapaDentro(linhasMan);
    var entradaEmp = (entradaLinhas || []).filter((function(l) {
      return l.tipo === "Mecanizado";
    }));
    var entradaMan = (entradaLinhas || []).filter((function(l) {
      return l.tipo === "Manual";
    }));
    var mapaEEmp = buildMapaEntrada(entradaEmp);
    var mapaEMan = buildMapaEntrada(entradaMan);
    var empDArr = horas.map((function(h) {
      return (mapaDEmp[h] || {}).dentro || 0;
    }));
    var manDArr = horas.map((function(h) {
      return (mapaDMan[h] || {}).dentro || 0;
    }));
    var empEArr = horas.map((function(h) {
      return mapaEEmp[h] || 0;
    }));
    var manEArr = horas.map((function(h) {
      return mapaEMan[h] || 0;
    }));
    var corEmp = horas.map((function(h) {
      return st.hora === null || h === st.hora ? "rgba(37,99,235,0.88)" : "rgba(37,99,235,0.22)";
    }));
    var corMan = horas.map((function(h) {
      return st.hora === null || h === st.hora ? "rgba(22,163,74,0.92)" : "rgba(22,163,74,0.22)";
    }));
    var datasets = [ {
      type: "bar",
      label: "Dentro (Mecanizado)",
      data: empDArr,
      backgroundColor: corEmp,
      borderWidth: 0,
      order: 2,
      yAxisID: "y",
      datalabels: !temDataLabels ? {
        display: false
      } : {
        display: function(ctx) {
          return empDArr[ctx.dataIndex] > 0;
        },
        formatter: function(val) {
          return val;
        },
        color: "#1f2233",
        font: {
          weight: "bold",
          size: 10,
          family: "'Inter',sans-serif"
        },
        anchor: "end",
        align: "top",
        offset: 2,
        clamp: true
      }
    }, {
      type: "bar",
      label: "Dentro (Manual)",
      data: manDArr,
      backgroundColor: corMan,
      borderWidth: 0,
      order: 2,
      yAxisID: "y",
      datalabels: !temDataLabels ? {
        display: false
      } : {
        display: function(ctx) {
          return manDArr[ctx.dataIndex] > 0;
        },
        formatter: function(val) {
          return val;
        },
        color: "#1f2233",
        font: {
          weight: "bold",
          size: 10,
          family: "'Inter',sans-serif"
        },
        anchor: "end",
        align: "top",
        offset: 2,
        clamp: true
      }
    }, {
      type: "line",
      label: "Entrada Mecanizado",
      data: empEArr,
      borderColor: "#1a5fa8",
      backgroundColor: "transparent",
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: "#1a5fa8",
      tension: .35,
      fill: false,
      order: 1,
      yAxisID: "y2",
      datalabels: {
        display: false
      }
    }, {
      type: "line",
      label: "Entrada Manual",
      data: manEArr,
      borderColor: "#1c8a4f",
      backgroundColor: "transparent",
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: "#1c8a4f",
      tension: .35,
      fill: false,
      order: 1,
      yAxisID: "y2",
      datalabels: {
        display: false
      }
    } ];
    _renderChart(labels, datasets, false);
  }
  function _niceCeil(maxValue, targetTicks) {
    targetTicks = targetTicks || 5;
    if (!isFinite(maxValue) || maxValue <= 0) return targetTicks;
    var rawStep = maxValue / targetTicks;
    var mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    var norm = rawStep / mag;
    var niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    var step = niceNorm * mag;
    return Math.ceil(maxValue / step) * step;
  }
  function _renderChart(labels, datasets, stacked, tituloY2) {
    var mob = ehMobile();
    var fonteEixo = mob ? 9 : 11;
    var somaY = labels.map((function() {
      return 0;
    }));
    var maxY2 = 0;
    datasets.forEach((function(ds) {
      var vals = ds.data || [];
      if (ds.yAxisID === "y2") {
        vals.forEach((function(v) {
          if (typeof v === "number" && v > maxY2) maxY2 = v;
        }));
      } else {
        vals.forEach((function(v, i) {
          if (typeof v !== "number") return;
          if (stacked && ds.type === "bar") somaY[i] += v; else somaY[i] = Math.max(somaY[i], v);
        }));
      }
    }));
    var maxY = somaY.reduce((function(m, v) {
      return Math.max(m, v);
    }), 0);
    var eixoMax = _niceCeil(Math.max(maxY, maxY2, 1));
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 200
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      onClick: function(evt, elements) {
        var barEl = null;
        for (var i = 0; i < (elements || []).length; i++) {
          var ds = chart && chart.data.datasets[elements[i].datasetIndex];
          if (ds && ds.type === "bar") {
            barEl = elements[i];
            break;
          }
        }
        if (!barEl) {
          if (st.hora !== null) {
            st.hora = null;
            render();
          }
          return;
        }
        var hora = currentHoras[barEl.index];
        if (hora === undefined) return;
        st.hora = st.hora === hora ? null : hora;
        render();
      },
      onHover: function(evt, elements) {
        var temBarra = (elements || []).some((function(e) {
          var ds = chart && chart.data.datasets[e.datasetIndex];
          return ds && ds.type === "bar";
        }));
        if (evt.native && evt.native.target) {
          evt.native.target.style.cursor = temBarra ? "pointer" : "default";
        }
      },
      layout: {
        padding: {
          top: mob ? 14 : 22
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
          callbacks: {
            label: function(ctx) {
              var v = ctx.parsed.y;
              if (ctx.dataset.yAxisID === "y2") return " " + ctx.dataset.label + ": " + v + (ctx.dataset.suffix || "");
              return " " + ctx.dataset.label + ": " + v.toLocaleString("pt-BR");
            }
          }
        },
        datalabels: temDataLabels ? mob ? {
          display: false
        } : {
          clip: false
        } : false
      },
      scales: {
        x: {
          stacked: stacked,
          grid: {
            color: "rgba(0,0,0,0.04)"
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: fonteEixo
            },
            maxRotation: mob ? 90 : 0,
            minRotation: mob ? 90 : 0
          }
        },
        y: {
          stacked: stacked,
          position: "left",
          min: 0,
          max: eixoMax,
          grid: {
            color: "rgba(0,0,0,0.05)"
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: fonteEixo
            },
            precision: 0
          },
          title: {
            display: !mob,
            text: "Qtd Cargas",
            color: "#7c8194",
            font: {
              size: fonteEixo
            }
          }
        },
        y2: {
          position: "right",
          min: 0,
          max: eixoMax,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: fonteEixo
            }
          },
          title: {
            display: !mob,
            text: tituloY2 || "Entrada",
            color: "#7c8194",
            font: {
              size: fonteEixo
            }
          }
        }
      }
    };
    var PX_POR_BARRA = 46;
    var wrap = document.getElementById("chart-scroll-wrap");
    if (wrap) wrap.style.width = "max(100%, " + labels.length * PX_POR_BARRA + "px)";
    var canvas = document.getElementById("grafico-main");
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.options = opts;
      chart.update();
    } else {
      chart = new Chart(canvas, {
        data: {
          labels: labels,
          datasets: datasets
        },
        options: opts
      });
    }
  }
  function renderOrigem(slaObj, linhasAtivas) {
    var tbl = document.getElementById("origem-table");
    var hdr = document.querySelector(".origem-header");
    var slaId = st.sla;
    if (SLA_SEM_PIVOT[slaId]) {
      if (hdr) hdr.style.display = "none";
      tbl.innerHTML = "";
      return;
    }
    if (hdr) hdr.style.display = "";
    var titulo = SLA_DESTINO[slaId] ? "Destino" : "Origem";
    var sufixo = "";
    if (st.hora !== null) {
      sufixo = " · " + (st.hora < 10 ? "0" : "") + st.hora + ":00";
    } else if (st.turno) {
      sufixo = " · Turno " + st.turno;
    }
    if (hdr) hdr.textContent = titulo + sufixo;
    var camposGrupo = [ "destino", "origem", "grupo", "cd_destino", "cd_origem" ];
    var campoGrupo = null;
    var amostra = linhasAtivas[0] || (slaObj.linhas || [])[0];
    if (amostra) {
      for (var ci = 0; ci < camposGrupo.length; ci++) {
        if (amostra[camposGrupo[ci]] !== undefined) {
          campoGrupo = camposGrupo[ci];
          break;
        }
      }
    }
    if (campoGrupo && linhasAtivas.length > 0) {
      var grupos = {};
      linhasAtivas.forEach((function(l) {
        var g = l[campoGrupo] || "(sem info)";
        if (!grupos[g]) grupos[g] = {
          dentro: 0,
          fora: 0
        };
        grupos[g].dentro += l.dentro || 0;
        grupos[g].fora += l.fora || 0;
      }));
      var gKeys = Object.keys(grupos).sort();
      var rowLabel = slaId === "01" ? "STATUS CONFERÊNCIA" : "SLA FORA";
      var h = "<thead><tr><th>" + rowLabel + "</th>";
      gKeys.forEach((function(g) {
        h += "<th>" + g + "</th>";
      }));
      h += "<th>TOTAL</th></tr></thead><tbody>";
      var rD = "<tr><td>DENTRO DA META</td>";
      var rF = "<tr><td>FORA DA META</td>";
      var rT = "<tr><td>TOTAL</td>";
      var colTotD = 0, colTotF = 0;
      gKeys.forEach((function(g) {
        rD += "<td>" + grupos[g].dentro + "</td>";
        rF += "<td>" + grupos[g].fora + "</td>";
        rT += "<td>" + (grupos[g].dentro + grupos[g].fora) + "</td>";
        colTotD += grupos[g].dentro;
        colTotF += grupos[g].fora;
      }));
      rD += "<td>" + colTotD + "</td>";
      rF += "<td>" + colTotF + "</td>";
      rT += "<td>" + (colTotD + colTotF) + "</td>";
      tbl.innerHTML = h + rD + "</tr>" + rF + "</tr>" + rT + "</tr>" + "</tbody>";
      return;
    }
    var origemFiltrada = null;
    if (st.turno && slaObj.origem_turnos && slaObj.origem_turnos[st.turno]) {
      origemFiltrada = slaObj.origem_turnos[st.turno];
    }
    var origem = origemFiltrada || slaObj.origem;
    if (!origem || !origem.destinos || origem.destinos.length === 0) {
      tbl.innerHTML = '<thead><tr><th>STATUS</th><th style="color:var(--text-mid);font-style:italic;font-weight:400">Sem dado</th></tr></thead>';
      return;
    }
    var rowLabel = slaId === "01" ? "STATUS CONFERÊNCIA" : "SLA FORA";
    var ds = origem.destinos, di = origem.dentro, fo = origem.fora;
    var h = "<thead><tr><th>" + rowLabel + "</th>";
    ds.forEach((function(d) {
      h += "<th>" + d + "</th>";
    }));
    h += "<th>TOTAL</th></tr></thead><tbody>";
    var rD = "<tr><td>DENTRO DA META</td>";
    var rF = "<tr><td>FORA DA META</td>";
    var rT = "<tr><td>TOTAL</td>";
    var colTotD = 0, colTotF = 0;
    ds.forEach((function(_, i) {
      rD += "<td>" + (di[i] || 0) + "</td>";
      rF += "<td>" + (fo[i] || 0) + "</td>";
      rT += "<td>" + ((di[i] || 0) + (fo[i] || 0)) + "</td>";
      colTotD += di[i] || 0;
      colTotF += fo[i] || 0;
    }));
    rD += "<td>" + colTotD + "</td>";
    rF += "<td>" + colTotF + "</td>";
    rT += "<td>" + (colTotD + colTotF) + "</td>";
    tbl.innerHTML = h + rD + "</tr>" + rF + "</tr>" + rT + "</tr>" + "</tbody>";
  }
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
      if (chart) {
        chart.resize();
      }
    }), 150);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
})();
