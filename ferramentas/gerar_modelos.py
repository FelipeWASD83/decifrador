"""Gera js/dados/modelos.js: as tabelas de língua que o decifrador usa para
saber se um texto "faz sentido" (quadrigramas, palavras mais comuns e
frequência de letras, em português e inglês).

Só estatística vai para o arquivo gerado, nunca o texto de origem.

Corpus (tudo local, nada é baixado):
  pt  roteiro e documentos de design do projeto date-sim (prosa em português)
  en  os tópicos da referência da linguagem do Python (pydoc_data.topics)
      + as frases-semente abaixo

Uso:  python ferramentas/gerar_modelos.py
"""
import json
import math
import random
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sementes  # noqa: E402
PASTA_PROJETOS = RAIZ.parent
SAIDA = RAIZ / "js" / "dados" / "modelos.js"

QUADS_GUARDADOS = 45000
PALAVRAS_GUARDADAS = 5000
LO = -16.0
PASSO = 0.17
ALFABETO_Q = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

# Palavras do dia a dia que um corpus técnico pode não ter. Entram na lista
# de palavras mesmo assim (com o peso de quem aparece 40 vezes).
SEMENTES_PT = """
o a os as um uma uns umas de do da dos das em no na nos nas por para com sem sobre entre ate
e ou mas que se porque como quando onde quem qual quanto muito muita muitos pouco tudo nada
eu tu ele ela nos vos eles elas voce voces meu minha meus minhas seu sua seus suas nosso nossa
este esta isto esse essa isso aquele aquela aquilo aqui ali la ai agora hoje ontem amanha sempre nunca
ser estar ter haver ir vir fazer dizer poder querer saber ver dar ficar deixar passar chegar levar
sou es somos sao era foi sera estou esta estao tenho tem temos tinha fui vou vai vamos faz fez disse
bom boa bem mal grande pequeno novo velho primeiro ultimo outro mesmo todo toda todos todas cada
casa dia noite tempo ano vida mundo homem mulher pessoa gente coisa lugar parte vez forma
olá ola oi tchau obrigado obrigada por favor desculpa sim nao talvez claro certo errado
amigo amiga amor nome palavra mensagem segredo codigo senha chave texto carta resposta pergunta
ataque ataquem amanhecer amanhecer encontro encontrar tesouro mapa ilha praia mar rio terra ceu sol lua estrela
manha tarde noite hora minuto segundo semana mes trabalho escola cidade pais rua porta janela
agua fogo vento comida cafe pao leite fome sede frio calor chuva
um dois tres quatro cinco seis sete oito nove dez cem mil
vou ficar esperar procurar encontrei achei descobri decifrar decifrei cifra criptografia
parabens muito bem voce conseguiu mensagem secreta escondida debaixo atras antes depois durante
""".split()

SEMENTES_EN = """
the a an and or but if then so because as of to in on at by for with without about between into through
i you he she it we they me him her us them my your his its our their this that these those here there
am is are was were be been being have has had do does did will would can could shall should may might must
say said go went come came see saw know knew get got make made take took give gave find found think thought
good bad new old big small great little first last long other same every all some any each
hello hi hey goodbye thanks thank please sorry yes no maybe sure right wrong
friend love name word message secret code key password text letter answer question hidden
attack dawn night day morning evening time year life world man woman people thing place
meet meeting treasure map island beach sea river land sky sun moon star
water fire wind food bread milk cold hot rain home house door window city street
one two three four five six seven eight nine ten hundred thousand
quick brown fox jumps over lazy dog congratulations solved cipher decode decrypt encrypt
""".split()

CURTAS_PT = "de da do em um no na se eu me te ao os as ou ja ai so tu ta ha ir vi".split()
CURTAS_EN = "of to in is it on at as be by he we or an if my me no so up do go us am i".split()


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


def so_letras(s: str) -> str:
    return re.sub(r"[^A-Z]", "", normalizar(s).upper())


def palavras_de(s: str):
    s = normalizar(s).lower()
    return [p.upper() for p in re.findall(r"[a-z]+", s)]


PROJETOS_PT = ("date-sim", "felipe-sites", "brave-nova-aba", "worldbox-2", "NOVELO",
               "bitlife2", "compasso", "arvore-biblica", "tanque-de-agua", "campo-aberto")
FORA = {"node_modules", "vendor", ".venv", "Library", ".git", "_originais", "dist", "clientes"}


