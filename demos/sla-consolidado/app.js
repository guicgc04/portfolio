(() => {
  "use strict";
  let DADOS = null;
  let abaAtiva = "mensal";
  const MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";
  async function carregar() {
    try {
      const resp = await fetch("dados_sla_mensal.json?_=" + Date.now());
      DADOS = await resp.json();
      render();
    } catch (e) {
      document.getElementById("updated-tag").textContent = "Falha ao carregar dados";
      console.error(e);
    }
  }
  function pctDia(v) {
    if (v === null || v === undefined) return "–";
    return Math.round(v * 100) + "%";
  }
  function pctTotal(v) {
    if (v === null || v === undefined) return "–";
    return (v * 100).toFixed(2).replace(".", ",") + "%";
  }
  function fmtItem(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  function fmtNum(v) {
    return Math.round(v).toLocaleString("pt-BR");
  }
  function fmtTon(v) {
    return (v || 0).toFixed(1).replace(".", ",");
  }
  function statusConclusao(c) {
    if (c === "Dentro") return "g";
    if (c === "Perdido") return "r";
    if (typeof c === "number") return "y";
    return "n";
  }
  function statusTendencia(seta) {
    if (seta === "▲") return "g";
    if (seta === "▼") return "r";
    return "n";
  }
  function textoConclusao(c) {
    if (c === "Dentro") return "Dentro";
    if (c === "Perdido") return "Perdido";
    if (typeof c === "number") return fmtNum(c);
    return "Sem dado";
  }
  const COORDENADORES = [ {
    nome: "Marina Ramos",
    foto: "../_comum/avatar-1.svg",
    itens: [ 1, 2, 3, 4 ]
  }, {
    nome: "Caio Lima",
    foto: "../_comum/avatar-2.svg",
    itens: [ 5, 6, 7, 8 ]
  }, {
    nome: "Paula Teixeira",
    foto: "../_comum/avatar-3.svg",
    itens: [ 9, 10, 11, 12 ]
  } ];
  function coordenadorDoItem(item) {
    return COORDENADORES.find((c => c.itens.includes(Math.trunc(item)))) || null;
  }
  const ICONE_SETA = {
    "▲": "▲",
    "▼": "▼",
    "-": "–"
  };
  const COLUNA_CONFIG = {
    mensal: {
      setor: {
        valor: s => s.setor || "—"
      }
    },
    diario: {
      setor: {
        valor: s => s.setor || "—"
      }
    }
  };
  const filtrosColuna = {};
  function passaFiltrosColuna(tabelaId, row, ignorarCol) {
    const cfgTabela = COLUNA_CONFIG[tabelaId];
    if (!cfgTabela) return true;
    const estado = filtrosColuna[tabelaId] || {};
    return Object.keys(cfgTabela).every((col => {
      if (col === ignorarCol) return true;
      const selecionados = estado[col];
      if (!selecionados) return true;
      return selecionados.has(cfgTabela[col].valor(row));
    }));
  }
  function baseRowsFor(tabelaId) {
    if (tabelaId === "mensal") return DADOS?.mensal?.slas || [];
    if (tabelaId === "diario") return DADOS?.diario?.slas || [];
    return [];
  }
  function tabelaIdDoElemento(th) {
    const tabela = th.closest("table");
    if (!tabela) return null;
    if (tabela.id === "tabela-mensal") return "mensal";
    if (tabela.id === "tabela-diaria") return "diario";
    return null;
  }
  function rerenderTabela(tabelaId) {
    if (tabelaId === "mensal") renderMensal(); else if (tabelaId === "diario") renderDiario();
  }
  function fecharMenusColuna() {
    document.querySelectorAll(".col-filter-menu").forEach((m => m.remove()));
    document.querySelectorAll(".th-filtravel.open").forEach((th => th.classList.remove("open")));
  }
  function abrirMenuColuna(th, tabelaId, col) {
    const cfg = COLUNA_CONFIG[tabelaId]?.[col];
    if (!cfg) return;
    const base = baseRowsFor(tabelaId);
    const disponiveis = base.filter((row => passaFiltrosColuna(tabelaId, row, col)));
    const contagem = new Map;
    disponiveis.forEach((row => {
      const v = cfg.valor(row);
      contagem.set(v, (contagem.get(v) || 0) + 1);
    }));
    const valores = [ ...contagem.keys() ].sort(((a, b) => a.localeCompare(b, "pt-BR")));
    const estado = filtrosColuna[tabelaId] ||= {};
    const selecionadosAtuais = estado[col];
    const menu = document.createElement("div");
    menu.className = "col-filter-menu";
    menu.innerHTML = (valores.length ? valores.map((v => {
      const marcado = !selecionadosAtuais || selecionadosAtuais.has(v);
      return `<label><input type="checkbox" value="${v}" ${marcado ? "checked" : ""}>${v}<span class="cf-count">${contagem.get(v)}</span></label>`;
    })).join("") : `<div class="col-filter-vazio">Nenhum valor com esse filtro</div>`) + `<div class="col-filter-actions">\n         <button type="button" data-acao="todos">Marcar todos</button>\n         <button type="button" data-acao="limpar">Limpar filtro</button>\n       </div>`;
    menu.addEventListener("click", (e => {
      e.stopPropagation();
      const acaoBtn = e.target.closest("button[data-acao]");
      if (acaoBtn) {
        const marcar = acaoBtn.dataset.acao === "todos";
        menu.querySelectorAll('input[type="checkbox"]').forEach((cb => cb.checked = marcar));
      }
      if (e.target.matches('input[type="checkbox"]') || acaoBtn) {
        const marcados = [ ...menu.querySelectorAll('input[type="checkbox"]:checked') ].map((cb => cb.value));
        estado[col] = marcados.length === valores.length ? null : new Set(marcados);
        th.classList.toggle("filtro-ativo", !!estado[col]);
        rerenderTabela(tabelaId);
      }
    }));
    document.body.appendChild(menu);
    const retanguloTh = th.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${retanguloTh.bottom + 6}px`;
    menu.style.left = `${retanguloTh.left}px`;
    const larguraMenu = menu.offsetWidth;
    if (retanguloTh.left + larguraMenu > window.innerWidth - 8) {
      menu.style.left = `${Math.max(8, retanguloTh.right - larguraMenu)}px`;
    }
    th.classList.add("open");
  }
  document.addEventListener("click", (e => {
    const th = e.target.closest("th.th-filtravel");
    if (th) {
      const tabelaId = tabelaIdDoElemento(th);
      const col = th.dataset.filtroCol;
      if (!tabelaId || !col) return;
      const jaAberto = th.classList.contains("open");
      fecharMenusColuna();
      if (!jaAberto) abrirMenuColuna(th, tabelaId, col);
      e.stopPropagation();
      return;
    }
    if (!e.target.closest(".th-filtravel") && !e.target.closest(".col-filter-menu")) {
      fecharMenusColuna();
    }
  }));
  document.addEventListener("scroll", (() => {
    const menuAberto = document.querySelector(".col-filter-menu");
    const thAberto = document.querySelector("th.th-filtravel.open");
    if (!menuAberto || !thAberto) return;
    const r = thAberto.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
      fecharMenusColuna();
      return;
    }
    menuAberto.style.top = `${r.bottom + 6}px`;
    menuAberto.style.left = `${r.left}px`;
  }), true);
  function renderMensal() {
    if (!DADOS?.mensal || !DADOS?.semanal) return;
    esquecerFixadoMensal?.();
    const dias = DADOS.semanal.dias || [];
    const headRow = document.getElementById("tabela-mensal-head-row");
    headRow.innerHTML = `<th class="resp-th" rowspan="4">Responsável</th>` + `<th class="indicador-th th-filtravel" rowspan="4" data-filtro-col="setor">\n         <span class="th-filtravel-label">Indicador<svg class="th-filtravel-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>\n       </th>` + dias.map((d => `<th class="dia-th">${fmtDiaCurto(d)}</th>`)).join("") + `<th class="total-mes-col">Total mês</th>` + `<th class="status-mes-col">Status</th>`;
    const tonelagem = DADOS.mensal.tonelagem || {};
    const porDiaTon = new Map((tonelagem.por_dia || []).map((p => [ p.data, p ])));
    const CLASSE_PERFIL = {
      Baixo: "g",
      Normal: "y",
      Alto: "r"
    };
    const celulasValores = (campo, rotulo) => dias.map(((d, i) => {
      const p = porDiaTon.get(d);
      const etiqueta = i === 0 ? `<span class="ton-row-tag">${rotulo}</span>` : "";
      return `<td class="ton-dia">${etiqueta}${p ? fmtTon(p[campo]) : "–"}</td>`;
    })).join("");
    const rowEnt = document.getElementById("tabela-mensal-ent-row");
    rowEnt.innerHTML = `${celulasValores("ent", "ENTRADA")}\n       <td class="total-mes-col ton-total">${fmtTon(tonelagem.total_ent)}<span class="ton-unidade">t</span></td>\n       <td class="status-mes-col"></td>`;
    const rowSai = document.getElementById("tabela-mensal-sai-row");
    rowSai.innerHTML = `${celulasValores("sai", "SAÍDA")}\n       <td class="total-mes-col ton-total">${fmtTon(tonelagem.total_sai)}<span class="ton-unidade">t</span></td>\n       <td class="status-mes-col"></td>`;
    const rowPerfil = document.getElementById("tabela-mensal-perfil-row");
    rowPerfil.innerHTML = `${dias.map((d => {
      const p = porDiaTon.get(d);
      const cls = p ? CLASSE_PERFIL[p.perfil] || "n" : "n";
      return `<td class="ton-perfil ton-perfil-${cls}">${p ? p.perfil : "–"}</td>`;
    })).join("")}\n       <td class="total-mes-col ton-total"></td>\n       <td class="status-mes-col"></td>`;
    let linhas = DADOS.semanal.slas || [];
    linhas = linhas.filter((s => passaFiltrosColuna("mensal", s, null)));
    const linhasComResp = [];
    for (let i = 0; i < linhas.length; ) {
      const coord = coordenadorDoItem(linhas[i].item);
      let fim = i + 1;
      while (fim < linhas.length && coordenadorDoItem(linhas[fim].item) === coord) fim++;
      const span = fim - i;
      for (let k = i; k < fim; k++) {
        linhasComResp.push({
          s: linhas[k],
          coord: coord,
          span: k === i ? span : 0
        });
      }
      i = fim;
    }
    const tbody = document.querySelector("#tabela-mensal tbody");
    tbody.innerHTML = linhasComResp.map((({s: s, coord: coord, span: span}) => {
      const celulas = dias.map((d => {
        const v = s.por_dia[d];
        if (!v || !v.total) {
          return `<td class="dia-n" title="Sem dado">–</td>`;
        }
        const st = v.pct >= s.meta ? "g" : "r";
        return `<td class="dia-${st}" title="${v.dentro}/${v.total}">${pctDia(v.pct)}</td>`;
      })).join("");
      const stConc = statusConclusao(s.conclusao);
      const celTotalMes = `<td class="dia-${stConc} total-mes-col">\n            <span class="tendencia-inline ${statusTendencia(s.seta)}">${ICONE_SETA[s.seta] || ""}</span>\n            <span class="total-pct">${pctTotal(s.total_mes_pct)}</span>\n          </td>\n          <td class="dia-${stConc} status-mes-col">\n            <span class="status-txt">${textoConclusao(s.conclusao)}</span>\n          </td>`;
      const celResp = span > 0 ? coord ? `<td class="resp-cell" rowspan="${span}">\n                   <img class="resp-foto" src="${coord.foto}" alt="${coord.nome}">\n                   <span class="resp-nome">${coord.nome}</span>\n                 </td>` : `<td class="resp-cell resp-vazio" rowspan="${span}">–</td>` : "";
      return `<tr>${celResp}<td class="indicador-cell"><span class="indicador-nome">${fmtItem(s.item)} · ${s.indicador}</span></td>${celulas}${celTotalMes}</tr>`;
    })).join("");
  }
  function fmtDiaCurto(iso) {
    const [, , dia] = iso.split("-");
    return dia;
  }
  function renderDiario() {
    if (!DADOS?.diario) return;
    esquecerFixadoDiario?.();
    const dias = DADOS.diario.dias || [];
    const headRow = document.getElementById("tabela-diaria-head-row");
    headRow.innerHTML = `<th class="resp-th">Responsável</th>` + `<th class="indicador-th th-filtravel" data-filtro-col="setor">\n         <span class="th-filtravel-label">Indicador<svg class="th-filtravel-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>\n       </th>` + dias.map((d => `<th class="dia-th">${fmtDiaCurto(d)}</th>`)).join("");
    let linhas = DADOS.diario.slas || [];
    linhas = linhas.filter((s => passaFiltrosColuna("diario", s, null)));
    const linhasComResp = [];
    for (let i = 0; i < linhas.length; ) {
      const coord = coordenadorDoItem(linhas[i].item);
      let fim = i + 1;
      while (fim < linhas.length && coordenadorDoItem(linhas[fim].item) === coord) fim++;
      const span = fim - i;
      for (let k = i; k < fim; k++) {
        linhasComResp.push({
          s: linhas[k],
          coord: coord,
          span: k === i ? span : 0
        });
      }
      i = fim;
    }
    const tbody = document.querySelector("#tabela-diaria tbody");
    tbody.innerHTML = linhasComResp.map((({s: s, coord: coord, span: span}) => {
      const celulas = dias.map((d => {
        const v = s.por_dia[d];
        if (!v || !v.total) {
          return `<td class="dia-n" title="Sem dado">–</td>`;
        }
        const st = v.pct >= s.meta ? "g" : "r";
        return `<td class="dia-${st}" title="${v.dentro}/${v.total}">${pctDia(v.pct)}</td>`;
      })).join("");
      const celResp = span > 0 ? coord ? `<td class="resp-cell" rowspan="${span}">\n                   <img class="resp-foto" src="${coord.foto}" alt="${coord.nome}">\n                   <span class="resp-nome">${coord.nome}</span>\n                 </td>` : `<td class="resp-cell resp-vazio" rowspan="${span}">–</td>` : "";
      return `<tr>${celResp}<td class="indicador-cell"><span class="indicador-nome">${fmtItem(s.item)} · ${s.indicador}</span></td>${celulas}</tr>`;
    })).join("");
  }
  function render() {
    if (!DADOS) return;
    const dt = new Date(DADOS.atualizado_em);
    document.getElementById("updated-tag").textContent = "Atualizado em " + dt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    renderMensal();
    renderDiario();
    positionFollow();
    ajustarLarguraDia();
    ajustarAlturaLinhas();
  }
  function ajustarAlturaLinhas() {
    if (window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches) return;
    [ "mensal", "diario" ].forEach((tabelaId => {
      const view = document.getElementById("view-" + tabelaId);
      if (!view || !view.classList.contains("active")) return;
      const wrap = view.querySelector(".table-wrap-scroll");
      const tabela = view.querySelector("table");
      const thead = tabela?.querySelector("thead");
      const tbody = tabela?.querySelector("tbody");
      if (!wrap || !thead || !tbody || !tbody.rows.length) return;
      const alturaDisponivel = wrap.clientHeight - thead.offsetHeight;
      if (alturaDisponivel <= 0) return;
      const alturaLinha = alturaDisponivel / tbody.rows.length;
      tabela.style.setProperty("--linha-altura", `${alturaLinha.toFixed(1)}px`);
    }));
  }
  const COLUNAS_VISIVEIS_DIA = 7;
  function ajustarLarguraDia() {
    if (window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches) return;
    const view = document.querySelector(".view.active");
    const wrap = view?.querySelector(".table-wrap-scroll");
    if (!wrap) return;
    const ehMensal = view.id === "view-mensal";
    const cs = getComputedStyle(document.documentElement);
    const respW = parseFloat(cs.getPropertyValue("--diaria-resp-width")) || 0;
    const indW = parseFloat(cs.getPropertyValue("--diaria-indicador-width")) || 0;
    const totalW = ehMensal ? parseFloat(cs.getPropertyValue("--diaria-total-width")) || 0 : 0;
    const statusW = ehMensal ? parseFloat(cs.getPropertyValue("--diaria-status-width")) || 0 : 0;
    const disponivel = wrap.clientWidth - respW - indW - totalW - statusW;
    if (disponivel <= 0) return;
    const larguraDia = disponivel / COLUNAS_VISIVEIS_DIA;
    document.documentElement.style.setProperty("--diaria-dia-width", `${larguraDia.toFixed(1)}px`);
  }
  function positionFollow() {
    const bar = document.getElementById("tab-bar");
    const follow = document.getElementById("tab-follow");
    const ativo = bar?.querySelector(".tab-btn.active");
    if (!bar || !follow || !ativo) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = ativo.getBoundingClientRect();
    const centro = btnRect.left - barRect.left + btnRect.width / 2 + bar.scrollLeft;
    const largura = follow.offsetWidth;
    follow.style.left = `${centro - largura / 2}px`;
  }
  document.getElementById("tab-bar").addEventListener("click", (e => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    abaAtiva = btn.dataset.view;
    document.querySelectorAll(".tab-btn").forEach((b => b.classList.remove("active")));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach((v => v.classList.remove("active")));
    document.getElementById("view-" + abaAtiva).classList.add("active");
    positionFollow();
    ajustarLarguraDia();
    ajustarAlturaLinhas();
  }));
  function destacarGrupoResponsavel(celula, ligar) {
    const span = parseInt(celula.getAttribute("rowspan") || "1", 10);
    let linha = celula.closest("tr");
    for (let i = 0; i < span && linha; i++) {
      linha.classList.toggle("resp-realce", ligar);
      linha.classList.toggle("resp-realce-topo", ligar && i === 0);
      linha.classList.toggle("resp-realce-base", ligar && i === span - 1);
      linha = linha.nextElementSibling;
    }
  }
  function configurarRealceResponsavel(tabela) {
    let fixado = null;
    tabela.addEventListener("mouseover", (e => {
      const cel = e.target.closest("td.resp-cell:not(.resp-vazio)");
      if (!cel || cel === fixado) return;
      destacarGrupoResponsavel(cel, true);
    }));
    tabela.addEventListener("mouseout", (e => {
      const cel = e.target.closest("td.resp-cell:not(.resp-vazio)");
      if (!cel || cel === fixado) return;
      destacarGrupoResponsavel(cel, false);
    }));
    tabela.addEventListener("click", (e => {
      const cel = e.target.closest("td.resp-cell:not(.resp-vazio)");
      if (!cel) return;
      if (fixado === cel) {
        destacarGrupoResponsavel(cel, false);
        fixado = null;
      } else {
        if (fixado) destacarGrupoResponsavel(fixado, false);
        destacarGrupoResponsavel(cel, true);
        fixado = cel;
      }
    }));
    return () => {
      fixado = null;
    };
  }
  const esquecerFixadoMensal = configurarRealceResponsavel(document.getElementById("tabela-mensal"));
  const esquecerFixadoDiario = configurarRealceResponsavel(document.getElementById("tabela-diaria"));
  window.addEventListener("resize", (() => {
    positionFollow();
    ajustarLarguraDia();
    ajustarAlturaLinhas();
  }));
  carregar();
  setInterval(carregar, 5 * 60 * 1e3);
  document.fonts?.ready?.then((() => {
    positionFollow();
  }));
})();
