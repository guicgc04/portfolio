"""Produtividade por linha: quantos lotes cada linha conferiu, por hora, quanto ficou
dentro do prazo e o desempenho de cada viagem e palete (operação fictítransp)."""
import datetime as dt

from comum import HOJE, AGORA, rng, salvar_js, turno_da_hora

LINHAS = ["A", "B", "C", "D", "E", "F"]
TRANSPORTADORAS = ["Transportadora Norte", "Transportadora Sul", "Rota Leste", "Via Oeste", "Expresso Centro", "Logística Delta"]
TIPOS_PLT = ["PLT", "CXA", "GAI", "BAG"]


def turno(h):
    return turno_da_hora(h)


def fmt(d):
    return d.strftime("%d/%m %H:%M")


def gerar_dia(r, data, ultima_hora, viagens_info, prox_doc):
    rec, ent, plts, plt_h, soltas, viagens = [], [], [], [], [], []
    # Viagens que chegaram no dia: cada uma distribui paletes pelas linhas
    for _ in range(r.randint(14, 20)):
        h_chegada = r.randint(0, ultima_hora)
        doc = f"DOC-{prox_doc[0]:05d}"
        prox_doc[0] += 1
        chegada = dt.datetime.combine(data, dt.time(h_chegada, r.randint(0, 59)))
        fech = chegada + dt.timedelta(minutes=r.randint(90, 320))
        viagens_info[doc] = {"viagem": f"VG-{r.randint(1000, 9899)}", "transp": r.choice(TRANSPORTADORAS),
                            "data_viagem": data.strftime("%d/%m/%Y"), "chegada": fmt(chegada),
                            "chegada_ts": chegada.strftime("%Y-%m-%dT%H:%M"), "fech": fmt(fech),
                            "chegada_lib_min": int((fech - chegada).total_seconds() // 60)}
        for _u in range(r.randint(2, 7)):
            l = r.choice(LINHAS)
            i = len(plts)
            am, bt = r.randint(0, 12), r.randint(0, 8)
            if am + bt == 0:
                am = 3
            pz = chegada + dt.timedelta(minutes=r.randint(10, 60))
            desp = r.uniform(12, 75)
            ini = pz + dt.timedelta(minutes=r.randint(5, 40))
            plts.append({"i": i, "l": l, "doc": doc, "plt": f"{r.choice(TIPOS_PLT)}-{r.randint(10000, 99999)}",
                         "tipo_plt": r.choice(TIPOS_PLT), "cls": "Mista" if am and bt else ("Fechada" if am else "Fracionada"),
                         "am": am, "bt": bt, "desp": round(desp, 1), "pz": fmt(pz), "desp_ini": fmt(ini),
                         "desp_fim": fmt(ini + dt.timedelta(minutes=desp)), "ord": pz.strftime("%Y%m%d%H%M")})
            h = min(ultima_hora, ini.hour if ini.date() == data else ultima_hora)
            for tipo, n in (("Fechada", am), ("Fracionada", bt)):
                if n:
                    fora = sum(1 for _ in range(n) if r.random() < .07)
                    plt_h.append({"i": i, "l": l, "h": h, "t": turno(h), "k": tipo, "lote": n,
                                  "vol": n * r.randint(3, 12), "den": n - fora, "fora": fora})
    # Agregados por linha e hora (conferência, entrada na chegada, lotes avulsos)
    for h in range(ultima_hora + 1):
        for l in LINHAS:
            for tipo, peso in (("Fechada", .6), ("Fracionada", .4)):
                n = int(r.uniform(4, 20) * peso * (1.3 if 7 <= h <= 18 else .7))
                if not n:
                    continue
                fora = sum(1 for _ in range(n) if r.random() < .06)
                rec.append({"l": l, "h": h, "t": turno(h), "k": tipo, "rec": n, "den": n - fora, "fora": fora,
                            "vol": n * r.randint(3, 10), "peso": round(n * r.uniform(80, 420), 1)})
                ent.append({"l": l, "h": h, "t": turno(h), "k": tipo, "ent": int(n * r.uniform(.85, 1.2))})
                doc = r.choice(list(viagens_info))
                viagens.append({"doc": doc, "l": l, "h": h, "t": turno(h), "k": tipo,
                             "lote": n, "den": n - fora, "fora": fora})
                if r.random() < .25:
                    s = r.randint(1, 4)
                    soltas.append({"l": l, "doc": doc, "h": h, "t": turno(h), "k": tipo,
                                   "lote": s, "vol": s * 2, "den": s, "fora": 0})
    return {"rec": rec, "ent": ent, "plts": plts, "plt_h": plt_h, "soltas": soltas, "viagens": viagens}


def main():
    r = rng(1010)
    viagens_info, prox = {}, [1]
    dias = {}
    for i in range(7):
        d = HOJE - dt.timedelta(days=i)
        dados = gerar_dia(r, d, AGORA.hour if i == 0 else 23, viagens_info, prox)
        dias[d.isoformat()] = {"data": d.strftime("%d/%m/%Y"), "offset": i, **dados}
    salvar_js("produtividade-linhas", "DADOS_LINHAS", {
        "atualizado_em": AGORA.strftime("%d/%m/%Y %H:%M"), "meta_pct": 92.0, "limite_h": 4.0,
        "linhas": LINHAS, "dias": dias, "viagens_info": viagens_info,
    })


if __name__ == "__main__":
    main()