def corpus_pt() -> str:
    partes = []
    for proj in PROJETOS_PT:
        for arq in sorted((PASTA_PROJETOS / proj).rglob("*.md")):
            if FORA & set(arq.parts):
                continue
            partes.append(arq.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(partes)


def corpus_en() -> str:
    import ast
    import pydoc_data.topics as t
    partes = list(t.topics.values())
    lib = Path(sys.base_prefix) / "Lib"
    for arq in sorted(lib.glob("*.py")) + sorted(lib.glob("*/*.py")):
        if "test" in arq.parts or "idlelib" in arq.parts:
            continue
        try:
            arvore = ast.parse(arq.read_text(encoding="utf-8", errors="ignore"))
        except (SyntaxError, ValueError, OSError):
            continue
        for no in ast.walk(arvore):
            if isinstance(no, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                d = ast.get_docstring(no)
                if d:
                    partes.append("\n".join(l for l in d.splitlines() if ">>>" not in l))
    return "\n".join(partes)


def montar(nome: str, texto: str, sementes: list[str], curtas: list[str]):
    # só prosa: tira blocos de código e marcação para o corpus não ensinar "def" e "http"
    texto = re.sub(r"```.*?```", " ", texto, flags=re.S)
    texto = re.sub(r"`[^`]*`", " ", texto)
    texto = re.sub(r"https?://\S+", " ", texto)

    letras = so_letras(texto)
    total_letras = len(letras)

    # frequência de letras
    uni = Counter(letras)
    unigramas = [uni[chr(65 + i)] / total_letras for i in range(26)]

    # quadrigramas (janela corrida sobre as palavras, para não cruzar pontuação à toa)
    quads = Counter()
    corrido = []
    for bloco in re.split(r"[^A-Za-zÀ-ÿ\s]+", normalizar(texto)):
        l = so_letras(bloco)
        if len(l) >= 4:
            corrido.append(l)
    for l in corrido:
        for i in range(len(l) - 3):
            quads[l[i:i + 4]] += 1
    total_q = sum(quads.values())
    piso = LO
    tris, bis = Counter(), Counter()
    for l in corrido:
        for i in range(len(l) - 2):
            tris[l[i:i + 3]] += 1
        for i in range(len(l) - 1):
            bis[l[i:i + 2]] += 1

    def tabela_de(cont, tamanho):
        tot = sum(cont.values())
        out = []
        for i in range(26 ** tamanho):
            k, x = "", i
            for _ in range(tamanho):
                k = chr(65 + x % 26) + k
                x //= 26
            c = cont.get(k, 0)
            if c == 0:
                out.append(ALFABETO_Q[0])
            else:
                out.append(ALFABETO_Q[max(0, min(63, round((math.log(c / tot) - piso) / PASSO)))])
        return "".join(out)

    tri_tab = tabela_de(tris, 3)
    bi_tab = tabela_de(bis, 2)
    mais = quads.most_common(QUADS_GUARDADOS)
    chaves, vals = [], []
    for q, c in mais:
        lp = math.log(c / total_q)
        idx = round((lp - piso) / PASSO)
        idx = max(0, min(63, idx))
        chaves.append(q)
        vals.append(ALFABETO_Q[idx])

    # palavras
    cont = Counter(p for p in palavras_de(texto) if len(p) >= 2)
    for s in sementes:
        for p in palavras_de(s):
            cont[p] += 40
    ordem = [p for p, c in cont.most_common() if (c >= 3 and len(p) >= 3) or p in {x.upper() for x in curtas}]
    lista = []
    for p in ordem:
        if len(p) > 18:
            continue
        lista.append(p.lower())
        if len(lista) >= PALAVRAS_GUARDADAS:
            break
    # as sementes sempre entram
    ja = set(lista)
    for s in sementes:
        for p in palavras_de(s):
            if len(p) >= 2 and p.lower() not in ja and (len(p) >= 3 or p in {x.upper() for x in curtas}):
                lista.append(p.lower())
                ja.add(p.lower())

    # calibração: nota média de trechos reais e de trechos embaralhados
    tabela = {q: PASSO * 0 + (piso + PASSO * ALFABETO_Q.index(v)) for q, v in zip(chaves, vals)}

    def media(s: str) -> float:
        n = len(s) - 3
        return sum(tabela.get(s[i:i + 4], piso) for i in range(n)) / n

    rnd = random.Random(7)
    reais, falsos = [], []
    base = "".join(corrido)
    for _ in range(400):
        ini = rnd.randrange(0, len(base) - 80)
        trecho = base[ini:ini + 80]
        reais.append(media(trecho))
        emb = list(trecho)
        rnd.shuffle(emb)
        falsos.append(media("".join(emb)))
    media_lingua = sum(reais) / len(reais)
    media_aleat = sum(falsos) / len(falsos)

    print(f"{nome}: {total_letras} letras, {len(quads)} quads ({len(chaves)} guardados), "
          f"{len(lista)} palavras, média real {media_lingua:.2f}, embaralhado {media_aleat:.2f}")

    return {
        "quadChaves": "".join(chaves),
        "quadVals": "".join(vals),
        "palavras": " ".join(lista),
        "triVals": tri_tab,
        "biVals": bi_tab,
        "unigramas": [round(u, 5) for u in unigramas],
        "mediaLingua": round(media_lingua, 3),
        "mediaAleat": round(media_aleat, 3),
    }


def main():
    def reforco(palavras, frases):
        texto = " ".join(palavras) + "\n" + "\n".join(frases)
        return "\n".join([texto] * 12)

    modelos = {
        "pt": montar("pt", corpus_pt() + "\n" + reforco(sementes.PT_PALAVRAS, sementes.PT_FRASES),
                     SEMENTES_PT + sementes.PT_PALAVRAS, CURTAS_PT),
        "en": montar("en", corpus_en() + "\n" + reforco(sementes.EN_PALAVRAS, sementes.EN_FRASES),
                     SEMENTES_EN + sementes.EN_PALAVRAS, CURTAS_EN),
    }
    meta = {"lo": LO, "passo": PASSO, "alfabeto": ALFABETO_Q}
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    conteudo = (
        "// GERADO por ferramentas/gerar_modelos.py. Não editar à mão.\n"
        "// Só estatística de língua (quadrigramas, palavras comuns, frequência de letras).\n"
        f"export const META = {json.dumps(meta)};\n"
        f"export const MODELOS = {json.dumps(modelos, ensure_ascii=False)};\n"
    )
    SAIDA.write_text(conteudo, encoding="utf-8")
    print("escrito", SAIDA, SAIDA.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    sys.exit(main())
