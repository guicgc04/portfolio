(function() {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const MODO_TV = params.get("tv") === "1";
  const ROTACAO_MS = 9e3;
  const MEDIA_LAYOUT_COMPACTO = window.matchMedia("(max-width: 480px), (max-height: 500px) and (orientation: landscape)");
  const AREAS_MAP = {};
  DASHBOARD_DATA.areas.forEach((a => AREAS_MAP[a.id] = a));
  const SUPERVISORES_COM_LIDERES = new Set(DASHBOARD_DATA.lideres.filter((l => l.cargo === "Líder" && l.supervisor)).map((l => l.supervisor)));
  const compete = l => l.cargo !== "Supervisor" || !SUPERVISORES_COM_LIDERES.has(l.nome);
  const COMPETIDORES = DASHBOARD_DATA.lideres.filter(compete);
  const lideresOrdenados = [ ...COMPETIDORES ].sort(((a, b) => b.pontos_total - a.pontos_total));
  const TURNOS = [ ...new Set(COMPETIDORES.map((l => l.turno))) ].sort();
  const HIST = typeof HISTORICO_DIARIO !== "undefined" ? HISTORICO_DIARIO : {};
  const MES_ATUAL = DASHBOARD_DATA.mes_referencia || String(DASHBOARD_DATA.atualizado_em || "").slice(0, 7);
  const DIAS_HISTORICO = Object.keys(HIST).filter((d => !MES_ATUAL || d.startsWith(MES_ATUAL))).sort();
  function snapshotDoDia(lider, dia) {
    return HIST[dia] && HIST[dia][lider.id] || null;
  }
  function pontosDesdeRetratoAnterior(lider, dia) {
    const i = DIAS_HISTORICO.indexOf(dia);
    if (i === -1) return {
      ganho: 0,
      diaAnterior: null
    };
    const atual = snapshotDoDia(lider, dia);
    if (!atual) return {
      ganho: 0,
      diaAnterior: null
    };
    for (let j = i - 1; j >= 0; j--) {
      const anterior = snapshotDoDia(lider, DIAS_HISTORICO[j]);
      if (anterior) return {
        ganho: atual.pontos_total - anterior.pontos_total,
        diaAnterior: DIAS_HISTORICO[j]
      };
    }
    return {
      ganho: atual.pontos_total,
      diaAnterior: null
    };
  }
  function formatarDiaCurto(isoDate) {
    const [, mes, dia] = isoDate.split("-");
    return `${dia}/${mes}`;
  }
  document.getElementById("periodo-label").textContent = DASHBOARD_DATA.periodo;
  document.getElementById("updated-tag").textContent = "Atualizado em " + DASHBOARD_DATA.atualizado_em;
  let modoAtivo = "lideres";
  let turnoAtivo = "geral";
  let diaAtivo = "mes";
  function fecharTodosDropdowns() {
    document.querySelectorAll(".custom-select-dropdown.open").forEach((d => d.classList.remove("open")));
    document.querySelectorAll(".custom-select-btn.open").forEach((b => b.classList.remove("open")));
  }
  document.addEventListener("click", fecharTodosDropdowns);
  function criarCustomSelect(btnId, labelId, dropdownId, getOpcoes, onChange) {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    const dropdown = document.getElementById(dropdownId);
    function renderOpcoes(valorAtual) {
      dropdown.innerHTML = getOpcoes().map((o => `<div class="custom-select-option${o.value === valorAtual ? " selected" : ""}"\n                data-value="${o.value}">${o.text}</div>`)).join("");
    }
    btn.addEventListener("click", (e => {
      e.stopPropagation();
      const abrindo = !dropdown.classList.contains("open");
      fecharTodosDropdowns();
      if (abrindo) {
        renderOpcoes(btn.dataset.valorAtual || "");
        dropdown.classList.add("open");
        btn.classList.add("open");
      }
    }));
    dropdown.addEventListener("click", (e => {
      const opt = e.target.closest(".custom-select-option");
      if (!opt) return;
      label.textContent = opt.textContent;
      btn.dataset.valorAtual = opt.dataset.value;
      fecharTodosDropdowns();
      onChange(opt.dataset.value, opt.textContent);
    }));
    return {
      setValor(value, text) {
        btn.dataset.valorAtual = value;
        label.textContent = text;
      }
    };
  }
  let ctrlModo, ctrlTurno, ctrlDia;
  function popularFiltroModo() {
    const opcoes = [ {
      value: "lideres",
      text: "Líderes"
    }, {
      value: "supervisores",
      text: "Supervisores"
    }, {
      value: "coordenadores",
      text: "Coordenadores"
    } ];
    ctrlModo = criarCustomSelect("modo-filter-btn", "modo-filter-label", "modo-filter-dropdown", (() => opcoes), (val => definirModo(val)));
    ctrlModo.setValor(modoAtivo, "Líderes");
  }
  function definirModo(modo) {
    modoAtivo = modo;
    const labelMap = {
      lideres: "Líderes",
      supervisores: "Supervisores",
      coordenadores: "Coordenadores"
    };
    if (ctrlModo) ctrlModo.setValor(modo, labelMap[modo] || modo);
    const mostraTurno = modo === "lideres";
    document.getElementById("turno-filter-wrap").style.display = mostraTurno ? "" : "none";
    document.getElementById("dia-filter-wrap").style.display = mostraTurno ? "" : "none";
    document.getElementById("rk-destaque").style.display = mostraTurno ? "none" : "";
    renderTabelaRanking();
  }
  function popularFiltroTurno() {
    const opcoes = [ {
      value: "geral",
      text: "Geral"
    }, ...TURNOS.map((t => ({
      value: t,
      text: t
    }))) ];
    ctrlTurno = criarCustomSelect("turno-filter-btn", "turno-filter-label", "turno-filter-dropdown", (() => opcoes), (val => definirTurno(val)));
    ctrlTurno.setValor(turnoAtivo, "Geral");
  }
  function definirTurno(turno) {
    turnoAtivo = turno;
    renderTabelaRanking();
  }
  function popularFiltroDia() {
    const opcoes = [ {
      value: "mes",
      text: "Mês inteiro"
    }, ...DIAS_HISTORICO.map((dia => ({
      value: dia,
      text: `Dia ${formatarDiaCurto(dia)}`
    }))) ];
    ctrlDia = criarCustomSelect("dia-filter-btn", "dia-filter-label", "dia-filter-dropdown", (() => opcoes), (val => definirDia(val)));
    ctrlDia.setValor(diaAtivo, "Mês inteiro");
  }
  function definirDia(dia) {
    diaAtivo = dia;
    renderTabelaRanking();
  }
  function renderCabecalhoRanking() {
    const head = document.getElementById("tabela-ranking-head");
    if (modoAtivo === "lideres" && diaAtivo !== "mes") {
      head.innerHTML = `\n          <th class="rk-th-pos">Pos.</th>\n          <th class="resp-th">Líder</th>\n          <th class="rk-th-turno">Turno</th>\n          <th class="rk-th-num">Pontos no dia</th>\n          <th class="rk-th-num">Acumulado até o dia</th>`;
    } else if (modoAtivo === "lideres") {
      head.innerHTML = `\n          <th class="rk-th-pos">Pos.</th>\n          <th class="resp-th">Líder</th>\n          <th class="rk-th-turno">Turno</th>\n          <th class="rk-th-num">Pontuação Geral</th>\n          <th class="rk-th-num">% Geral</th>\n          <th class="rk-th-num">Processos</th>\n          <th class="rk-th-num">Pessoas</th>\n          <th class="rk-th-num">Segurança</th>\n          <th class="rk-th-text">SLA Correspondente</th>`;
    } else if (modoAtivo === "supervisores") {
      head.innerHTML = `\n          <th class="rk-th-pos">Pos.</th>\n          <th class="resp-th">Supervisor</th>\n          <th class="rk-th-turno">Turno</th>\n          <th class="rk-th-num">Nº de líderes</th>\n          <th class="rk-th-num">Pontuação total</th>\n          <th class="rk-th-num">Média por líder</th>`;
    } else {
      head.innerHTML = `\n          <th class="rk-th-pos">Pos.</th>\n          <th class="resp-th">Coordenador</th>\n          <th class="rk-th-num">Nº de líderes</th>\n          <th class="rk-th-num">Pontuação total</th>\n          <th class="rk-th-num">Média por líder</th>\n          <th class="rk-th-text">SLA Correspondente</th>`;
    }
  }
  function renderTabelaLideres() {
    const lista = turnoAtivo === "geral" ? lideresOrdenados : lideresOrdenados.filter((l => l.turno === turnoAtivo));
    const body = document.getElementById("tabela-ranking-body");
    if (diaAtivo !== "mes") {
      renderTabelaLideresDoDia(lista, body);
      return;
    }
    body.innerHTML = lista.map(((lider, i) => {
      const posicao = i + 1;
      const pa = lider.pontos_por_area;
      let faixa = "";
      if (posicao <= 5) faixa = "rk-row-top"; else if (posicao > lista.length - 5) faixa = "rk-row-bottom";
      return `\n          <tr class="${faixa}">\n            <td class="rk-pos">${posicao}</td>\n            <td>\n              <div class="resp-cell-inline">\n                <img class="resp-foto" src="${lider.foto}" alt="">\n                <span class="resp-nome">${lider.nome}</span>\n              </div>\n            </td>\n            <td class="rk-turno">${lider.turno || "–"}</td>\n            <td class="rk-num rk-num-principal">${lider.pontos_total}</td>\n            <td class="rk-num">${lider.porcentagem_geral}%</td>\n            <td class="rk-num">${pa.processos}</td>\n            <td class="rk-num">${pa.pessoas}</td>\n            <td class="rk-num">${pa.seguranca_area}</td>\n            <td class="rk-text">${lider.sla_correspondente}</td>\n          </tr>`;
    })).join("");
  }
  function renderTabelaLideresDoDia(lista, body) {
    const comPontosDoDia = lista.map((lider => {
      const snap = snapshotDoDia(lider, diaAtivo);
      const {ganho: ganho} = pontosDesdeRetratoAnterior(lider, diaAtivo);
      return {
        lider: lider,
        pontosDia: ganho,
        acumulado: snap ? snap.pontos_total : 0
      };
    })).sort(((a, b) => b.pontosDia - a.pontosDia));
    body.innerHTML = comPontosDoDia.map((({lider: lider, pontosDia: pontosDia, acumulado: acumulado}, i) => {
      const posicao = i + 1;
      let faixa = "";
      if (posicao <= 5) faixa = "rk-row-top"; else if (posicao > comPontosDoDia.length - 5) faixa = "rk-row-bottom";
      return `\n          <tr class="${faixa}">\n            <td class="rk-pos">${posicao}</td>\n            <td>\n              <div class="resp-cell-inline">\n                <img class="resp-foto" src="${lider.foto}" alt="">\n                <span class="resp-nome">${lider.nome}</span>\n              </div>\n            </td>\n            <td class="rk-turno">${lider.turno || "–"}</td>\n            <td class="rk-num rk-num-principal">${pontosDia > 0 ? "+" : ""}${pontosDia}</td>\n            <td class="rk-num">${acumulado}</td>\n          </tr>`;
    })).join("");
  }
  function renderTabelaSupervisores() {
    const supervisores = DASHBOARD_DATA.lideres.filter((l => l.cargo === "Supervisor" && SUPERVISORES_COM_LIDERES.has(l.nome)));
    const lista = supervisores.map((sup => {
      const liderados = DASHBOARD_DATA.lideres.filter((l => l.cargo === "Líder" && l.supervisor === sup.nome));
      const total = liderados.reduce(((s, l) => s + l.pontos_total), 0);
      const media = Math.round(total / liderados.length);
      return {
        pessoa: sup,
        liderados: liderados,
        total: total,
        media: media
      };
    })).sort(((a, b) => b.media - a.media));
    const body = document.getElementById("tabela-ranking-body");
    body.innerHTML = lista.map(((g, i) => `\n          <tr>\n            <td class="rk-pos">${i + 1}</td>\n            <td>\n              <div class="resp-cell-inline">\n                <img class="resp-foto" src="${g.pessoa.foto}" alt="">\n                <span class="resp-nome">${g.pessoa.nome}</span>\n              </div>\n            </td>\n            <td class="rk-turno">${g.pessoa.turno || "–"}</td>\n            <td class="rk-num">${g.liderados.length}</td>\n            <td class="rk-num">${g.total}</td>\n            <td class="rk-num rk-num-principal">${g.media}</td>\n          </tr>`)).join("");
    const g1 = lista[0];
    const destaque = document.getElementById("rk-destaque");
    destaque.innerHTML = g1 ? `Supervisor com mais pontos: <b>${g1.pessoa.nome}</b> · ${g1.media} pts (média)` : "";
  }
  const COORDENADORES_MAP = {};
  (DASHBOARD_DATA.coordenadores || []).forEach((c => COORDENADORES_MAP[c.chave] = c));
  function renderTabelaCoordenadores() {
    const grupos = {};
    COMPETIDORES.forEach((l => {
      if (!l.coordenador) return;
      if (!grupos[l.coordenador]) grupos[l.coordenador] = [];
      grupos[l.coordenador].push(l);
    }));
    const lista = Object.entries(grupos).map((([chave, membros]) => {
      const lideresDoTime = membros;
      const total = membros.reduce(((s, l) => s + l.pontos_total), 0);
      const media = Math.round(total / membros.length);
      const coordenador = COORDENADORES_MAP[chave];
      return {
        chave: chave,
        coordenador: coordenador,
        membros: membros,
        lideresDoTime: lideresDoTime,
        total: total,
        media: media
      };
    })).sort(((a, b) => b.media - a.media));
    const body = document.getElementById("tabela-ranking-body");
    body.innerHTML = lista.map(((g, i) => {
      const nomeExibido = g.coordenador ? g.coordenador.nome : g.chave;
      const fotoHtml = g.coordenador ? `<img class="resp-foto" src="${g.coordenador.foto}" alt="">` : `<div class="resp-foto resp-foto-vazia"></div>`;
      return `\n          <tr>\n            <td class="rk-pos">${i + 1}</td>\n            <td>\n              <div class="resp-cell-inline">\n                ${fotoHtml}\n                <span class="resp-nome">${nomeExibido}</span>\n              </div>\n            </td>\n            <td class="rk-num">${g.lideresDoTime.length}</td>\n            <td class="rk-num">${g.total}</td>\n            <td class="rk-num rk-num-principal">${g.media}</td>\n            <td class="rk-text">${g.coordenador && g.coordenador.sla_correspondente || "–"}</td>\n          </tr>`;
    })).join("");
    const semCoordenador = COMPETIDORES.filter((l => !l.coordenador)).length;
    const g1 = lista[0];
    const destaque = document.getElementById("rk-destaque");
    destaque.innerHTML = g1 ? `Coordenador com mais pontos: <b>${g1.coordenador ? g1.coordenador.nome : g1.chave}</b> · ${g1.media} pts (média)` + (semCoordenador ? ` <span class="rk-obs">(${semCoordenador} sem coordenador definido)</span>` : "") : "";
  }
  function renderTabelaRanking() {
    renderCabecalhoRanking();
    if (modoAtivo === "lideres") renderTabelaLideres(); else if (modoAtivo === "supervisores") renderTabelaSupervisores(); else renderTabelaCoordenadores();
  }
  const seletor = document.getElementById("seletor-lider");
  let diaDetalheAtivo = "mes";
  function popularSeletor() {
    seletor.innerHTML = lideresOrdenados.map((l => `<option value="${l.id}">${l.nome}</option>`)).join("");
  }
  seletor.addEventListener("change", (() => renderDetalhe(seletor.value)));
  function popularSeletorDiaDetalhe() {
    const select = document.getElementById("seletor-dia-detalhe");
    select.innerHTML = `<option value="mes">Mês inteiro</option>` + DIAS_HISTORICO.map((dia => `<option value="${dia}">Dia ${formatarDiaCurto(dia)}</option>`)).join("");
    select.addEventListener("change", (() => {
      diaDetalheAtivo = select.value;
      renderDetalhe(seletor.value);
    }));
  }
  function renderInfoLider(lider) {
    const foto = `<img class="resp-foto" src="${lider.foto}" alt="">`;
    const nomeCargo = `\n      <div>\n        <div class="detalhe-lider-nome">${lider.nome}</div>\n        <div class="detalhe-lider-cargo">${lider.cargo} · Turno ${lider.turno}</div>\n      </div>`;
    if (diaDetalheAtivo === "mes") {
      document.getElementById("detalhe-lider").innerHTML = `\n        ${foto}${nomeCargo}\n        <div class="detalhe-lider-pontos">${lider.pontos_total}<span>pontos no mês</span></div>\n      `;
      return;
    }
    const {ganho: ganho} = pontosDesdeRetratoAnterior(lider, diaDetalheAtivo);
    document.getElementById("detalhe-lider").innerHTML = `\n      ${foto}${nomeCargo}\n      <div class="detalhe-lider-pontos detalhe-lider-pontos-dia">${ganho > 0 ? "+" : ""}${ganho}<span>pontos no dia ${formatarDiaCurto(diaDetalheAtivo)}</span></div>\n    `;
  }
  function statusCor(frac) {
    if (frac >= .75) return "var(--green)";
    if (frac >= .45) return "var(--yellow)";
    return "var(--red)";
  }
  function renderComposicao(lider) {
    const body = document.getElementById("tabela-eventos-body");
    const linhas = [];
    DASHBOARD_DATA.pilares.forEach((pilar => {
      const area = AREAS_MAP[pilar.area];
      pilar.itens.forEach((item => {
        const pts = lider.pontos_por_item[item.id] ?? 0;
        const pctDoItem = item.pontos_max ? pts / item.pontos_max : 0;
        linhas.push({
          area: area,
          pilar: pilar,
          item: item,
          pts: pts,
          pctDoItem: pctDoItem
        });
      }));
    }));
    linhas.sort(((a, b) => a.pctDoItem - b.pctDoItem));
    body.innerHTML = linhas.map((({area: area, pilar: pilar, item: item, pts: pts, pctDoItem: pctDoItem}) => {
      const ptsClasse = "ev-pts " + (pctDoItem >= .8 ? "pts-pos" : pctDoItem >= .5 ? "" : "pts-neg");
      return `\n          <tr class="ev-row-clicavel" data-item-id="${item.id}">\n            <td><span class="pill-area" style="background:${area.cor}">${area.nome}</span></td>\n            <td class="ev-pilar">${pilar.nome}</td>\n            <td>${item.nome} <svg class="ev-seta" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></td>\n            <td class="ev-resp">${pilar.responsavel}</td>\n            <td class="${ptsClasse}">${pts}/${item.pontos_max}</td>\n          </tr>\n          <tr class="ev-row-detalhe" data-item-detalhe="${item.id}" hidden>\n            <td colspan="5"></td>\n          </tr>`;
    })).join("");
    body.onclick = e => {
      const linha = e.target.closest(".ev-row-clicavel");
      if (!linha) return;
      abrirFecharDetalheItem(linha, lider);
    };
  }
  const REGRAS_ITENS = {
    retrabalho_registrado: {
      faixas: [ [ "Nenhum retrabalho", 6 ], [ "1 retrabalho ou mais", 0 ] ],
      dica: "Esse item não se recupera dentro do mês: um retrabalho já zera. O foco é evitar novos retrabalhos na equipe.",
      pendente: "Retrabalhos que contaram no mês",
      revisar: "Retrabalhos registrados no mês (atribuídos a você)"
    },
    analise_causa: {
      faixas: [ [ "Acima de 85%", 10 ], [ "60% a 85%", 7 ], [ "30% a 60%", 3 ], [ "Abaixo de 30%", 0 ] ],
      pendente: "Retrabalhos sem análise dentro de 7 dias",
      acao: "Fazer a análise de causa de cada retrabalho em até 7 dias depois do registro."
    },
    acoes_melhoria: {
      faixas: [ [ "Acima de 85%", 9 ], [ "60% a 85%", 5 ], [ "30% a 60%", 2 ], [ "Abaixo de 30%", 0 ] ],
      pendente: "Ações de melhoria atrasadas",
      acao: "Concluir cada ação de melhoria antes do prazo dela."
    },
    capacitacao_lider: {
      faixas: [ [ "100% das capacitações concluídas", 5 ], [ "Faltando alguma capacitação", 0 ] ],
      pendente: "Capacitações pendentes",
      acao: "Concluir as capacitações que faltam."
    },
    capacitacao_equipe: {
      faixas: [ [ "Acima de 75% das capacitações da equipe", 10 ], [ "75% ou menos", 0 ] ],
      pendente: "Colaboradores com capacitação pendente",
      revisar: "Sem capacitação atribuída — conferir com a equipe de Processos",
      emDia: "Colaboradores com todas as capacitações concluídas",
      acao: "Garantir que esses colaboradores concluam as capacitações que faltam."
    },
    integracao_novos: {
      faixas: [ [ "60% ou mais das capacitações em até 45 dias", 10 ], [ "Abaixo de 60%", 0 ] ],
      pendente: "Novos colaboradores que passaram dos 45 dias sem concluir as capacitações",
      acao: "Garantir que todo novo colaborador conclua as capacitações em até 45 dias da admissão."
    },
    faltas_equipe: {
      faixas: [ [ "Até 4% de faltas", 4 ], [ "Acima de 4%", 0 ] ],
      acao: "Ausências justificadas não contam — o foco são as faltas sem justificativa."
    },
    conversa_retorno: {
      faixas: [ [ "Acima de 85%", 11 ], [ "65% a 85%", 7 ], [ "45% a 65%", 4 ], [ "Abaixo de 45%", 0 ] ],
      pendente: "Faltas sem conversa de retorno dentro de 5 dias",
      revisar: "Pra conferir com a equipe de Pessoas",
      acao: "Fazer a conversa de retorno em até 5 dias depois da falta."
    },
    ajuste_escala: {
      faixas: [ [ "Todos os ajustes no prazo", 6 ], [ "Algum ajuste fora do prazo", 0 ] ],
      pendente: "Ajustes de escala fora do prazo",
      acao: "Enviar o ajuste de escala à equipe de Pessoas antes do dia do ajuste."
    },
    fechamento_ponto: {
      faixas: [ [ "4 semanas OK", 8 ], [ "3 semanas OK", 6 ], [ "2 semanas OK", 4 ], [ "1 semana OK", 2 ], [ "Nenhuma semana OK", 0 ] ],
      pendente: "Semanas com problema",
      acao: "Devolver o fechamento de ponto completo na sexta-feira (ele é enviado na quinta). Cada semana OK vale 2 pts."
    },
    conversa_seguranca: {
      faixas: [ [ "85% ou mais no prazo", 6 ], [ "Abaixo de 85%", 0 ] ],
      pendente: "Conversas de segurança fora do prazo",
      acao: "Registrar a conversa de segurança em até 3 dias depois de realizada."
    },
    rotina_seguranca: {
      faixas: [ [ "90% ou mais executado", 9 ], [ "Abaixo de 90%", 0 ] ],
      pendente: "Atividades abaixo da meta",
      acao: "Completar no mês a meta de cada atividade: inspeção de área, conversa com a equipe e checklist de segurança."
    },
    acoes_seguranca: {
      faixas: [ [ "85% ou mais no prazo (ou sem ação)", 6 ], [ "Abaixo de 85%", 0 ] ],
      pendente: "Ações de segurança atrasadas",
      acao: "Concluir cada ação de segurança até o prazo dela."
    }
  };
  const ITENS_LISTA_COMPLETA = new Set([ "capacitacao_lider", "capacitacao_equipe", "integracao_novos" ]);
  const ROTULOS_RESUMO = new Set([ "Retrabalhos no mês", "Análise de causa no prazo (7 dias)", "Ações de melhoria no prazo", "Análise de causa", "Ações de melhoria", "Faltas da equipe no mês", "Conversas de retorno", "Capacitações da equipe", "Rotina de segurança no mês", "Ações de segurança no prazo" ]);
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[c])));
  }
  function limparRotulo(r) {
    return String(r ?? "").replace(/(\d{4})-(\d{2})-(\d{2})( 00:00:00)?/g, ((_, a, m, d) => `${d}/${m}`));
  }
  function pctTexto(n, total) {
    return total ? `${Math.round(n / total * 100)}%` : "0%";
  }
  function numerosDoResumo(texto) {
    const m = String(texto || "").match(/(\d+)[^/\d]*\/\s*(\d+)[^=]*=\s*([\d.,]+)%/);
    if (!m) return null;
    return {
      a: +m[1],
      b: +m[2],
      pct: `${Math.round(parseFloat(m[3].replace(",", ".")))}%`
    };
  }
  function explicarPorque(itemId, pts, linhas, resumo) {
    const ok = linhas.filter((l => l.status === "ok")).length;
    const total = linhas.length;
    const r = resumo ? numerosDoResumo(resumo.detalhe) : null;
    switch (itemId) {
     case "retrabalho_registrado":
      {
        const n = resumo ? parseInt(resumo.detalhe, 10) || 0 : 0;
        return n === 0 ? "Nenhum retrabalho foi atribuído a você neste mês." : `Você teve <b>${n} retrabalho${n > 1 ? "s" : ""}</b> atribuído${n > 1 ? "s" : ""} a você neste mês.`;
      }

     case "analise_causa":
      if (!r) return /sem fonte/i.test(resumo?.detalhe || "") ? esc(resumo.detalhe) : "Nenhum retrabalho atribuído a você neste mês — não havia análise a fazer.";
      return `<b>${r.a} de ${r.b}</b> retrabalhos tiveram a análise de causa feita em até 7 dias do registro (<b>${r.pct}</b>).`;

     case "acoes_melhoria":
      if (!r) return /sem fonte/i.test(resumo?.detalhe || "") ? esc(resumo.detalhe) : "Nenhuma ação de melhoria com você como responsável neste mês — não havia entrega a fazer.";
      return `<b>${r.a} de ${r.b}</b> ações de melhoria estão concluídas ou ainda dentro do prazo (<b>${r.pct}</b>).`;

     case "capacitacao_lider":
      {
        if (!total) return "Não há capacitações atribuídas a você. Procure a equipe de Processos pra conferir.";
        const m = String(linhas[0].detalhe || "").match(/(\d+) de (\d+) procedimentos/);
        if (m && +m[1] === +m[2]) return `Você concluiu <b>todos os ${m[2]}</b> capacitações atribuídas a você.`;
        return m ? `Você concluiu <b>${m[1]} de ${m[2]}</b> capacitações atribuídas a você — o item exige 100%.` : ok ? "Você concluiu <b>todas</b> as capacitações." : "Você ainda tem <b>capacitação pendente</b>.";
      }

     case "capacitacao_equipe":
      if (!r) return "Nenhum colaborador da sua equipe tem capacitação atribuída. Se isso estiver errado, avise a equipe de Processos.";
      return `<b>${r.a} de ${r.b}</b> capacitações da sua equipe estão concluídas (<b>${r.pct}</b>), somando os ${linhas.filter((l => l.status !== "revisar")).length} colaboradores com capacitação atribuída.`;

     case "integracao_novos":
      {
        const avaliados = linhas.filter((l => l.status !== "aberto"));
        const abertos = linhas.length - avaliados.length;
        const sufixo = abertos ? ` ${abertos} novo${abertos > 1 ? "s colaboradores ainda estão" : " colaborador ainda está"} dentro do prazo.` : "";
        if (!avaliados.length) return "Nenhum novo colaborador da sua equipe completou 45 dias de casa neste mês — o critério não se aplica." + sufixo;
        let a = 0, b = 0;
        avaliados.forEach((l => {
          const m = String(l.detalhe || "").match(/(\d+) de (\d+) procedimentos/);
          if (m) {
            a += +m[1];
            b += +m[2];
          }
        }));
        return `Dos ${avaliados.length} novo${avaliados.length > 1 ? "s colaboradores" : " colaborador"} que completaram 45 dias de casa neste mês, <b>${a} de ${b}</b> capacitações foram concluídas dentro dos 45 dias (<b>${pctTexto(a, b)}</b>).` + sufixo;
      }

     case "acoes_seguranca":
      if (!total) return "Nenhuma ação de segurança com você como responsável e prazo neste mês.";
      if (!r) return esc(resumo?.detalhe || "") + ".";
      return `<b>${r.a} de ${r.b}</b> ações de segurança com prazo vencido foram concluídas até o prazo (<b>${r.pct}</b>). O item exige 85%.`;

     case "rotina_seguranca":
      if (!r) return esc(resumo?.detalhe || "Sem registro da sua rotina de segurança neste mês. Procure a equipe de Segurança pra conferir.");
      return `Você fez <b>${r.a} de ${r.b}</b> atividades da meta da rotina de segurança do seu cargo (<b>${r.pct}</b>). O item exige 85%.`;

     case "faltas_equipe":
      {
        const m = String(resumo?.detalhe || "").match(/(\d+) dia\(s\) de ausência \/ (\d+) dia\(s\) programados.*=\s*([\d.,]+)%/);
        if (!m) return "Sem dado de faltas da sua equipe neste mês.";
        const at = String(resumo?.detalhe || "").match(/atestados fora da conta: (\d+)/);
        const nAt = at ? +at[1] : 0;
        const txtAt = nAt ? ` Os <b>${nAt} dia${nAt === 1 ? "" : "s"}  justificados</b> não entram nessa conta.` : " Ausência justificada não entra nessa conta.";
        return `Sua equipe teve <b>${m[1]} dia${+m[1] === 1 ? "" : "s"} de falta</b> em ${m[2]} dias programados = <b>${m[3].replace(".", ",")}%</b> de faltas.` + txtAt;
      }

     case "conversa_retorno":
      if (!r) return "Ninguém da sua equipe faltou neste mês (ausência justificada não conta) — não havia conversa a fazer.";
      return `<b>${r.a} de ${r.b}</b> faltas da equipe tiveram a conversa de retorno feita em até 5 dias (<b>${r.pct}</b>). Falta justificada não entra nessa conta.`;

     case "ajuste_escala":
      {
        if (!total) return "Ninguém da sua equipe pediu ajuste de escala neste mês.";
        const abertas = linhas.filter((l => l.status === "aberto")).length;
        const fora = linhas.filter((l => l.status === "pendente")).length;
        const avaliadas = total - abertas;
        const sufixo = abertas ? ` ${abertas} pedido${abertas > 1 ? "s ainda estão" : " ainda está"} sem a data do ajuste definida.` : "";
        if (!avaliadas) return "Os pedidos de ajuste da sua equipe ainda estão sem a data do ajuste definida." + sufixo;
        return (fora ? `<b>${fora} de ${avaliadas}</b> ajustes de escala da equipe foram pedidos <b>depois do dia do ajuste</b> — basta um pra zerar o item.` : `Todas as <b>${avaliadas}</b> ajustes de escala da equipe foram pedidos antes do dia do ajuste.`) + sufixo;
      }

     case "fechamento_ponto":
      {
        if (!total) return "Não há fechamento de ponto da sua equipe registrado neste mês. Procure a equipe de Pessoas pra conferir.";
        const abertas = linhas.filter((l => l.status === "aberto")).length;
        const avaliadas = total - abertas;
        const sufixo = abertas ? ` ${abertas} semana${abertas > 1 ? "s ainda estão" : " ainda está"} dentro do prazo de devolução.` : "";
        if (!avaliadas) return "Nenhuma semana do mês chegou ao fim do prazo de devolução ainda." + sufixo;
        return `<b>${ok} de ${avaliadas}</b> semanas com todos os fechamentos da equipe devolvidos completos e no prazo (2 pontos por semana, até 8).` + sufixo;
      }

     case "conversa_seguranca":
      {
        if (!total) return "Não há conversa de segurança registrada com você como responsável neste mês. Procure a equipe de Segurança pra conferir.";
        const avaliados = linhas.filter((l => l.status !== "aberto"));
        const abertos = total - avaliados.length;
        const sufixo = abertos ? ` ${abertos} conversa${abertos > 1 ? "s ainda estão" : " ainda está"} dentro do prazo de registro.` : "";
        if (!avaliados.length) return "Nenhuma conversa de segurança do mês chegou ao fim do prazo de registro ainda." + sufixo;
        return `<b>${ok} de ${avaliados.length}</b> conversas de segurança foram registradas em até 3 dias (<b>${pctTexto(ok, avaliados.length)}</b>).` + sufixo;
      }

     default:
      return "";
    }
  }
  function faixaAtual(faixas, pts) {
    let i = faixas.findIndex((([, p]) => p === pts));
    if (i === -1) i = faixas.findIndex((([, p]) => p <= pts));
    return i === -1 ? faixas.length - 1 : i;
  }
  const ICONE = {
    ok: `<svg class="ev-status-icone ok" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
    pendente: `<svg class="ev-status-icone pendente" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    aberto: `<svg class="ev-status-icone aberto" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>`,
    revisar: `<svg class="ev-status-icone revisar" viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/></svg>`
  };
  function humanizarDetalhe(d, status) {
    let m = d.match(/^(\d+) dia\(s\) desde a formalização - (?:ainda sem marcação|status: (.+))$/);
    if (m) {
      const dias = +m[1], st = m[2];
      if (st === "Sim") return "Análise feita dentro do prazo";
      if (st === "Não") return "Análise feita fora do prazo de 7 dias";
      if (status === "ok") {
        const faltam = Math.max(10 - dias, 0);
        return `Registrado há ${dias} dia${dias === 1 ? "" : "s"} — ${faltam ? `faltam ${faltam} dia${faltam === 1 ? "" : "s"} pra fazer a análise` : "último dia pra fazer a análise"}`;
      }
      return `Registrado há ${dias} dias — análise não feita dentro de 7 dias`;
    }
    m = d.match(/^Prazo: (\S+) - (?:ainda sem marcação|status: (.+))$/);
    if (m) {
      const prazo = m[1], st = (m[2] || "").trim();
      if (/^(no prazo|sim)$/i.test(st)) return `Entregue no prazo (prazo: ${prazo})`;
      if (/^(atrasado|fora do prazo|não)$/i.test(st)) return `Atrasado — o prazo era ${prazo}`;
      if (!st) return status === "ok" ? `Vence em ${prazo} — ainda não entregue` : `Venceu em ${prazo} — não entregue`;
      return `Prazo: ${prazo} — situação: ${st}`;
    }
    if (/falta na véspera\/depois da folga/i.test(d)) {
      return "Falta junto à folga — pode ser justificada no fechamento do mês.";
    }
    return d;
  }
  function humanizarRotulo(r) {
    return limparRotulo(r).replace(/ - PA(\d+) \(/, " · Ação $1 (");
  }
  function renderLinhaDetalhe(l, tipo) {
    const detalhe = humanizarDetalhe(String(l.detalhe || ""), l.status);
    const obs = detalhe.includes(" | ") ? `<span class="exp-linha-campos">${detalhe.split(" | ").map((p => {
      const [k, ...v] = p.split(": ");
      return v.length ? `<span><b>${esc(k)}:</b> ${esc(v.join(": "))}</span>` : `<span>${esc(p)}</span>`;
    })).join("")}</span>` : detalhe ? `<span class="ev-detalhe-item-obs">${esc(detalhe)}</span>` : "";
    return `\n      <div class="ev-detalhe-item exp-linha-${tipo}">\n        ${ICONE[tipo] || ICONE.revisar}\n        <div class="ev-detalhe-item-texto">\n          <span class="ev-detalhe-item-rotulo">${esc(humanizarRotulo(l.rotulo))}</span>\n          ${obs}\n        </div>\n      </div>`;
  }
  function renderGrupo(tipo, titulo, linhas, {subtitulo: subtitulo = "", recolhido: recolhido = false} = {}) {
    if (!linhas.length) return "";
    const corpo = `<div class="ev-detalhe-grid">${linhas.map((l => renderLinhaDetalhe(l, tipo))).join("")}</div>`;
    const cab = `<span class="exp-grupo-titulo">${ICONE[tipo]}${esc(titulo)} <span class="exp-grupo-qtd">${linhas.length}</span></span>`;
    if (recolhido) {
      return `\n        <details class="exp-grupo exp-grupo-${tipo}">\n          <summary>${cab}<span class="exp-grupo-ver">ver lista</span></summary>\n          ${subtitulo ? `<div class="exp-grupo-sub">${subtitulo}</div>` : ""}\n          ${corpo}\n        </details>`;
    }
    return `\n      <div class="exp-grupo exp-grupo-${tipo}">\n        ${cab}\n        ${subtitulo ? `<div class="exp-grupo-sub">${subtitulo}</div>` : ""}\n        ${corpo}\n      </div>`;
  }
  function renderConteudoDetalheItem(lider, itemId, item) {
    const linhas = lider.detalhe_por_item && lider.detalhe_por_item[itemId] || [];
    const pts = (lider.pontos_por_item && lider.pontos_por_item[itemId]) ?? 0;
    const max = item.pontos_max;
    const perdeu = max - pts;
    const regra = REGRAS_ITENS[itemId] || {
      faixas: []
    };
    const classeNota = pts === max ? "ok" : pts === 0 ? "zero" : "parcial";
    const statusNota = pts === max ? "Pontuação completa" : `Perdeu ${perdeu} ponto${perdeu > 1 ? "s" : ""}`;
    const nota = `\n      <div class="exp-nota exp-nota-${classeNota}">\n        <div class="exp-nota-pts">${pts}<span>/${max}</span></div>\n        <div class="exp-nota-status">${statusNota}</div>\n      </div>`;
    if (item.sem_fonte) {
      return `\n        <div class="exp">\n          <div class="exp-topo">\n            <div class="exp-nota">\n              <div class="exp-nota-pts">–<span>/${max}</span></div>\n              <div class="exp-nota-status" style="color:var(--text-dim)">Sem dados ainda</div>\n            </div>\n            <div class="exp-porque">\n              <div class="exp-titulo">Por que essa nota?</div>\n              <p>Esse item <b>ainda não tem fonte de dados</b> — está com 0 para <b>todos</b> os líderes\n              até a área responsável (${esc(DASHBOARD_DATA.pilares.find((p => p.itens.includes(item)))?.responsavel || "-")}) começar a medir.\n              Não é ponto perdido por você.</p>\n            </div>\n          </div>\n        </div>`;
    }
    const resumo = linhas.find((l => ROTULOS_RESUMO.has(l.rotulo)));
    const listaveis = linhas.filter((l => l !== resumo));
    const retratoDia = lider._retrato_dia;
    let porque = retratoDia ? "No retrato de um dia específico guardamos só os pontos, não os nomes. Escolha <b>Mês inteiro</b> para ver o detalhe." : explicarPorque(itemId, pts, listaveis, resumo);
    let regua = "", proxima = "";
    if (regra.faixas.length) {
      const iAtual = faixaAtual(regra.faixas, pts);
      const [textoAtual, ptsAtual] = regra.faixas[iAtual];
      const naoSeAplica = pts === max && (/não se aplica/i.test(resumo?.detalhe || "") || !listaveis.filter((l => l.status !== "aberto")).length && [ "integracao_novos", "ajuste_escala", "conversa_retorno", "acoes_seguranca" ].includes(itemId));
      if (retratoDia) {} else if (naoSeAplica) {
        porque += " Como não havia nada a cumprir, o item vale a <b>pontuação completa</b>.";
      } else {
        porque += ` Na faixa <b>${esc(textoAtual)}</b>, o item vale <b>${ptsAtual} ponto${ptsAtual === 1 ? "" : "s"}</b>.`;
      }
      regua = `\n        <div class="exp-regua">\n          ${regra.faixas.map((([txt, p], i) => `\n            <div class="exp-faixa${i === iAtual ? ` exp-faixa-atual exp-faixa-${classeNota}` : ""}">\n              <span class="exp-faixa-pts">${p} pt${p === 1 ? "" : "s"}</span>\n              <span class="exp-faixa-txt">${esc(txt)}</span>\n              ${i === iAtual ? `<span class="exp-faixa-voce">você está aqui</span>` : ""}\n            </div>`)).join("")}\n        </div>`;
      if (iAtual > 0 && regra.dica) {
        proxima = `<div class="exp-proxima">${esc(regra.dica)}</div>`;
      } else if (iAtual > 0) {
        const [txtAcima, ptsAcima] = regra.faixas[iAtual - 1];
        proxima = `<div class="exp-proxima"><b>Pra subir pra ${ptsAcima} pts:</b> chegar em "${esc(txtAcima)}".${regra.acao ? ` ${esc(regra.acao)}` : ""}</div>`;
      }
    }
    const semMarcacao = l => /ainda sem marcação/i.test(l.detalhe || "");
    const pend = listaveis.filter((l => l.status === "pendente"));
    const aberto = listaveis.filter((l => l.status === "aberto" || l.status === "ok" && semMarcacao(l)));
    const revisar = listaveis.filter((l => ![ "ok", "pendente", "aberto" ].includes(l.status)));
    const emDia = listaveis.filter((l => l.status === "ok" && !semMarcacao(l)));
    const grupos = renderGrupo("pendente", regra.pendente || "Pendente", pend, {
      subtitulo: regra.acao ? `O que fazer: ${esc(regra.acao)}` : ""
    }) + renderGrupo("aberto", "Em aberto — ainda dentro do prazo", aberto, {
      subtitulo: itemId === "integracao_novos" ? "Ainda dentro dos 45 dias — só entram na conta no mês em que o prazo vencer." : itemId === "conversa_seguranca" ? "Ainda dentro dos 3 dias — entram na conta quando o registro chegar ou o prazo vencer." : itemId === "acoes_seguranca" ? "Ainda dentro do prazo — entram na conta quando forem concluídas ou o prazo vencer." : itemId === "rotina_seguranca" ? "O mês ainda não acabou — ainda dá tempo de completar a meta dessas atividades." : itemId === "fechamento_ponto" ? "Ainda dentro do prazo de devolução — entram na conta quando voltarem ou o prazo vencer." : itemId === "ajuste_escala" ? "Pedidos sem a data do ajuste definida — entram na conta quando a data for preenchida." : "Ainda contam como OK, mas precisam ser concluídos antes de vencer."
    }) + renderGrupo("revisar", regra.revisar || "Pra conferir", revisar) + renderGrupo("ok", regra.emDia || "Em dia", emDia, {
      recolhido: !ITENS_LISTA_COMPLETA.has(itemId) && (emDia.length > 6 || pend.length + aberto.length + revisar.length > 0)
    });
    return `\n      <div class="exp">\n        <div class="exp-topo">\n          ${nota}\n          <div class="exp-porque">\n            <div class="exp-titulo">Por que essa nota?</div>\n            <p>${porque}</p>\n            ${regua}\n            ${proxima}\n          </div>\n        </div>\n        ${grupos ? `<div class="exp-grupos">${grupos}</div>` : ""}\n      </div>`;
  }
  function abrirFecharDetalheItem(linhaClicavel, lider) {
    const itemId = linhaClicavel.dataset.itemId;
    const linhaDetalhe = linhaClicavel.nextElementSibling;
    const jaAberta = !linhaDetalhe.hidden;
    document.querySelectorAll(".ev-row-detalhe:not([hidden])").forEach((tr => {
      tr.hidden = true;
      tr.previousElementSibling.classList.remove("ev-row-aberta");
    }));
    if (jaAberta) return;
    const pilar = DASHBOARD_DATA.pilares.find((p => p.itens.some((it => it.id === itemId))));
    const item = pilar.itens.find((it => it.id === itemId));
    linhaDetalhe.querySelector("td").innerHTML = renderConteudoDetalheItem(lider, itemId, item);
    linhaDetalhe.hidden = false;
    linhaClicavel.classList.add("ev-row-aberta");
  }
  function renderFoco(lider) {
    const wrap = document.getElementById("foco-row");
    const oportunidades = [];
    DASHBOARD_DATA.pilares.forEach((pilar => {
      const area = AREAS_MAP[pilar.area];
      pilar.itens.forEach((item => {
        const pts = lider.pontos_por_item[item.id] ?? 0;
        const gap = item.pontos_max - pts;
        if (gap > 0) oportunidades.push({
          area: area,
          pilar: pilar,
          item: item,
          pts: pts,
          gap: gap
        });
      }));
    }));
    oportunidades.sort(((a, b) => b.gap - a.gap));
    const top = oportunidades.slice(0, 3);
    if (top.length === 0) {
      wrap.innerHTML = `<div class="foco-vazio">🎉 Pontuação máxima em todos os itens neste mês.</div>`;
      return;
    }
    wrap.innerHTML = top.map((({area: area, pilar: pilar, item: item, pts: pts, gap: gap}) => `\n        <div class="foco-card">\n          <div class="foco-card-top">\n            <span class="pill-area" style="background:${area.cor}">${area.nome}</span>\n            <span class="foco-gap">−${gap} pt${gap > 1 ? "s" : ""}</span>\n          </div>\n          <div class="foco-item">${item.nome}</div>\n          <div class="foco-pilar">${pilar.nome} · ${pilar.responsavel}</div>\n          <div class="foco-criterio">${item.criterio}</div>\n          <div class="foco-atual">Hoje: <b>${pts}/${item.pontos_max}</b></div>\n        </div>`)).join("");
  }
  const ALTURA_GRAFICO_PX = 150;
  function renderGraficoEvolucao(lider) {
    const svg = document.getElementById("grafico-evolucao");
    const H = ALTURA_GRAFICO_PX;
    const serie = DIAS_HISTORICO.map((dia => ({
      dia: dia,
      snap: snapshotDoDia(lider, dia)
    }))).filter((p => p.snap));
    if (serie.length === 0) {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.innerHTML = `<text x="10" y="20" font-size="12" fill="var(--text-dim)">Sem retrato histórico pra essa pessoa ainda.</text>`;
      return;
    }
    const valores = serie.map((p => p.snap.pontos_total));
    const PX_POR_DIA = 42;
    const diasDesdeOPrimeiro = serie.map((p => {
      const [ano, mes, dia] = p.dia.split("-").map(Number);
      const [ano0, mes0, dia0] = serie[0].dia.split("-").map(Number);
      return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(ano0, mes0 - 1, dia0)) / 864e5);
    }));
    const padL = 10, padR = 38, padT = 26, padB = 20;
    const W = padL + padR + diasDesdeOPrimeiro[diasDesdeOPrimeiro.length - 1] * PX_POR_DIA;
    const max = Math.max(...valores, 1) * 1.15;
    const y0 = H - padB;
    const yTop = padT;
    const pontos = valores.map(((v, i) => {
      const x = padL + diasDesdeOPrimeiro[i] * PX_POR_DIA;
      const y = y0 - v / max * (y0 - yTop);
      return [ x, y ];
    }));
    const linha = pontos.map((p => p.join(","))).join(" ");
    const areaPreenchida = `${padL},${y0} ` + linha + ` ${pontos[pontos.length - 1][0]},${y0}`;
    const gradeH = [ .25, .5, .75 ].map((f => {
      const y = y0 - f * (y0 - yTop);
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(43,49,64,.08)" stroke-width="1"></line>`;
    })).join("");
    const ultimoIndex = serie.length - 1;
    const diaSelecionadoIndex = diaDetalheAtivo !== "mes" ? serie.findIndex((p => p.dia === diaDetalheAtivo)) : -1;
    const pontosDesenhados = pontos.map((([x, y], i) => {
      const ehUltimo = i === ultimoIndex;
      const ehSelecionado = i === diaSelecionadoIndex && !ehUltimo;
      const cor = ehSelecionado ? "var(--blue, #2563eb)" : ehUltimo ? "var(--red)" : "var(--text-dim)";
      const raio = ehUltimo || ehSelecionado ? 5 : 3.5;
      const pesoTexto = ehUltimo || ehSelecionado ? "700" : "600";
      return `\n          <circle cx="${x}" cy="${y}" r="${raio}" fill="${cor}" stroke="#fff" stroke-width="2"></circle>\n          <text x="${x}" y="${Math.max(y - 11, 12)}" font-size="11.5" font-weight="${pesoTexto}" text-anchor="middle" fill="${ehUltimo ? "var(--text-bright)" : cor}">${valores[i]}</text>\n        `;
    })).join("");
    let rotuloGanhoNoHoje = "";
    if (diaSelecionadoIndex === ultimoIndex && diaSelecionadoIndex !== -1) {
      const {ganho: ganho} = pontosDesdeRetratoAnterior(lider, diaDetalheAtivo);
      const [x, y] = pontos[ultimoIndex];
      rotuloGanhoNoHoje = `<text x="${x}" y="${Math.max(y - 24, 12)}" font-size="11.5" font-weight="700" text-anchor="middle" fill="var(--blue, #2563eb)">${ganho > 0 ? "+" : ""}${ganho}</text>`;
    }
    const rotulosDia = serie.map(((p, i) => {
      const ehUltimo = i === ultimoIndex;
      return `<text x="${pontos[i][0]}" y="${H - 5}" font-size="9.5" text-anchor="middle" fill="${ehUltimo ? "var(--red)" : "var(--text-dim)"}" font-weight="${ehUltimo ? "700" : "400"}">${ehUltimo ? "Hoje" : formatarDiaCurto(p.dia)}</text>`;
    })).join("");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `\n      ${gradeH}\n      <polyline points="${areaPreenchida}" fill="rgba(200,23,47,0.10)" stroke="none"></polyline>\n      <polyline points="${linha}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>\n      <line x1="0" y1="${y0}" x2="${W}" y2="${y0}" stroke="rgba(43,49,64,.18)"></line>\n      ${rotulosDia}\n      ${pontosDesenhados}\n      ${rotuloGanhoNoHoje}\n    `;
    const wrapper = svg.parentElement;
    if (diaSelecionadoIndex !== -1) {
      wrapper.scrollLeft = Math.max(0, pontos[diaSelecionadoIndex][0] - wrapper.clientWidth / 2);
    } else {
      wrapper.scrollLeft = wrapper.scrollWidth;
    }
  }
  function renderGaugesAreas(lider) {
    const wrap = document.getElementById("gauges-areas");
    const R = 34, C = 2 * Math.PI * R;
    const gaugeSvg = (frac, cor, rotuloCentro, rotuloBaixo, trilho = "rgba(43,49,64,.09)", corTexto = "var(--text-bright)") => `\n      <svg viewBox="0 0 84 84">\n        <circle cx="42" cy="42" r="${R}" fill="none" stroke="${trilho}" stroke-width="9"></circle>\n        ${frac > 0 ? `<circle cx="42" cy="42" r="${R}" fill="none" stroke="${cor}" stroke-width="9"\n          stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"\n          transform="rotate(-90 42 42)"></circle>` : ""}\n        <text x="42" y="39" font-size="17" font-weight="800" text-anchor="middle" fill="${corTexto}">${rotuloCentro}</text>\n        <text x="42" y="53" font-size="9.5" text-anchor="middle" fill="var(--text-dim)">${rotuloBaixo}</text>\n      </svg>`;
    const fmtPct = p => Number.isInteger(p) ? `${p}%` : `${p.toFixed(1).replace(".", ",")}%`;
    const trilhoDe = cor => ({
      "var(--green)": "rgba(22,163,74,.18)",
      "var(--yellow)": "rgba(184,134,11,.20)",
      "var(--red)": "rgba(200,23,47,.18)"
    }[cor]);
    const gaugesArea = DASHBOARD_DATA.areas.map((a => {
      const v = lider.pontos_por_area[a.id] || 0;
      const frac = a.pontos_max ? v / a.pontos_max : 0;
      const cor = statusCor(frac);
      const pct = Math.round(frac * 1e3) / 10;
      return `\n          <div class="gauge-item">\n            ${gaugeSvg(frac, cor, fmtPct(pct), `${v}/${a.pontos_max}`, trilhoDe(cor), cor)}\n            <div class="gauge-label">${a.nome}</div>\n          </div>`;
    })).join("");
    const slaItens = lider.sla_itens || [];
    const dentroDaMeta = si => typeof si.meta === "number" ? si.pct >= si.meta : si.pct >= 80;
    const corSla = si => dentroDaMeta(si) ? "var(--green)" : "var(--red)";
    const trilhoSla = si => trilhoDe(corSla(si));
    const gaugesSla = slaItens.length ? slaItens.map((si => {
      const temPct = typeof si.pct === "number";
      const fracSla = temPct ? si.pct / 100 : 0;
      const rotuloMeta = typeof si.meta === "number" ? `meta ${String(si.meta).replace(".", ",")}%` : `SLA ${si.item}`;
      const titulo = `${si.indicador || `SLA ${si.item}`}` + (temPct ? ` — ${String(si.pct).replace(".", ",")}% no mês (${si.dentro ?? "?"} dentro / ${si.fora ?? "?"} fora)` : " — sem carga no período");
      return `\n              <div class="gauge-item" title="${esc(titulo)}">\n                ${temPct ? gaugeSvg(fracSla, corSla(si), fmtPct(si.pct), rotuloMeta, trilhoSla(si), corSla(si)) : gaugeSvg(0, "rgba(43,49,64,.15)", "—", "sem carga")}\n                <div class="gauge-label">SLA ${si.item}</div>\n              </div>`;
    })).join("") : `\n        <div class="gauge-item">\n          ${gaugeSvg(0, "rgba(43,49,64,.15)", "—", "sem dado")}\n          <div class="gauge-label">SLA</div>\n        </div>`;
    wrap.innerHTML = gaugesArea + gaugesSla;
  }
  function liderParaExibir(lider) {
    if (diaDetalheAtivo === "mes") return lider;
    const snap = snapshotDoDia(lider, diaDetalheAtivo);
    if (!snap) return null;
    return {
      ...lider,
      pontos_total: snap.pontos_total,
      pontos_por_area: snap.pontos_por_area,
      pontos_por_item: snap.pontos_por_item,
      sla_itens: snap.sla_itens,
      detalhe_por_item: {},
      _retrato_dia: true
    };
  }
  function renderDetalhe(liderId) {
    const lider = DASHBOARD_DATA.lideres.find((l => l.id === liderId));
    if (!lider) return;
    seletor.value = lider.id;
    renderInfoLider(lider);
    renderGraficoEvolucao(lider);
    const exibir = liderParaExibir(lider);
    const avisoDia = document.getElementById("detalhe-sem-retrato");
    if (!exibir) {
      if (avisoDia) avisoDia.hidden = false;
      renderFoco({
        pontos_por_item: {}
      });
      renderComposicao({
        pontos_por_item: {},
        detalhe_por_item: {}
      });
      renderGaugesAreas({
        pontos_por_area: {
          qualidade: 0,
          rh: 0,
          ssma: 0
        },
        sla_itens: []
      });
      return;
    }
    if (avisoDia) avisoDia.hidden = true;
    renderFoco(exibir);
    renderComposicao(exibir);
    renderGaugesAreas(exibir);
  }
  const TIPOS_PONTUACAO = {
    cheio: {
      rotulo: "Começa cheio",
      explica: "Começa o mês com a pontuação completa e só perde se acontecer algum problema."
    },
    enche: {
      rotulo: "Começa em zero",
      explica: "Começa o mês zerado e vai ganhando pontos conforme as entregas acontecem."
    },
    status: {
      rotulo: "Situação atual",
      explica: "Não zera na virada do mês: mostra a situação de hoje."
    }
  };
  const COMO_FUNCIONA_ITEM = {
    retrabalho_registrado: [ "cheio", "Sem retrabalho no mês, fica com 6. Qualquer retrabalho atribuído a você no mês zera o item." ],
    analise_causa: [ "cheio", "Cada retrabalho precisa de análise de causa em até 7 dias do registro. Análises no prazo: acima de 85% = 10 · 60% a 85% = 7 · 30% a 60% = 3 · abaixo de 30% = 0. Sem retrabalho no mês, fica com 10." ],
    acoes_melhoria: [ "cheio", "Cada ação de melhoria precisa ser concluída até o prazo dela. Acima de 85% = 9 · 60% a 85% = 5 · 30% a 60% = 2 · abaixo de 30% = 0. Sem ação no mês, fica com 9." ],
    capacitacao_lider: [ "status", "Vale 5 quando 100% das capacitações atribuídas a você estão concluídas." ],
    capacitacao_equipe: [ "status", "Vale 10 quando mais de 75% das capacitações atribuídas à sua equipe estão concluídas (conta capacitação por capacitação)." ],
    integracao_novos: [ "cheio", "Todo novo colaborador tem 45 dias desde a admissão pra concluir as capacitações. Quando esse prazo vence no mês, ele entra na conta: pelo menos 60% das capacitações desses colaboradores precisam estar concluídas dentro dos 45 dias, senão vai a 0. Sem novo colaborador no período, fica com 10." ],
    faltas_equipe: [ "cheio", "Se as faltas da equipe passarem de 4% dos dias programados no mês, vai a 0. Ausência justificada não conta." ],
    conversa_retorno: [ "cheio", "Cada falta sem justificativa precisa de conversa de retorno em até 5 dias. Conversas no prazo: acima de 85% = 11 · 65% a 85% = 7 · 45% a 65% = 4 · abaixo de 45% = 0. Se ninguém faltou, fica com 11." ],
    ajuste_escala: [ "cheio", "Todo ajuste de escala da equipe precisa ser enviado antes do dia do ajuste. Um único pedido fora do prazo zera o item." ],
    fechamento_ponto: [ "enche", "O fechamento de ponto é enviado na quinta e volta completo na sexta. Cada semana em que todos os fechamentos da equipe voltaram completos e no prazo soma 2 pts, até 8 no mês." ],
    conversa_seguranca: [ "enche", "Vale 6 quando 85% ou mais das conversas de segurança do mês forem registradas em até 3 dias." ],
    rotina_seguranca: [ "enche", "Meta mensal por cargo de inspeção de área, conversa com a equipe e checklist de segurança (líder: 8 · 8 · 2). Vale 9 com 90% ou mais da meta feita no mês." ],
    acoes_seguranca: [ "cheio", "Ações de segurança com você como responsável e prazo no mês: vale 6 com 85% ou mais concluídas até o prazo. Sem ação no mês, fica com 6." ]
  };
  function montarAjuda() {
    const corpo = document.getElementById("ajuda-corpo");
    const badge = tipo => `<span class="ajuda-tipo ajuda-tipo-${tipo}">${TIPOS_PONTUACAO[tipo].rotulo}</span>`;
    const areas = DASHBOARD_DATA.areas.map((a => {
      const itens = DASHBOARD_DATA.pilares.filter((p => p.area === a.id)).flatMap((p => p.itens.map((it => ({
        pilar: p,
        it: it
      })))));
      const linhas = itens.map((({pilar: pilar, it: it}) => {
        const [tipo, texto] = COMO_FUNCIONA_ITEM[it.id] || [ "cheio", it.criterio ];
        return `\n          <div class="ajuda-item">\n            <div class="ajuda-item-topo">\n              <span class="ajuda-item-nome">${esc(it.nome)}</span>\n              <span class="ajuda-item-pts">${it.pontos_max} pts</span>\n            </div>\n            <div class="ajuda-item-tags">${badge(tipo)}<span class="ajuda-item-pilar">${esc(pilar.nome)} · ${esc(pilar.responsavel)}</span></div>\n            <p>${esc(texto)}</p>\n          </div>`;
      })).join("");
      return `\n        <div class="ajuda-area">\n          <h4><span class="pill-area" style="background:${a.cor}">${esc(a.nome)}</span> vale ${a.pontos_max} pontos</h4>\n          <div class="ajuda-itens">${linhas}</div>\n        </div>`;
    })).join("");
    corpo.innerHTML = `\n      <section class="ajuda-secao">\n        <h3>A rodada</h3>\n        <ul>\n          <li>Cada <b>mês é uma rodada</b>, do dia 1º ao último dia. No dia 1º tudo recomeça.</li>\n          <li>São <b>100 pontos</b> por mês: Processos 50, Pessoas 29 e Segurança 21.</li>\n          <li>O painel é <b>atualizado uma vez por dia</b>. O gráfico "Evolução no mês" guarda a sua pontuação de cada dia.</li>\n          <li>Os três primeiros do mês ficam em <b>destaque</b> no painel.</li>\n          <li>A classificação final sai no <b>fechamento do mês</b>.</li>\n        </ul>\n      </section>\n\n      <section class="ajuda-secao">\n        <h3>Como cada ponto se comporta</h3>\n        <div class="ajuda-legenda">\n          ${Object.keys(TIPOS_PONTUACAO).map((t => `<div>${badge(t)}<span>${TIPOS_PONTUACAO[t].explica}</span></div>`)).join("")}\n        </div>\n        <p class="ajuda-nota">Por isso, no dia 1º, ninguém começa com zero: os itens que começam cheios já valem os pontos até aparecer algum problema.</p>\n      </section>\n\n      <section class="ajuda-secao">\n        <h3>Os critérios</h3>\n        ${areas}\n      </section>\n\n      <section class="ajuda-secao">\n        <h3>SLA</h3>\n        <ul>\n          <li>O SLA é <b>informativo</b>: não entra nos 100 pontos.</li>\n          <li>Cada líder vê os indicadores da <b>própria área</b>, no <b>seu turno</b>, somando o mês.</li>\n          <li><span class="ajuda-cor" style="background:var(--green)"></span> na meta ou acima ·\n              <span class="ajuda-cor" style="background:var(--red)"></span> abaixo da meta ·\n              <span class="ajuda-cor" style="background:rgba(43,49,64,.25)"></span> sem movimento no período.</li>\n        </ul>\n      </section>\n\n      <section class="ajuda-secao">\n        <h3>Cores das áreas</h3>\n        <ul>\n          <li><span class="ajuda-cor" style="background:var(--green)"></span> 75% ou mais ·\n              <span class="ajuda-cor" style="background:var(--yellow)"></span> 45% a 74% ·\n              <span class="ajuda-cor" style="background:var(--red)"></span> abaixo de 45%.</li>\n          <li>Na <b>Composição completa da pontuação</b>, clique em qualquer item pra ver a sua nota, o porquê e o que fazer pra subir.</li>\n        </ul>\n      </section>`;
  }
  const ajudaOverlay = document.getElementById("ajuda-overlay");
  function abrirAjuda() {
    if (!ajudaOverlay) return;
    if (!ajudaOverlay.dataset.montado) {
      montarAjuda();
      ajudaOverlay.dataset.montado = "1";
    }
    ajudaOverlay.hidden = false;
    document.body.classList.add("ajuda-aberta");
  }
  function fecharAjuda() {
    if (!ajudaOverlay) return;
    ajudaOverlay.hidden = true;
    document.body.classList.remove("ajuda-aberta");
  }
  document.getElementById("btn-ajuda")?.addEventListener("click", abrirAjuda);
  document.getElementById("ajuda-fechar")?.addEventListener("click", fecharAjuda);
  ajudaOverlay?.addEventListener("click", (e => {
    if (e.target === ajudaOverlay) fecharAjuda();
  }));
  document.addEventListener("keydown", (e => {
    if (e.key === "Escape") fecharAjuda();
  }));
  let abaAtiva = "classificacao";
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
  function ativarAba(nome) {
    abaAtiva = nome;
    document.querySelectorAll(".tab-btn").forEach((b => b.classList.toggle("active", b.dataset.view === nome)));
    document.querySelectorAll(".view").forEach((v => v.classList.toggle("active", v.id === "view-" + nome)));
    positionFollow();
    if (nome === "detalhamento") {
      const lider = DASHBOARD_DATA.lideres.find((l => l.id === seletor.value));
      if (lider) requestAnimationFrame((() => renderGraficoEvolucao(lider)));
    }
  }
  document.getElementById("tab-bar").addEventListener("click", (e => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    ativarAba(btn.dataset.view);
  }));
  window.addEventListener("resize", positionFollow);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(positionFollow);
  }
  setTimeout(positionFollow, 400);
  function ativarModoTv() {
    document.getElementById("seletor-lider-wrap").style.visibility = "hidden";
    const btnAjuda = document.getElementById("btn-ajuda");
    if (btnAjuda) btnAjuda.style.display = "none";
    let idxLider = 0;
    setInterval((() => {
      idxLider = (idxLider + 1) % lideresOrdenados.length;
      renderDetalhe(lideresOrdenados[idxLider].id);
    }), ROTACAO_MS);
    const abas = [ "classificacao", "detalhamento" ];
    let idxAba = 0;
    setInterval((() => {
      idxAba = (idxAba + 1) % abas.length;
      ativarAba(abas[idxAba]);
    }), ROTACAO_MS * lideresOrdenados.length);
  }
  popularFiltroModo();
  popularFiltroTurno();
  popularFiltroDia();
  definirModo(modoAtivo);
  popularSeletor();
  popularSeletorDiaDetalhe();
  renderDetalhe(lideresOrdenados[0].id);
  positionFollow();
  if (MODO_TV) ativarModoTv();
})();
