// Conteúdo dos estudos de caso (sem dados reais da operação)
const CASOS = {
  rpa: {
    tag: "RPA",
    titulo: "Robô de documentação",
    problema: "Um processo administrativo de alto volume exigia coletar documentos de cada colaborador, conferir um por um, preencher formulários e enviar tudo para portais externos, colaborador por colaborador.",
    solucao: "Um robô em Python que roda sozinho todos os dias: coleta os arquivos, valida o que falta, gera os formulários, envia para assinatura e preenche os portais. Cada etapa grava um status, então o processo retoma de onde parou.",
    resultado: "O tempo por pessoa caiu de dezenas de minutos para poucos minutos, e a equipe passou a acompanhar só as pendências.",
    etapas: ["Coleta de documentos", "Validação e leitura por OCR", "Geração de formulários", "Assinatura digital", "Envio ao portal"],
    stack: "Python, Selenium, OCR, openpyxl, Agendador de Tarefas"
  },
  etl: {
    tag: "ETL e dashboards",
    titulo: "Dashboards em Python",
    problema: "Os indicadores da operação dependiam de relatórios montados à mão e de painéis que não mostravam o turno em andamento.",
    solucao: "ETLs em Python leem os relatórios dos sistemas, aplicam as regras de cada indicador e geram os dados que alimentam painéis web feitos em código. Os painéis rodam nas TVs da operação e no celular.",
    resultado: "Supervisores acompanham SLAs, produtividade, ocupação e custos turno a turno, sem esperar o fechamento do dia.",
    etapas: ["Leitura dos relatórios", "Regras de cada indicador", "Geração dos dados", "Painel atualiza sozinho"],
    stack: "Python, Pandas, JavaScript, HTML, CSS"
  },
  bot: {
    tag: "Automação",
    titulo: "Extração de relatórios",
    problema: "Vários relatórios precisavam ser baixados todos os dias do sistema de gestão de carga para alimentar as análises.",
    solucao: "Um robô que entra no sistema, baixa cada relatório com o filtro de datas certo, confere se o arquivo veio íntegro e salva em pastas sincronizadas que os ETLs já leem.",
    resultado: "Os dados chegam sozinhos várias vezes ao dia, e os dashboards não dependem de alguém lembrar de baixar um arquivo.",
    etapas: ["Login no sistema", "Download de cada relatório", "Validação do arquivo", "Pasta sincronizada"],
    stack: "Python, Selenium, Watchdog"
  },
  web: {
    tag: "Web",
    titulo: "Portal de indicadores",
    problema: "Com vários dashboards prontos, cada área precisava de um lugar único e seguro para acessar os seus.",
    solucao: "Um portal web com login, permissões por usuário e área administrativa. Os ETLs publicam os dados no portal automaticamente após cada atualização.",
    resultado: "Cada pessoa vê só o que é da sua área, e os indicadores ficam disponíveis em qualquer dispositivo.",
    etapas: ["ETL gera os dados", "Publicação automática", "Login e permissões", "Dashboard por área"],
    stack: "PHP, SQLite, Python"
  },
  flx: {
    tag: "Power Platform",
    titulo: "Fluxos de controle",
    problema: "Controles do dia a dia, como estoque de materiais e paletes, viviam em planilhas atualizadas à mão e em mensagens soltas.",
    solucao: "Formulários ligados a fluxos no Power Automate que atualizam o estoque na hora, registram o histórico e avisam os responsáveis por e-mail.",
    resultado: "Saldo sempre atualizado, histórico rastreável e menos cobrança manual entre as áreas.",
    etapas: ["Formulário", "Regra no fluxo", "Atualiza a planilha", "Notifica por e-mail"],
    stack: "Power Automate, Microsoft Forms, Excel Online"
  }
};

const dialogo = document.getElementById("case");
const $ = (id) => document.getElementById(id);

document.querySelectorAll(".card[data-case]").forEach((card) => {
  card.addEventListener("click", () => {
    const c = CASOS[card.dataset.case];
    $("case-tag").textContent = c.tag;
    $("case-title").textContent = c.titulo;
    $("case-problem").textContent = c.problema;
    $("case-solution").textContent = c.solucao;
    $("case-result").textContent = c.resultado;
    $("case-stack").textContent = c.stack;
    const lista = $("case-steps");
    lista.innerHTML = "";
    c.etapas.forEach((e) => {
      const li = document.createElement("li");
      li.textContent = e;
      lista.appendChild(li);
    });
    dialogo.showModal();
  });
});

dialogo.querySelector(".case__close").addEventListener("click", () => dialogo.close());
// Fecha ao clicar fora do conteúdo
dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });

// Filtros do portfólio
const filtros = document.querySelectorAll(".filtros button");
filtros.forEach((b) => {
  b.addEventListener("click", () => {
    filtros.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.querySelectorAll(".cards .card").forEach((card) => {
      card.hidden = b.dataset.filtro !== "todos" && card.dataset.cat !== b.dataset.filtro;
      card.classList.add("visivel");
    });
  });
});
