// Mostra o dashboard no tamanho para o qual ele foi desenhado (1440 × 900)
// e reduz proporcionalmente para caber na página. No celular, usa o layout
// responsivo do próprio dashboard, sem reduzir.
(function () {
  var LARG = 1440, ALT = 900;
  var caixa = document.querySelector(".browser__view");
  var frame = document.querySelector(".browser__frame");
  if (!caixa || !frame) return;
  var celular = window.matchMedia("(max-width: 640px)");

  function ajustar() {
    if (celular.matches) {
      frame.style.width = frame.style.height = frame.style.transform = caixa.style.height = "";
      return;
    }
    var escala = caixa.clientWidth / LARG;
    frame.style.width = LARG + "px";
    frame.style.height = ALT + "px";
    frame.style.transform = "scale(" + escala + ")";
    caixa.style.height = ALT * escala + "px";
  }
  window.addEventListener("resize", ajustar);
  ajustar();
})();
