/* Relógio da demonstração: os dados fictícios foram gerados para 16/10/2026
   às 14:35. Este script faz o navegador "viver" nesse momento, para que
   "hoje", "ontem" e os turnos funcionem igual ao dashboard real. */
(function () {
  var REFERENCIA = new Date(2026, 9, 16, 14, 35, 0).getTime();
  var inicio = Date.now();
  var DataReal = Date;
  function agora() { return REFERENCIA + (DataReal.now() - inicio); }
  function DataDemo(a, b, c, d, e, f, g) {
    if (!(this instanceof DataDemo)) return new DataReal(agora()).toString();
    switch (arguments.length) {
      case 0: return new DataReal(agora());
      case 1: return new DataReal(a);
      default: return new DataReal(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0, g || 0);
    }
  }
  DataDemo.prototype = DataReal.prototype;
  DataDemo.now = agora;
  DataDemo.parse = DataReal.parse;
  DataDemo.UTC = DataReal.UTC;
  window.Date = DataDemo;
})();
