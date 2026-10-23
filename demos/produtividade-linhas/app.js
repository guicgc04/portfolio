(function() {
  "use strict";
  var temDataLabels = typeof ChartDataLabels !== "undefined";
  if (temDataLabels) Chart.register(ChartDataLabels);
  var D = window.DADOS_LINHAS;
  if (!D) {
    document.body.innerHTML = '<p style="padding:40px;color:red">Erro: data.js não carregado.</p>';
    return;
  }
  var MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";
  function ehMobile() {
    return window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches;
  }
  var COR = {
    dentro: "rgba(22,163,74,0.92)",
    dentroFraca: "rgba(22,163,74,0.22)",
    fora: "rgba(220,38,38,0.90)",
    foraFraca: "rgba(220,38,38,0.22)",
    entrada: "#3d6be4",
    volume: "#b8860b"
  };
  var META = D.meta_pct || 95;
  var META_HORARIA_SLA01 = [ 120, 110, 100, 100, 110, 120, 140, 170, 190, 200, 210, 200, 180, 180, 190, 200, 200, 190, 170, 160, 150, 140, 130, 120 ];
  var st = {
    aba: "geral",
    dia: null,
    turno: "",
    tipo: "",
    hora: null,
    ocultar: {
      entrada: false,
      meta: false,
      volume: false
    }
  };
  var chart = null, elFollow = null, elHoraChip = null, currentHoras = [];
  var dropdowns = [];
  document.getElementById("updated-tag").textContent = "Atualizado em:\n" + (D.atualizado_em || "–");
  buildSeletorDia();
  buildFooter();
  buildHoraChip();
  bindSelects();
  montarDropdown(document.getElementById("sel-dia"), "Dia");
  montarDropdown(document.getElementById("sel-turno"), "Turno");
  montarDropdown(document.getElementById("sel-tipo"), "Tipo de lote");
  activateAba("geral");
  function diaAtual() {
    return D.dias && D.dias[st.dia] || {
      rec: [],
      ent: [],
      plts: [],
      viagens: []
    };
  }
  function buildSeletorDia() {
    var sel = document.getElementById("sel-dia");
    var chaves = Object.keys(D.dias || {}).sort((function(a, b) {
      return (D.dias[a].offset || 0) - (D.dias[b].offset || 0);
    }));
    if (!chaves.length) return;
    st.dia = chaves[0];
    sel.innerHTML = "";
    chaves.forEach((function(k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = D.dias[k].offset === 0 ? "Hoje" : (D.dias[k].data || "").slice(0, 5);
      sel.appendChild(o);
    }));
    sel.value = st.dia;
    sel.addEventListener("change", (function() {
      st.dia = sel.value;
      st.hora = null;
      activateAba(st.aba);
    }));
  }
  document.querySelectorAll(".leg-toggle").forEach((function(btn) {
    btn.addEventListener("click", (function() {
      var serie = btn.dataset.serie;
      st.ocultar[serie] = !st.ocultar[serie];
      btn.setAttribute("aria-pressed", st.ocultar[serie] ? "false" : "true");
      render();
    }));
  }));
  function bindSelects() {
    document.getElementById("sel-turno").addEventListener("change", (function() {
      st.turno = this.value;
      render();
    }));
    document.getElementById("sel-tipo").addEventListener("change", (function() {
      st.tipo = this.value;
      render();
    }));
  }
  function montarDropdown(sel, rotulo) {
    if (!sel) return;
    var SETA_SVG = '<svg class="dd-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' + 'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + '<polyline points="6 9 12 15 18 9"/></svg>';
    var wrap = document.createElement("div");
    wrap.className = "dd" + (sel.classList.contains("day-select") ? " dd-dia" : "");
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="dd-txt"></span>' + SETA_SVG;
    wrap.appendChild(btn);
    var menu = document.createElement("ul");
    menu.className = "dd-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", rotulo);
    menu.hidden = true;
    document.body.appendChild(menu);
    function atual() {
      return sel.options[sel.selectedIndex];
    }
    function sync() {
      var o = atual();
      btn.querySelector(".dd-txt").textContent = o ? o.textContent : "–";
      btn.setAttribute("aria-label", rotulo + ": " + (o ? o.textContent : "–"));
    }
    function itens() {
      return Array.prototype.slice.call(menu.querySelectorAll(".dd-opt"));
    }
    function montarItens() {
      menu.innerHTML = "";
      Array.prototype.forEach.call(sel.options, (function(o, i) {
        var li = document.createElement("li");
        var ativo = i === sel.selectedIndex;
        li.className = "dd-opt" + (ativo ? " ativo" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", ativo ? "true" : "false");
        li.tabIndex = -1;
        li.textContent = o.textContent;
        li.addEventListener("click", (function() {
          escolher(o.value);
        }));
        menu.appendChild(li);
      }));
    }
    function posicionar() {
      var r = btn.getBoundingClientRect();
      menu.style.minWidth = Math.max(r.width, 140) + "px";
      menu.style.left = r.left + "px";
      menu.style.top = r.bottom + 6 + "px";
      var h = menu.offsetHeight, w = menu.offsetWidth;
      if (r.bottom + 6 + h > window.innerHeight - 8 && r.top - 6 - h >= 8) {
        menu.style.top = r.top - 6 - h + "px";
      }
      if (r.left + w > window.innerWidth - 8) {
        menu.style.left = Math.max(8, window.innerWidth - 8 - w) + "px";
      }
    }
    function abrir() {
      fecharDropdowns();
      montarItens();
      menu.hidden = false;
      posicionar();
      wrap.classList.add("aberto");
      btn.setAttribute("aria-expanded", "true");
      var a = menu.querySelector(".dd-opt.ativo") || menu.querySelector(".dd-opt");
      if (a) a.focus({
        preventScroll: true
      });
    }
    function fechar(devolverFoco) {
      if (menu.hidden) return;
      menu.hidden = true;
      wrap.classList.remove("aberto");
      btn.setAttribute("aria-expanded", "false");
      if (devolverFoco) btn.focus({
        preventScroll: true
      });
    }
    function escolher(valor) {
      fechar(true);
      if (sel.value !== valor) {
        sel.value = valor;
        sel.dispatchEvent(new Event("change"));
      }
      sync();
    }
    btn.addEventListener("click", (function() {
      if (menu.hidden) abrir(); else fechar(true);
    }));
    btn.addEventListener("keydown", (function(e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        abrir();
      }
    }));
    menu.addEventListener("keydown", (function(e) {
      var lista = itens(), i = lista.indexOf(document.activeElement);
      var ir = function(el) {
        if (el) {
          el.focus({
            preventScroll: true
          });
          el.scrollIntoView({
            block: "nearest"
          });
        }
      };
      if (e.key === "ArrowDown") {
        e.preventDefault();
        ir(lista[i + 1] || lista[0]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        ir(lista[i - 1] || lista[lista.length - 1]);
      } else if (e.key === "Home") {
        e.preventDefault();
        ir(lista[0]);
      } else if (e.key === "End") {
        e.preventDefault();
        ir(lista[lista.length - 1]);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (i >= 0) escolher(sel.options[i].value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar(true);
      } else if (e.key === "Tab") {
        fechar(false);
      }
    }));
    sel.addEventListener("change", sync);
    function acompanhar() {
      if (menu.hidden) return;
      var r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) fechar(false); else posicionar();
    }
    dropdowns.push({
      wrap: wrap,
      menu: menu,
      fechar: fechar,
      acompanhar: acompanhar
    });
    sync();
  }
  function fecharDropdowns() {
    dropdowns.forEach((function(d) {
      d.fechar(false);
    }));
  }
  document.addEventListener("mousedown", (function(e) {
    dropdowns.forEach((function(d) {
      if (!d.wrap.contains(e.target) && !d.menu.contains(e.target)) d.fechar(false);
    }));
  }));
  document.addEventListener("touchstart", (function(e) {
    dropdowns.forEach((function(d) {
      if (!d.wrap.contains(e.target) && !d.menu.contains(e.target)) d.fechar(false);
    }));
  }), {
    passive: true
  });
  function acompanharDropdowns() {
    dropdowns.forEach((function(d) {
      d.acompanhar();
    }));
  }
  window.addEventListener("scroll", acompanharDropdowns, true);
  window.addEventListener("resize", acompanharDropdowns);
  function filtrar(rows, opts) {
    opts = opts || {};
    var linha = opts.linha !== undefined ? opts.linha : st.aba === "geral" ? null : st.aba;
    return (rows || []).filter((function(r) {
      if (linha && r.l !== linha) return false;
      if (st.turno && r.t !== st.turno) return false;
      if (st.tipo && r.k !== undefined && r.k !== st.tipo) return false;
      if (st.tipo && r.cls !== undefined && r.cls !== st.tipo) return false;
      if (!opts.semHora && st.hora !== null && r.h !== st.hora) return false;
      return true;
    }));
  }
  function totais(linha) {
    var dia = diaAtual();
    var o = linha !== undefined ? {
      linha: linha
    } : {};
    var t = {
      rec: 0,
      den: 0,
      fora: 0,
      am: 0,
      bt: 0,
      vol: 0,
      peso: 0,
      plts: 0,
      viagens: 0,
      despAm: null,
      despBt: null
    };
    filtrar(dia.rec, o).forEach((function(r) {
      t.rec += r.rec;
      t.den += r.den;
      t.fora += r.fora;
      t.vol += r.vol;
      t.peso += r.peso;
      if (r.k === "Fechada") t.am += r.rec; else t.bt += r.rec;
    }));
    var fisicas = {};
    pltsDoRecorte(filtrar(dia.plt_h, o)).forEach((function(u) {
      var k = u.doc + "|" + u.plt;
      var f = fisicas[k] || (fisicas[k] = {
        desp: u.desp,
        am: 0,
        bt: 0
      });
      f.am += u.am;
      f.bt += u.bt;
    }));
    var plts = Object.keys(fisicas).map((function(k) {
      var f = fisicas[k];
      return {
        desp: f.desp,
        cls: f.am && f.bt ? "Mista" : f.am ? "Fechada" : "Fracionada"
      };
    }));
    t.plts = plts.length;
    t.despAm = media(plts.filter((function(u) {
      return u.cls === "Fechada";
    })));
    t.despBt = media(plts.filter((function(u) {
      return u.cls === "Fracionada";
    })));
    var termos = {};
    filtrar(dia.viagens, o).forEach((function(v) {
      termos[v.doc] = true;
    }));
    t.viagens = Object.keys(termos).length;
    t.pct = t.den + t.fora > 0 ? t.den / (t.den + t.fora) * 100 : null;
    return t;
  }
  function pltsDoRecorte(linhas) {
    var cad = diaAtual().plts || [], por = {};
    linhas.forEach((function(r) {
      var o = por[r.i];
      if (!o) {
        o = por[r.i] = Object.assign({}, cad[r.i], {
          lote: 0,
          vol: 0,
          den: 0,
          fora: 0
        });
      }
      o.lote += r.lote;
      o.vol += r.vol;
      o.den += r.den;
      o.fora += r.fora;
    }));
    return Object.keys(por).map((function(k) {
      return por[k];
    }));
  }
  function media(plts) {
    var vals = plts.map((function(u) {
      return u.desp;
    })).filter((function(v) {
      return v !== null && v !== undefined;
    }));
    if (!vals.length) return null;
    return vals.reduce((function(a, b) {
      return a + b;
    }), 0) / vals.length;
  }
  function buildFooter() {
    var bar = document.getElementById("tab-bar");
    bar.innerHTML = "";
    elFollow = document.createElement("div");
    elFollow.className = "tab-follow";
    bar.appendChild(elFollow);
    [ {
      id: "geral",
      txt: "Geral"
    } ].concat((D.linhas || []).map((function(l) {
      return {
        id: l,
        txt: "Linha " + l
      };
    }))).forEach((function(a) {
      var btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.aba = a.id;
      btn.innerHTML = a.id === "geral" ? a.txt : '<span class="tab-l1">Linha</span> <span class="tab-l2">' + a.id + "</span>";
      btn.addEventListener("click", (function() {
        activateAba(a.id);
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
    elFollow.style.left = btnA.offsetLeft + btnA.offsetWidth / 2 - largura / 2 + "px";
  }
  function setStatusAtivo(status) {
    var bar = document.getElementById("tab-bar");
    var btnA = document.querySelector("#tab-bar .tab-btn.active");
    [ bar, elFollow, btnA ].forEach((function(el) {
      if (!el) return;
      el.classList.remove("status-ok", "status-nok", "status-neutral");
      el.classList.add("status-" + status);
    }));
  }
  function activateAba(id) {
    st.aba = id;
    st.hora = null;
    document.querySelectorAll("#tab-bar .tab-btn").forEach((function(b) {
      b.classList.toggle("active", b.dataset.aba === id);
      b.classList.remove("status-ok", "status-nok", "status-neutral");
    }));
    var btnA = document.querySelector('#tab-bar .tab-btn[data-aba="' + id + '"]');
    if (btnA) btnA.scrollIntoView({
      inline: "center",
      block: "nearest"
    });
    positionFollow();
    var info = diaAtual();
    var diaLabel = info.offset === 0 ? "Hoje" : info.data;
    var abaLabel = id === "geral" ? "Todas as linhas" : "Linha " + id;
    document.getElementById("header-subtitle").textContent = "SLA 01 · Conferência de recebimento — META " + fmtNum(META, 0) + "% · " + abaLabel + " · " + (diaLabel || "–");
    document.getElementById("leg-meta").style.display = id === "geral" ? "" : "none";
    render();
  }
  function buildHoraChip() {
    var chip = document.createElement("div");
    chip.className = "hora-chip";
    chip.innerHTML = '<span id="hora-chip-label"></span><button type="button" title="Limpar filtro de hora">&times;</button>';
    chip.querySelector("button").addEventListener("click", (function() {
      st.hora = null;
      render();
    }));
    var leg = document.getElementById("legend");
    leg.parentNode.insertBefore(chip, leg.nextSibling);
    elHoraChip = chip;
  }
  function render() {
    var dia = diaAtual();
    var t = totais();
    var sem = t.rec === 0;
    var elPct = document.getElementById("kpi-pct");
    elPct.textContent = t.pct === null ? "–" : fmtNum(t.pct, 1) + "%";
    elPct.className = "kpi-value" + (t.pct === null ? "" : t.pct >= META ? " ok" : " nok");
    setTxt("kpi-rec", sem ? "–" : fmtNum(t.rec, 0));
    setTxt("kpi-den", sem ? "–" : fmtNum(t.den, 0));
    setTxt("kpi-fora", sem ? "–" : fmtNum(t.fora, 0));
    setTxt("kpi-am", sem ? "–" : fmtNum(t.am, 0));
    setTxt("kpi-bt", sem ? "–" : fmtNum(t.bt, 0));
    var pctAm = sem ? 0 : t.am / t.rec * 100;
    setTxt("kpi-am-pct", sem ? "" : fmtNum(pctAm, 0) + "% fechada");
    setTxt("kpi-bt-pct", sem ? "" : fmtNum(100 - pctAm, 0) + "% fracionada");
    document.getElementById("tipo-am").style.width = pctAm + "%";
    setTxt("kpi-plts", sem ? "–" : fmtNum(t.plts, 0));
    setTxt("kpi-viagens", sem ? "–" : fmtNum(t.viagens, 0));
    setStatusAtivo(t.pct === null ? "neutral" : t.pct >= META ? "ok" : "nok");
    if (st.hora !== null) {
      document.getElementById("hora-chip-label").textContent = "Hora: " + fmtHora(st.hora);
      elHoraChip.style.display = "flex";
    } else {
      elHoraChip.style.display = "none";
    }
    var horas = [];
    var ultimaHora = dia.offset === 0 ? (new Date).getHours() : 23;
    for (var h = 0; h <= ultimaHora; h++) horas.push(h);
    currentHoras = horas;
    var recDia = filtrar(dia.rec, {
      semHora: true
    });
    var entDia = filtrar(dia.ent, {
      semHora: true
    });
    var semGrafico = recDia.length === 0 && entDia.length === 0;
    document.getElementById("sem-dado-msg").style.display = semGrafico ? "flex" : "none";
    var zero = horas.map((function() {
      return 0;
    }));
    var den = zero.slice(), fora = zero.slice(), am = zero.slice(), bt = zero.slice(), ent = zero.slice(), vol = zero.slice();
    recDia.forEach((function(r) {
      var i = horas.indexOf(r.h);
      if (i < 0) return;
      den[i] += r.den;
      fora[i] += r.fora;
      vol[i] += r.vol;
      if (r.k === "Fechada") am[i] += r.rec; else bt[i] += r.rec;
    }));
    entDia.forEach((function(r) {
      var i = horas.indexOf(r.h);
      if (i >= 0) ent[i] += r.ent;
    }));
    renderGrafico(horas, den, fora, ent, am, bt, vol);
    if (st.aba === "geral") renderTabelaLinhas(); else renderTabelaPlts();
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
  function renderGrafico(horas, den, fora, ent, am, bt, vol) {
    var mob = ehMobile();
    var fonteEixo = mob ? 9 : 11;
    var labels = horas.map(fmtHora);
    var ativa = function(h) {
      return st.hora === null || h === st.hora;
    };
    var comMeta = st.aba === "geral";
    var mostraMeta = comMeta && !st.ocultar.meta;
    var mostraEnt = !st.ocultar.entrada;
    var mostraVol = !st.ocultar.volume;
    var eixoVolMax = _niceCeil(Math.max.apply(null, vol.concat([ 1 ])) * 1.08);
    var meta = horas.map((function(h) {
      return META_HORARIA_SLA01[h];
    }));
    var maxY = 0;
    horas.forEach((function(_, i) {
      maxY = Math.max(maxY, den[i] + fora[i], mostraEnt ? ent[i] : 0, mostraMeta ? meta[i] : 0);
    }));
    var eixoMax = _niceCeil(Math.max(maxY, 1) * 1.08);
    var datasets = [ {
      type: "bar",
      label: "Dentro da Meta",
      data: den,
      stack: "s",
      order: 3,
      yAxisID: "y",
      borderWidth: 0,
      maxBarThickness: 44,
      backgroundColor: horas.map((function(h) {
        return ativa(h) ? COR.dentro : COR.dentroFraca;
      })),
      datalabels: {
        display: false
      }
    }, {
      type: "bar",
      label: "Atrasado",
      data: fora,
      stack: "s",
      order: 3,
      yAxisID: "y",
      borderWidth: 0,
      maxBarThickness: 44,
      backgroundColor: horas.map((function(h) {
        return ativa(h) ? COR.fora : COR.foraFraca;
      })),
      datalabels: !temDataLabels ? {
        display: false
      } : {
        display: function(ctx) {
          return !mob && den[ctx.dataIndex] + fora[ctx.dataIndex] > 0;
        },
        formatter: function(v, ctx) {
          return den[ctx.dataIndex] + fora[ctx.dataIndex];
        },
        color: "#1f2233",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 4,
        padding: {
          top: 1,
          bottom: 1,
          left: 4,
          right: 4
        },
        font: {
          weight: "bold",
          size: 10,
          family: "'Inter',sans-serif"
        },
        anchor: "end",
        align: "top",
        offset: 3,
        clamp: true
      }
    } ];
    if (mostraEnt) {
      datasets.push({
        type: "line",
        label: "Entrada total (chegada)",
        data: ent,
        order: 1,
        yAxisID: "y",
        stack: "entrada",
        borderColor: COR.entrada,
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: COR.entrada,
        pointBorderWidth: 1.5,
        tension: .25,
        fill: false,
        datalabels: {
          display: false
        }
      });
    }
    if (mostraVol) {
      datasets.push({
        type: "line",
        label: "Volumes recebidos",
        data: vol,
        order: 0,
        yAxisID: "yVol",
        stack: "volume",
        borderColor: COR.volume,
        backgroundColor: "transparent",
        borderWidth: 2,
        pointStyle: "rectRot",
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: COR.volume,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1,
        tension: .25,
        fill: false,
        datalabels: {
          display: false
        }
      });
    }
    if (mostraMeta) {
      datasets.push({
        type: "line",
        label: "Meta (capacidade/hora)",
        data: meta,
        order: 2,
        yAxisID: "y",
        stack: "meta",
        borderColor: "#c8172f",
        borderWidth: 2,
        borderDash: [ 6, 4 ],
        pointRadius: 0,
        pointHoverRadius: 0,
        stepped: "middle",
        fill: false,
        datalabels: {
          display: false
        }
      });
    }
    var ORDEM_TOOLTIP = {
      "Dentro da Meta": 0,
      Atrasado: 1,
      "Entrada total (chegada)": 2,
      "Meta (capacidade/hora)": 3,
      "Volumes recebidos": 4
    };
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
        (elements || []).some((function(e) {
          var ds = chart && chart.data.datasets[e.datasetIndex];
          if (ds && ds.type === "bar") {
            barEl = e;
            return true;
          }
          return false;
        }));
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
        if (evt.native && evt.native.target) evt.native.target.style.cursor = temBarra ? "pointer" : "default";
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
          titleColor: "#ffffff",
          bodyColor: "#d6d9e6",
          footerColor: "#b8bccf",
          padding: 10,
          titleFont: {
            size: 12,
            weight: "bold"
          },
          footerFont: {
            size: 11,
            weight: "normal"
          },
          boxPadding: 4,
          itemSort: function(a, b) {
            return ORDEM_TOOLTIP[a.dataset.label] - ORDEM_TOOLTIP[b.dataset.label];
          },
          callbacks: {
            title: function(items) {
              var h = horas[items.length ? items[0].dataIndex : 0];
              return "Conferência " + fmtHora(h) + " – " + (h < 10 ? "0" : "") + h + ":59";
            },
            label: function(ctx) {
              var i = ctx.dataIndex, v = ctx.parsed.y, tot = den[i] + fora[i], lbl = ctx.dataset.label;
              if (lbl === "Dentro da Meta") return " Dentro da Meta: " + fmtNum(v, 0) + (tot ? "  (" + fmtNum(v / tot * 100, 1) + "%)" : "");
              if (lbl === "Atrasado") return " Atrasado: " + fmtNum(v, 0);
              if (lbl === "Entrada total (chegada)") return " Entrada na chegada: " + fmtNum(v, 0);
              if (lbl === "Volumes recebidos") return " Volumes recebidos: " + fmtNum(v, 0);
              if (lbl === "Meta (capacidade/hora)") {
                var dif = tot - v;
                return " Meta: " + fmtNum(v, 0) + "/h  (" + (dif >= 0 ? "+" : "") + fmtNum(dif, 0) + " vs. meta)";
              }
              return " " + lbl + ": " + fmtNum(v, 0);
            },
            footer: function(items) {
              var i = items.length ? items[0].dataIndex : -1;
              if (i < 0) return "";
              return "Recebidos: " + fmtNum(am[i] + bt[i], 0) + "  ·  Fechada " + fmtNum(am[i], 0) + "  ·  Fracionada " + fmtNum(bt[i], 0);
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
          stacked: true,
          grid: {
            display: false
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
          stacked: true,
          position: "left",
          min: 0,
          max: eixoMax,
          border: {
            display: false
          },
          grid: {
            color: "rgba(0,0,0,0.06)"
          },
          ticks: {
            color: "#7c8194",
            font: {
              size: fonteEixo
            },
            precision: 0,
            maxTicksLimit: 6
          },
          title: {
            display: !mob,
            text: "Lotes",
            color: "#7c8194",
            font: {
              size: fonteEixo
            }
          }
        },
        yVol: {
          display: mostraVol,
          position: "right",
          min: 0,
          max: eixoVolMax,
          border: {
            display: false
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: COR.volume,
            font: {
              size: fonteEixo
            },
            precision: 0,
            maxTicksLimit: 6
          },
          title: {
            display: !mob,
            text: "Volumes",
            color: COR.volume,
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
  function renderTabelaLinhas() {
    document.getElementById("tabela-titulo").textContent = "Desempenho por linha";
    var tbl = document.getElementById("tabela-main");
    tbl.className = "origem-table tabela-linhas";
    var h = "<thead><tr><th>Linha</th><th>Lotes</th><th>Fechada / Fracionada</th>" + "<th>Paletes</th><th>Viagens</th><th>Volumes</th><th>Peso (t)</th>" + "<th>Descarga fechada</th><th>Descarga fracionada</th><th>% Atendimento</th></tr></thead><tbody>";
    (D.linhas || []).forEach((function(l) {
      var t = totais(l);
      h += '<tr class="linha-click" data-linha="' + l + '"><td>Linha ' + l + "</td>" + celulasLinha(t) + "</tr>";
    }));
    var g = totais(null);
    h += "<tr><td>Total</td>" + celulasLinha(g) + "</tr></tbody>";
    tbl.innerHTML = h;
    tbl.querySelectorAll("tr.linha-click").forEach((function(tr) {
      tr.addEventListener("click", (function() {
        activateAba(tr.dataset.linha);
      }));
    }));
  }
  function celulasLinha(t) {
    if (t.rec === 0) {
      return "<td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td>";
    }
    return "<td>" + fmtNum(t.rec, 0) + "</td>" + celulaTipo(t.am, t.bt) + "<td>" + fmtNum(t.plts, 0) + "</td>" + "<td>" + fmtNum(t.viagens, 0) + "</td>" + "<td>" + fmtNum(t.vol, 0) + "</td>" + "<td>" + fmtNum(t.peso / 1e3, 1) + "</td>" + "<td>" + fmtMin(t.despAm) + "</td>" + "<td>" + fmtMin(t.despBt) + "</td>" + celulaPct(t.pct);
  }
  function horaCurta(v) {
    if (!v) return null;
    var ddmm = (diaAtual().data || "").slice(0, 5);
    return v.slice(0, 5) === ddmm ? v.slice(6) : v;
  }
  function faixaHoras(a, b) {
    if (!a && !b) return "–";
    if (!b || a === b) return horaCurta(a) || horaCurta(b);
    return horaCurta(a) + " – " + (a && b && a.slice(0, 5) === b.slice(0, 5) ? b.slice(6) : horaCurta(b));
  }
  function textoCarga(am, bt) {
    return am && bt ? "Mista (" + am + " A / " + bt + " B)" : am ? "Fechada" : "Fracionada";
  }
  function soltasPorVoo(dia) {
    var porTermo = {};
    filtrar(dia.soltas).forEach((function(x) {
      var o = porTermo[x.doc] || (porTermo[x.doc] = {
        doc: x.doc,
        lote: 0,
        am: 0,
        bt: 0,
        den: 0,
        fora: 0,
        vol: 0
      });
      o.lote += x.lote;
      o.den += x.den;
      o.fora += x.fora;
      o.vol += x.vol;
      if (x.k === "Fechada") o.am += x.lote; else o.bt += x.lote;
    }));
    return Object.keys(porTermo).map((function(k) {
      return porTermo[k];
    }));
  }
  function renderTabelaPlts() {
    document.getElementById("tabela-titulo").textContent = "Paletes recebidos na linha " + st.aba;
    var tbl = document.getElementById("tabela-main");
    tbl.className = "origem-table tabela-plts";
    var dia = diaAtual();
    var plts = pltsDoRecorte(filtrar(dia.plt_h)).sort((function(a, b) {
      var oa = a.ord || "99", ob = b.ord || "99";
      return oa < ob ? -1 : oa > ob ? 1 : 0;
    }));
    var soltas = soltasPorVoo(dia);
    var h = "<thead><tr><th>Palete</th><th>Chegada (entrada)</th><th>Tipo</th><th>Lote</th>" + "<th>Lotes</th><th>Volumes</th><th>Dentro</th><th>Atrasado</th><th>Descarga</th></tr></thead><tbody>";
    if (!plts.length && !soltas.length) {
      tbl.innerHTML = h + '<tr><td colspan="9" class="celula-vazia">Nenhum palete recebido nesta linha para os filtros selecionados</td></tr></tbody>';
      return;
    }
    var tot = {
      lote: 0,
      vol: 0,
      den: 0,
      fora: 0
    };
    plts.forEach((function(u) {
      tot.lote += u.lote;
      tot.vol += u.vol || 0;
      tot.den += u.den;
      tot.fora += u.fora;
      h += '<tr class="plt-click" tabindex="0" data-doc="' + u.doc + '" data-i="' + u.i + '" title="Ver a viagem deste palete">' + "<td>" + u.plt + "</td>" + '<td class="col-destaque">' + (horaCurta(u.pz) || '<span class="em-aberto">Sem chegada</span>') + "</td>" + "<td>" + (u.tipo_plt || "–") + "</td>" + "<td>" + textoCarga(u.am, u.bt) + "</td>" + "<td>" + fmtNum(u.lote, 0) + "</td>" + "<td>" + fmtNum(u.vol || 0, 0) + "</td>" + "<td" + (u.den > 0 ? ' class="dentro-sim"' : "") + ">" + fmtNum(u.den, 0) + "</td>" + "<td" + (u.fora > 0 ? ' class="fora-sim"' : "") + ">" + fmtNum(u.fora, 0) + "</td>" + "<td>" + faixaHoras(u.desp_ini, u.desp_fim) + (u.desp !== null && u.desp !== undefined ? ' <span class="sub-dim">(' + fmtMin(u.desp) + ")</span>" : "") + "</td></tr>";
    }));
    soltas.forEach((function(x) {
      tot.lote += x.lote;
      tot.vol += x.vol;
      tot.den += x.den;
      tot.fora += x.fora;
      h += '<tr class="plt-click linha-solta" tabindex="0" data-doc="' + x.doc + '" data-i="" title="Ver a viagem deste lote">' + '<td>Sem palete (avulso)</td><td><span class="em-aberto">Sem chegada</span></td>' + "<td>–</td><td>" + textoCarga(x.am, x.bt) + "</td>" + "<td>" + fmtNum(x.lote, 0) + "</td><td>" + fmtNum(x.vol, 0) + "</td>" + "<td" + (x.den > 0 ? ' class="dentro-sim"' : "") + ">" + fmtNum(x.den, 0) + "</td>" + "<td" + (x.fora > 0 ? ' class="fora-sim"' : "") + ">" + fmtNum(x.fora, 0) + "</td>" + "<td>–</td></tr>";
    }));
    h += "<tr><td>Total · " + plts.length + " palete" + (plts.length === 1 ? "" : "s") + '</td><td colspan="3"></td>' + "<td>" + fmtNum(tot.lote, 0) + "</td><td>" + fmtNum(tot.vol, 0) + "</td>" + "<td>" + fmtNum(tot.den, 0) + "</td><td>" + fmtNum(tot.fora, 0) + "</td><td></td></tr></tbody>";
    tbl.innerHTML = h;
    tbl.querySelectorAll("tr.plt-click").forEach((function(tr) {
      var abrir = function() {
        abrirDetalheVoo(tr.dataset.doc, tr.dataset.i, tr);
      };
      tr.addEventListener("click", abrir);
      tr.addEventListener("keydown", (function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }));
    }));
  }
  var elModal = document.getElementById("viagem-modal");
  var origemFoco = null;
  document.getElementById("viagem-modal-fechar").addEventListener("click", fecharDetalheVoo);
  elModal.addEventListener("click", (function(e) {
    if (e.target === elModal) fecharDetalheVoo();
  }));
  document.addEventListener("keydown", (function(e) {
    if (e.key === "Escape" && !elModal.hidden) fecharDetalheVoo();
  }));
  function fecharDetalheVoo() {
    elModal.hidden = true;
    document.body.classList.remove("modal-aberto");
    if (origemFoco) {
      origemFoco.focus();
      origemFoco = null;
    }
  }
  function abrirDetalheVoo(doc, iSel, trOrigem) {
    var dia = diaAtual();
    var linha = st.aba;
    var info = D.viagens_info[doc] || {};
    var plt = iSel !== "" && iSel !== undefined ? (dia.plts || [])[+iSel] : null;
    var irmas = (dia.plts || []).filter((function(u) {
      return u.doc === doc && u.l === linha;
    })).sort((function(a, b) {
      return (a.ord || "99") < (b.ord || "99") ? -1 : 1;
    }));
    var pos = plt ? irmas.indexOf(plt) + 1 : 0;
    var outras = {};
    (dia.viagens || []).forEach((function(v) {
      if (v.doc === doc && v.l !== linha) outras[v.l] = true;
    }));
    var outrasTxt = Object.keys(outras).sort().map((function(l) {
      return "Linha " + l;
    })).join(", ");
    var chegadaDoca = "–";
    if (plt && plt.ord && info.chegada_ts) {
      var c = info.chegada_ts.replace(/[-T:]/g, ""), o = plt.ord;
      var dc = new Date(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8, 10), +c.slice(10, 12));
      var dp = new Date(+o.slice(0, 4), +o.slice(4, 6) - 1, +o.slice(6, 8), +o.slice(8, 10), +o.slice(10, 12));
      var min = Math.round((dp - dc) / 6e4);
      if (min >= 0) chegadaDoca = fmtDuracao(min);
    }
    document.getElementById("viagem-modal-titulo").textContent = (plt ? "Palete " + plt.plt : "Lote avulso") + " · Viagem " + (info.viagem || doc);
    document.getElementById("viagem-modal-sub").textContent = "Linha " + linha + (info.data_viagem ? " · viagem de " + info.data_viagem : "");
    function item(rotulo, valor, extra) {
      return '<div class="det-item"><dt>' + rotulo + "</dt><dd>" + valor + (extra ? '<span class="sub-dim">' + extra + "</span>" : "") + "</dd></div>";
    }
    var html = '<dl class="det-grid">' + item("Documento", doc) + item("Chegada", info.chegada || "–") + item("Liberação da viagem", info.fech || '<span class="em-aberto">Em aberto</span>', info.fech && info.chegada_lib_min !== null && info.chegada_lib_min !== undefined ? " (" + fmtDuracao(info.chegada_lib_min) + " após a chegada)" : "");
    if (plt) {
      html += item("Chegada → Doca", chegadaDoca, " deste palete") + item("Ordem de chegada", pos ? pos + "ª de " + irmas.length : "–", irmas.length === 1 ? " (único palete da viagem nesta linha)" : " paletes da viagem nesta linha");
    }
    html += item("Outras linhas com esta viagem", outrasTxt || "Nenhuma") + "</dl>";
    document.getElementById("viagem-det").innerHTML = html;
    origemFoco = trOrigem || null;
    elModal.hidden = false;
    document.body.classList.add("modal-aberto");
    document.getElementById("viagem-modal-fechar").focus();
  }
  function celulaTipo(am, bt, semPct) {
    var tot = am + bt;
    return "<td>" + fmtNum(am, 0) + " / " + fmtNum(bt, 0) + (!semPct && tot ? '<span class="sub-dim">' + fmtNum(am / tot * 100, 0) + "% fech.</span>" : "") + "</td>";
  }
  function celulaPct(p) {
    if (p === null || p === undefined) return "<td>–</td>";
    return '<td class="' + (p >= META ? "pct-ok" : "pct-nok") + '">' + fmtNum(p, 1) + "%</td>";
  }
  function setTxt(id, v) {
    document.getElementById(id).textContent = v;
  }
  function fmtNum(v, casas) {
    return Number(v).toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas
    });
  }
  function fmtHora(h) {
    return (h < 10 ? "0" : "") + h + ":00";
  }
  function fmtMin(v) {
    return v === null || v === undefined ? "–" : fmtNum(v, 0) + " min";
  }
  function fmtDuracao(min) {
    var hh = Math.floor(min / 60), mm = min % 60;
    return hh + "h" + (mm < 10 ? "0" : "") + mm;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionFollow);
  var resizeTimer = null;
  function onResize() {
    positionFollow();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout((function() {
      if (chart) render();
    }), 150);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
})();
