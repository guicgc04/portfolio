"""Gera de novo os dados fictícios de todos os dashboards de demonstração.

Uso: python gerar_tudo.py
"""
import gerar_frotas
import gerar_gestao_operacional
import gerar_hora_a_hora
import gerar_ocupacao
import gerar_performance_turnos
import gerar_produtividade_linhas
import gerar_sla_consolidado
import gerar_tonelagem

if __name__ == "__main__":
    for modulo in (gerar_performance_turnos, gerar_hora_a_hora, gerar_sla_consolidado,
                   gerar_produtividade_linhas, gerar_ocupacao, gerar_tonelagem, gerar_frotas,
                   gerar_gestao_operacional):
        print(modulo.__doc__.strip().splitlines()[0])
        modulo.main()
