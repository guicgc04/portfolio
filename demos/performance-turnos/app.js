(() => {
  "use strict";
  let DADOS = null;
  let ordem = {
    chave: "item",
    dir: "asc"
  };
  let abaAtiva = "hoje";
  let filtroDiaCarga = "hoje";
  let filtroDiaSla = "hoje";
  let filtroDiaPendencia = "todos";
  const MEDIA_LAYOUT_COMPACTO = "(max-width: 480px), (max-height: 500px) and (orientation: landscape)";
  async function carregar() {
    try {
      const resp = await fetch("dados_dashboard.json?_=" + Date.now());
      DADOS = await resp.json();
      render();
    } catch (e) {
      document.getElementById("updated-tag").textContent = "Falha ao carregar dados";
      console.error(e);
    }
  }
  function statusSla(sla) {
    if (!sla.total) return "n";
    return sla.sla_pct >= sla.meta ? "g" : "r";
  }
  function statusPct(dentro, total, meta) {
    if (!total) return "n";
    return dentro / total >= meta ? "g" : "r";
  }
  const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
  const ICON_FORA = '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const ICON_N = '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
  function iconeStatus(st) {
    return st === "g" ? ICON_OK : st === "r" ? ICON_FORA : ICON_N;
  }
  function pct(v) {
    return (v * 100).toFixed(1).replace(".", ",") + "%";
  }
  function fmtItem(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  function fmtData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  function renderTabelaCombo(tabela, slasFiltrados) {
    const linhas = [ ...slasFiltrados ].sort(((a, b) => {
      const va = a[ordem.chave];
      const vb = b[ordem.chave];
      const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return ordem.dir === "asc" ? cmp : -cmp;
    }));
    const celTurno = (s, turno, grp, comDivisor) => {
      const v = (s.turnos || {})[turno] || {
        dentro: 0,
        fora: 0
      };
      const total = v.dentro + v.fora;
      const st = statusPct(v.dentro, total, s.meta);
      const txt = total ? pct(v.dentro / total) : "–";
      const clsDentro = `num ${grp}${comDivisor ? " turno-divider" : ""}`;
      return `<td class="${clsDentro}">${v.dentro}</td><td class="num ${grp}">${v.fora}</td>\n              <td class="num ${grp}"><span class="badge badge-sm ${st}">${txt}</span></td>`;
    };
    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = linhas.map((s => {
      const st = statusSla(s);
      const badgeTxt = s.total ? st === "g" ? "Dentro" : "Fora" : "Sem dado";
      return `\n        <tr class="st-${st}">\n          <td class="num">${fmtItem(s.item)}</td>\n          <td><span class="setor-tag">${s.setor}</span></td>\n          <td><span class="indicador-nome">${s.indicador}</span></td>\n          <td class="num">${s.dentro}</td>\n          <td class="num">${s.fora}</td>\n          <td class="num">${s.total}</td>\n          <td class="num meta-txt">${pct(s.meta)}</td>\n          <td class="num"><span class="badge ${st}">${iconeStatus(st)}${badgeTxt} · ${pct(s.sla_pct)}</span></td>\n          ${celTurno(s, "Manhã", "grp-manha", true)}\n          ${celTurno(s, "Tarde", "grp-tarde", false)}\n          ${celTurno(s, "Noite", "grp-noite", false)}\n        </tr>`;
    })).join("");
    tabela.querySelectorAll("thead th[data-key]").forEach((th => {
      th.querySelector(".arrow")?.remove();
      if (th.dataset.key === ordem.chave) {
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = ordem.dir === "asc" ? "▲" : "▼";
        th.appendChild(arrow);
      }
    }));
  }
  const COLUNA_CONFIG = {
    cargas: {
      origem: {
        valor: c => c.origem || "—"
      },
      destino: {
        valor: c => c.destino || "—"
      },
      tipo: {
        valor: c => c.tipo || "—"
      },
      turno: {
        valor: c => c.turno || "—"
      },
      sla: {
        valor: c => String(c.item),
        label: (v, c) => `${fmtItem(c.item)} · ${c.indicador}`
      },
      status: {
        valor: c => c.status || "—",
        label: v => (STATUS_CARGA_INFO[v] || {}).texto || v
      }
    },
    sla: {
      setor: {
        valor: s => s.setor || "—"
      }
    },
    pendencias: {
      setor: {
        valor: p => p.setor || "—"
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
    if (tabelaId === "cargas") return (DADOS?.cargas || []).filter((c => c.dia === filtroDiaCarga));
    if (tabelaId === "sla") return DADOS?.hoje?.slas || [];
    if (tabelaId === "pendencias") return computarPendenciasPorTurno(DADOS?.cargas || [], filtroDiaPendencia);
    return [];
  }
  function tabelaIdDoElemento(th) {
    const tabela = th.closest("table");
    if (!tabela) return null;
    if (tabela.id === "tabela-cargas") return "cargas";
    if (tabela.id === "tabela-pendencias") return "pendencias";
    if (tabela.classList.contains("tabela-combo")) return "sla";
    return null;
  }
  function rerenderTabela(tabelaId) {
    if (tabelaId === "cargas") renderTabelaCargas(); else if (tabelaId === "pendencias") renderTabelaPendencias(); else render();
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
      const label = cfg.label ? cfg.label(v, row) : v;
      if (!contagem.has(v)) contagem.set(v, {
        label: label,
        count: 0
      });
      contagem.get(v).count++;
    }));
    const valores = [ ...contagem.keys() ].sort(((a, b) => contagem.get(a).label.localeCompare(contagem.get(b).label, "pt-BR")));
    const estado = filtrosColuna[tabelaId] ||= {};
    const selecionadosAtuais = estado[col];
    const menu = document.createElement("div");
    menu.className = "col-filter-menu";
    menu.innerHTML = (valores.length ? valores.map((v => {
      const marcado = !selecionadosAtuais || selecionadosAtuais.has(v);
      const info = contagem.get(v);
      return `<label><input type="checkbox" value="${v}" ${marcado ? "checked" : ""}>${info.label}<span class="cf-count">${info.count}</span></label>`;
    })).join("") : `<div style="padding:8px; color:var(--text-dim); font-size:12px;">Nenhum valor pra esse dia/filtro</div>`) + `<div class="col-filter-actions">\n         <button type="button" data-acao="todos">Marcar todos</button>\n         <button type="button" data-acao="limpar">Limpar filtro</button>\n       </div>`;
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
    th.appendChild(menu);
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
    if (!e.target.closest(".th-filtravel")) fecharMenusColuna();
  }));
  const SLA_ITENS_SEM_CARGA = [];
  function fmtDataHora(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  const STATUS_CARGA_INFO = {
    vencido: {
      texto: "Vencido",
      cls: "r"
    },
    prestes: {
      texto: "Prestes a vencer",
      cls: "y"
    },
    dentro: {
      texto: "Dentro do prazo",
      cls: "g"
    }
  };
  function renderTabelaCargas() {
    const cargas = DADOS?.cargas || [];
    const filtradas = cargas.filter((c => !c.so_fluxo && c.dia === filtroDiaCarga && passaFiltrosColuna("cargas", c, null)));
    const LIMITE = 500;
    const mostrar = filtradas.slice(0, LIMITE);
    const tbody = document.querySelector("#tabela-cargas tbody");
    tbody.innerHTML = mostrar.map((c => {
      const info = STATUS_CARGA_INFO[c.status] || STATUS_CARGA_INFO.dentro;
      return `\n        <tr class="st-${info.cls}">\n          <td>${fmtItem(c.item)} · ${c.indicador}</td>\n          <td>${c.lote || "—"}</td>\n          <td>${c.pedido || "—"}</td>\n          <td>${c.origem || "—"}</td>\n          <td>${c.destino || "—"}</td>\n          <td>${c.tipo || "—"}</td>\n          <td>${fmtDataHora(c.criacao)}</td>\n          <td>${c.concluido ? fmtDataHora(c.conclusao) : "<em>em andamento</em>"}</td>\n          <td>${fmtDataHora(c.vence_em)}</td>\n          <td>${c.turno || "—"}</td>\n          <td><span class="badge badge-sm ${info.cls}">${info.texto}</span></td>\n        </tr>`;
    })).join("");
    if (filtradas.length > LIMITE) {
      tbody.innerHTML += `<tr><td colspan="11" style="text-align:center; color:var(--text-mid); font-style:italic;">\n        mostrando ${LIMITE} de ${filtradas.length} — refine o filtro ou baixe a planilha completa\n      </td></tr>`;
    }
  }
  function ordemTurnoAtual(agora) {
    const min = agora.getHours() * 60 + agora.getMinutes();
    if (min < 6 * 60) return 0;
    if (min < 14 * 60) return 1;
    if (min < 22 * 60) return 2;
    return 3;
  }
  function nomeTurnoAtual(agora) {
    return [ "Manhã", "Tarde", "Noite", "Manhã" ][ordemTurnoAtual(agora)];
  }
  const VIRADAS_TURNO = [ [ 6, 0 ], [ 14, 0 ], [ 22, 0 ] ];
  function proximaVirada(d) {
    for (let dia = 0; dia < 2; dia++) {
      for (const [h, m] of VIRADAS_TURNO) {
        const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dia, h, m, 0, 0);
        if (t > d) return t;
      }
    }
    return null;
  }
  const pad2 = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function somarDias(ymdStr, n) {
    const [a, m, d] = ymdStr.split("-").map(Number);
    return ymd(new Date(a, m - 1, d + n));
  }
  function turnosPercorridos(ini, fim) {
    const cadeia = [ {
      turno: nomeTurnoAtual(ini),
      entra: null,
      sai: null
    } ];
    let t = ini;
    for (let guarda = 0; guarda < 30; guarda++) {
      const v = proximaVirada(t);
      if (!v || v > fim) break;
      cadeia[cadeia.length - 1].sai = v;
      cadeia.push({
        turno: nomeTurnoAtual(v),
        entra: v,
        sai: null
      });
      t = v;
    }
    return cadeia;
  }
  function diaOperacional(d) {
    const min = d.getHours() * 60 + d.getMinutes();
    return min >= 22 * 60 ? somarDias(ymd(d), 1) : ymd(d);
  }
  function diaDaVisao(filtroDia) {
    const hoje = diaOperacional(new Date);
    return filtroDia === "ontem" ? somarDias(hoje, -1) : hoje;
  }
  function computarPendenciasPorTurno(cargas, filtroDia) {
    const porItem = {};
    (DADOS?.hoje?.slas || []).forEach((s => {
      porItem[s.item] = {
        item: s.item,
        setor: s.setor,
        indicador: s.indicador,
        total_pendente: 0,
        vencidas: 0,
        em_andamento: 0,
        cruzou_turno: 0,
        rastreio: {
          Manhã: {
            mantido: 0,
            repassado: 0,
            herdado: 0,
            herdado_venc: 0,
            herdado_prazo: 0,
            realizado: 0,
            em_andamento: 0,
            vencidas: 0
          },
          Tarde: {
            mantido: 0,
            repassado: 0,
            herdado: 0,
            herdado_venc: 0,
            herdado_prazo: 0,
            realizado: 0,
            em_andamento: 0,
            vencidas: 0
          },
          Noite: {
            mantido: 0,
            repassado: 0,
            herdado: 0,
            herdado_venc: 0,
            herdado_prazo: 0,
            realizado: 0,
            em_andamento: 0,
            vencidas: 0
          }
        },
        sem_dado: SLA_ITENS_SEM_CARGA.includes(s.item)
      };
    }));
    const turnoDeAgora = nomeTurnoAtual(new Date);
    const agora = new Date;
    const diaVisao = diaDaVisao(filtroDia);
    let herdouSemPrazo = 0;
    cargas.forEach((c => {
      if (c.fluxo === false) return;
      const alvo = porItem[c.item];
      if (!alvo) return;
      let ini = c.criacao ? new Date(c.criacao) : null;
      const fim = c.concluido ? c.conclusao ? new Date(c.conclusao) : null : agora;
      if (!ini || !fim || isNaN(ini) || isNaN(fim)) return;
      if (ini > fim) ini = fim;
      if (!c.concluido && diaOperacional(ini) <= diaVisao) {
        alvo.total_pendente += 1;
        if (c.status === "vencido") {
          alvo.vencidas += 1;
          alvo.rastreio[turnoDeAgora].vencidas += 1;
        } else {
          alvo.em_andamento += 1;
          alvo.rastreio[turnoDeAgora].em_andamento += 1;
        }
      }
      if (c.concluido && diaOperacional(fim) === diaVisao) {
        alvo.rastreio[nomeTurnoAtual(fim)].realizado += 1;
      }
      const cadeia = turnosPercorridos(ini, fim);
      const vence = c.vence_em ? new Date(c.vence_em) : null;
      if (cadeia.length < 2) return;
      alvo.cruzou_turno += 1;
      cadeia.forEach((e => {
        if (e.sai && diaOperacional(new Date(e.sai.getTime() - 6e4)) === diaVisao) alvo.rastreio[e.turno].repassado += 1;
        if (e.entra && diaOperacional(e.entra) === diaVisao) {
          const rt = alvo.rastreio[e.turno];
          rt.herdado += 1;
          if (vence && vence < e.entra) rt.herdado_venc += 1; else if (vence) rt.herdado_prazo += 1; else herdouSemPrazo += 1;
        }
      }));
    }));
    if (herdouSemPrazo) console.warn(`[Pendências] ${herdouSemPrazo} herdadas sem vence_em (fora de Herdou venc./prazo)`);
    return Object.values(porItem);
  }
  function renderResumoPendencias(pendencias, visao = {}) {
    const tabela = document.getElementById("tabela-pendencias");
    const tfoot = tabela?.querySelector("tfoot");
    if (!tabela || !tfoot) return;
    const TURNOS = [ "Manhã", "Tarde", "Noite" ];
    const tot = {
      em_andamento: 0,
      vencidas: 0,
      total: 0,
      Manhã: {
        passou: 0,
        herdou: 0,
        herdou_venc: 0,
        herdou_prazo: 0,
        realizado: 0,
        em_andamento: 0,
        vencidas: 0
      },
      Tarde: {
        passou: 0,
        herdou: 0,
        herdou_venc: 0,
        herdou_prazo: 0,
        realizado: 0,
        em_andamento: 0,
        vencidas: 0
      },
      Noite: {
        passou: 0,
        herdou: 0,
        herdou_venc: 0,
        herdou_prazo: 0,
        realizado: 0,
        em_andamento: 0,
        vencidas: 0
      }
    };
    pendencias.forEach((p => {
      if (p.sem_dado) return;
      tot.em_andamento += p.em_andamento;
      tot.vencidas += p.vencidas;
      tot.total += p.total_pendente;
      TURNOS.forEach((t => {
        tot[t].passou += p.rastreio[t].repassado;
        tot[t].herdou += p.rastreio[t].herdado;
        tot[t].herdou_venc += p.rastreio[t].herdado_venc;
        tot[t].herdou_prazo += p.rastreio[t].herdado_prazo;
        tot[t].realizado += p.rastreio[t].realizado;
        tot[t].em_andamento += p.rastreio[t].em_andamento;
        tot[t].vencidas += p.rastreio[t].vencidas;
      }));
    }));
    const atual = nomeTurnoAtual(new Date);
    tabela.querySelectorAll("[data-turno-chip]").forEach((el => {
      const nome = el.dataset.turnoChip;
      el.className = "turno-chip";
      el.textContent = "";
      const futuro = nome === "Tarde" && visao.tardeFuturo || nome === "Noite" && visao.noiteFuturo;
      if (visao.ehHoje && nome === atual) {
        el.classList.add("turno-chip--agora");
        el.textContent = "agora";
      } else if (futuro) {
        el.classList.add("turno-chip--ontem");
        el.textContent = "a iniciar";
      }
    }));
    const n = v => v.toLocaleString("pt-BR");
    const celDinamica = (vTodos, vManhã, vTarde, vNoite, cls = "num") => `<td class="${cls}">\n        <span class="val-todos">${n(vTodos)}</span>\n        <span class="val-manha">${n(vManhã)}</span>\n        <span class="val-tarde">${n(vTarde)}</span>\n        <span class="val-noite">${n(vNoite)}</span>\n      </td>`;
    const celTurno = (t, grp, comDivisor) => {
      const hv = tot[t].herdou_venc, hp = tot[t].herdou_prazo, rz = tot[t].realizado, ps = tot[t].passou;
      return `<td class="num ${grp}${comDivisor ? " turno-divider" : ""} sub-herdou sub-herdou-venc${hv > 0 ? " herdou-venc-pos" : ""}">${n(hv)}</td>\n              <td class="num ${grp} sub-herdou sub-herdou-prazo${hp > 0 ? " herdou-pos" : ""}">${n(hp)}</td>\n              <td class="num ${grp} sub-realizado${rz > 0 ? " realizado-pos" : ""}">${n(rz)}</td>\n              <td class="num ${grp} sub-passou${ps > 0 ? " passou-pos" : ""}">${n(ps)}</td>`;
    };
    tfoot.innerHTML = `\n      <tr>\n        <td colspan="3" class="resumo-label">Total</td>\n        ${celDinamica(tot.em_andamento, tot.Manhã.em_andamento, tot.Tarde.em_andamento, tot.Noite.em_andamento)}\n        ${celDinamica(tot.vencidas, tot.Manhã.vencidas, tot.Tarde.vencidas, tot.Noite.vencidas)}\n        <td class="num col-total">${n(tot.total)}</td>\n        ${celTurno("Manhã", "grp-manha", true)}\n        ${celTurno("Tarde", "grp-tarde", false)}\n        ${celTurno("Noite", "grp-noite", false)}\n      </tr>`;
  }
  function renderTabelaPendencias() {
    const dadosTodos = computarPendenciasPorTurno(DADOS?.cargas || [], filtroDiaPendencia);
    const ord = ordemTurnoAtual(new Date);
    const ehHoje = filtroDiaPendencia !== "ontem";
    const tardeFuturo = ehHoje && (ord < 1 || ord === 3);
    const noiteFuturo = ehHoje && (ord < 2 || ord === 3);
    const dados = dadosTodos.filter((p => !p.sem_dado && passaFiltrosColuna("pendencias", p, null))).sort(((a, b) => a.item - b.item));
    renderResumoPendencias(dados, {
      ehHoje: ehHoje,
      tardeFuturo: tardeFuturo,
      noiteFuturo: noiteFuturo,
      dia: diaDaVisao(filtroDiaPendencia)
    });
    const tbody = document.querySelector("#tabela-pendencias tbody");
    tbody.innerHTML = dados.map((p => {
      const st = p.sem_dado ? "n" : p.total_pendente > 0 ? "r" : "g";
      const celDinamica = (vTodos, vManhã, vTarde, vNoite) => {
        if (p.sem_dado) return `<td class="num">–</td>`;
        return `<td class="num">\n            <span class="val-todos">${vTodos}</span>\n            <span class="val-manha">${vManhã}</span>\n            <span class="val-tarde">${vTarde}</span>\n            <span class="val-noite">${vNoite}</span>\n          </td>`;
      };
      const celTurnoTriplo = (r, grp, futuro, comDivisor) => {
        const cHV = `num ${grp}${comDivisor ? " turno-divider" : ""} sub-herdou sub-herdou-venc`;
        const cHP = `num ${grp} sub-herdou sub-herdou-prazo`;
        const cR = `num ${grp} sub-realizado`;
        const cP = `num ${grp} sub-passou`;
        if (p.sem_dado) {
          return `<td class="${cHV}">–</td><td class="${cHP}">–</td><td class="${cR}">–</td><td class="${cP}">–</td>`;
        }
        if (futuro && r.repassado === 0 && r.herdado === 0 && r.realizado === 0) {
          return `<td class="${cHV} cel-futuro" title="Turno ainda não aconteceu hoje">–</td>\n                    <td class="${cHP} cel-futuro">–</td>\n                    <td class="${cR} cel-futuro">–</td>\n                    <td class="${cP} cel-futuro">–</td>`;
        }
        const clsHV = r.herdado_venc > 0 ? " herdou-venc-pos" : "";
        const clsHP = r.herdado_prazo > 0 ? " herdou-pos" : "";
        const clsR = r.realizado > 0 ? " realizado-pos" : "";
        const clsP = r.repassado > 0 ? " passou-pos" : "";
        return `<td class="${cHV}${clsHV}">${r.herdado_venc}</td>\n                  <td class="${cHP}${clsHP}">${r.herdado_prazo}</td>\n                  <td class="${cR}${clsR}">${r.realizado}</td>\n                  <td class="${cP}${clsP}">${r.repassado}</td>`;
      };
      const totalGeral = p.sem_dado ? "–" : p.total_pendente;
      return `\n        <tr class="st-${st}">\n          <td class="num">${fmtItem(p.item)}</td>\n          <td><span class="setor-tag">${p.setor || "—"}</span></td>\n          <td><span class="indicador-nome">${p.indicador}</span></td>\n\n          ${celDinamica(p.em_andamento, p.rastreio.Manhã.em_andamento, p.rastreio.Tarde.em_andamento, p.rastreio.Noite.em_andamento)}\n          ${celDinamica(p.vencidas, p.rastreio.Manhã.vencidas, p.rastreio.Tarde.vencidas, p.rastreio.Noite.vencidas)}\n\n          <td class="num col-total">${totalGeral}</td>\n\n          ${celTurnoTriplo(p.rastreio.Manhã, "grp-manha", false, true)}\n          ${celTurnoTriplo(p.rastreio.Tarde, "grp-tarde", tardeFuturo, false)}\n          ${celTurnoTriplo(p.rastreio.Noite, "grp-noite", noiteFuturo, false)}\n        </tr>`;
    })).join("");
  }
  function render() {
    if (!DADOS) return;
    const slasHoje = (DADOS.hoje?.slas || []).filter((s => passaFiltrosColuna("sla", s, null)));
    const slasOntem = (DADOS.ontem?.slas || []).filter((s => passaFiltrosColuna("sla", s, null)));
    renderTabelaCombo(document.querySelector('.tabela-combo[data-fonte="hoje"]'), slasHoje);
    renderTabelaCombo(document.querySelector('.tabela-combo[data-fonte="ontem"]'), slasOntem);
    renderTabelaCargas();
    renderTabelaPendencias();
    atualizarSubtituloHeader();
    const updatedTag = document.getElementById("updated-tag");
    if (updatedTag && DADOS.atualizado_em) {
      const atualizado = new Date(DADOS.atualizado_em);
      updatedTag.textContent = "Atualizado em " + atualizado.toLocaleString("pt-BR");
    }
    const btnExport = document.getElementById("btn-export-cargas");
    if (btnExport) btnExport.href = "detalhe_cargas.xlsx?_=" + Date.now();
    ajustarAlturaLinhas();
  }
  function positionBubbleFollow(bar, follow, ativo) {
    if (!bar || !follow || !ativo) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = ativo.getBoundingClientRect();
    const centro = btnRect.left - barRect.left + btnRect.width / 2 + bar.scrollLeft;
    follow.style.left = `${centro - follow.offsetWidth / 2}px`;
  }
  function positionFollow() {
    const bar = document.getElementById("tab-bar");
    const follow = document.getElementById("tab-follow");
    positionBubbleFollow(bar, follow, bar?.querySelector(".tab-btn.active"));
  }
  function positionToggleFollow(group) {
    positionBubbleFollow(group, group.querySelector(".toggle-follow"), group.querySelector(".toggle-btn.active"));
  }
  function positionTogglesFollow() {
    document.querySelectorAll(".toggle-group").forEach(positionToggleFollow);
  }
  function atualizarSubtituloHeader() {
    const el = document.getElementById("header-subtitle");
    if (!el || !DADOS) return;
    document.getElementById("btn-export-cargas")?.classList.toggle("visible", abaAtiva === "cargas");
    document.getElementById("hdr-turno-filter")?.classList.toggle("visible", abaAtiva === "pendencias");
    const dataHoje = fmtData(DADOS.hoje?.data);
    const dataOntem = fmtData(DADOS.ontem?.data);
    let texto = "";
    if (abaAtiva === "hoje") {
      texto = filtroDiaSla === "ontem" ? `SLAs — dia anterior (${dataOntem})` : `SLAs — hoje (${dataHoje})`;
    } else if (abaAtiva === "cargas") {
      texto = filtroDiaCarga === "ontem" ? `Detalhe de lotes — ontem (${dataOntem})` : `Detalhe de lotes — hoje (${dataHoje})`;
    } else if (abaAtiva === "pendencias") {
      const d = diaDaVisao(filtroDiaPendencia);
      const dm = d.slice(8, 10) + "/" + d.slice(5, 7);
      texto = filtroDiaPendencia === "ontem" ? `Pendências por turno — turnos do dia anterior (${dm})` : `Pendências por turno — turnos de hoje (${dm})`;
    }
    el.textContent = texto;
  }
  const tabBar = document.getElementById("tab-bar");
  if (tabBar) {
    tabBar.addEventListener("click", (e => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      abaAtiva = btn.dataset.view;
      document.querySelectorAll(".tab-btn").forEach((b => b.classList.remove("active")));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((v => v.classList.remove("active")));
      const targetView = document.getElementById("view-" + abaAtiva);
      if (targetView) targetView.classList.add("active");
      positionFollow();
      positionTogglesFollow();
      ajustarAlturaLinhas();
      atualizarSubtituloHeader();
    }));
  }
  const fc = document.getElementById("filtro-dia-carga");
  if (fc) {
    fc.addEventListener("click", (e => {
      const btn = e.target.closest(".toggle-btn");
      if (!btn) return;
      document.querySelectorAll("#filtro-dia-carga .toggle-btn").forEach((b => b.classList.remove("active")));
      btn.classList.add("active");
      filtroDiaCarga = btn.dataset.dia;
      renderTabelaCargas();
      atualizarSubtituloHeader();
      positionToggleFollow(fc);
    }));
  }
  const fp = document.getElementById("filtro-dia-pendencia");
  if (fp) {
    fp.addEventListener("click", (e => {
      const btn = e.target.closest(".toggle-btn");
      if (!btn) return;
      document.querySelectorAll("#filtro-dia-pendencia .toggle-btn").forEach((b => b.classList.remove("active")));
      btn.classList.add("active");
      filtroDiaPendencia = btn.dataset.dia;
      renderTabelaPendencias();
      atualizarSubtituloHeader();
      positionToggleFollow(fp);
    }));
  }
  const fs = document.getElementById("filtro-dia-sla");
  if (fs) {
    fs.addEventListener("click", (e => {
      const btn = e.target.closest(".toggle-btn");
      if (!btn) return;
      document.querySelectorAll("#filtro-dia-sla .toggle-btn").forEach((b => b.classList.remove("active")));
      btn.classList.add("active");
      filtroDiaSla = btn.dataset.dia;
      document.querySelectorAll("#view-hoje .dia-panel").forEach((p => p.classList.remove("active")));
      const targetSla = document.getElementById(filtroDiaSla === "ontem" ? "dia-sla-ontem" : "dia-sla-hoje");
      if (targetSla) targetSla.classList.add("active");
      ajustarAlturaLinhas();
      atualizarSubtituloHeader();
      positionToggleFollow(fs);
    }));
  }
  document.querySelectorAll(".tabela-combo").forEach((tabela => {
    tabela.addEventListener("click", (e => {
      const th = e.target.closest("th[data-key]");
      if (!th) return;
      const chave = th.dataset.key;
      ordem = chave === ordem.chave ? {
        chave: chave,
        dir: ordem.dir === "asc" ? "desc" : "asc"
      } : {
        chave: chave,
        dir: "asc"
      };
      render();
    }));
  }));
  function ajustarAlturaLinhas() {
    if (window.matchMedia(MEDIA_LAYOUT_COMPACTO).matches) return;
    const medirEAplicar = wrap => {
      if (!wrap) return;
      const tabela = wrap.querySelector("table");
      const thead = tabela?.querySelector("thead");
      const tbody = tabela?.querySelector("tbody");
      if (!thead || !tbody || !tbody.rows.length) return;
      const tfootH = tabela.querySelector("tfoot")?.offsetHeight || 0;
      const disponivel = wrap.clientHeight - tfootH - thead.offsetHeight;
      if (disponivel > 0) {
        tabela.style.setProperty("--linha-altura", `${(disponivel / tbody.rows.length).toFixed(1)}px`);
      }
    };
    const viewHoje = document.getElementById("view-hoje");
    if (viewHoje?.classList.contains("active")) {
      medirEAplicar(viewHoje.querySelector(".dia-panel.active .table-wrap-scroll"));
    }
    const viewPend = document.getElementById("view-pendencias");
    if (viewPend?.classList.contains("active")) {
      medirEAplicar(viewPend.querySelector(".table-wrap-scroll"));
    }
  }
  window.addEventListener("resize", positionFollow);
  window.addEventListener("resize", positionTogglesFollow);
  window.addEventListener("resize", ajustarAlturaLinhas);
  carregar();
  setInterval(carregar, 5 * 60 * 1e3);
  positionFollow();
  positionTogglesFollow();
  if (document.fonts?.ready) {
    document.fonts.ready.then((() => {
      positionFollow();
      positionTogglesFollow();
      ajustarAlturaLinhas();
    }));
  } else {
    setTimeout((() => {
      positionFollow();
      positionTogglesFollow();
      ajustarAlturaLinhas();
    }), 400);
  }
})();

