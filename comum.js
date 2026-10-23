// Comportamentos compartilhados: menu ativo e animação de entrada.
(function () {
  // Marca no menu a seção que está na tela (só na home)
  var links = document.querySelectorAll("[data-secao]");
  var secoes = Array.prototype.map.call(
    document.querySelectorAll(".lado__nav [data-secao]"),
    function (a) { return document.getElementById(a.dataset.secao); }
  ).filter(Boolean);
  if (secoes.length && "IntersectionObserver" in window && !document.body.classList.contains("pagina-projeto")) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("ativo", a.dataset.secao === e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secoes.forEach(function (s) { obs.observe(s); });
  }

  // Elementos surgem ao entrar na tela
  var surgem = document.querySelectorAll(".surge");
  if ("IntersectionObserver" in window) {
    var obs2 = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visivel"); obs2.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    surgem.forEach(function (el) { obs2.observe(el); });
  } else {
    surgem.forEach(function (el) { el.classList.add("visivel"); });
  }
})();