(() => {
  const wrap = document.getElementById("hdr-turno-filter");
  const toggle = document.getElementById("btn-turno-toggle");
  const menu = document.getElementById("turno-menu");
  const label = document.getElementById("btn-turno-label");
  const tabela = document.getElementById("tabela-pendencias");
  if (!wrap || !toggle || !menu || !tabela) return;
  const NOMES = {
    todos: "Geral",
    manha: "Manhã",
    tarde: "Tarde",
    noite: "Noite"
  };
  function aplicarTurno(turno) {
    const FILTROS = [ "mostrar-so-manha", "mostrar-so-tarde", "mostrar-so-noite" ];
    tabela.classList.remove(...FILTROS);
    if (turno !== "todos") tabela.classList.add(`mostrar-so-${turno}`);
    label.textContent = NOMES[turno] || "Geral";
    menu.querySelectorAll(".turno-menu-item").forEach((b => b.classList.toggle("active", b.dataset.turno === turno)));
  }
  toggle.addEventListener("click", (e => {
    e.stopPropagation();
    wrap.classList.toggle("open");
  }));
  menu.addEventListener("click", (e => {
    const item = e.target.closest(".turno-menu-item");
    if (!item) return;
    aplicarTurno(item.dataset.turno);
    wrap.classList.remove("open");
  }));
  document.addEventListener("click", (e => {
    if (!wrap.contains(e.target)) wrap.classList.remove("open");
  }));
})();
