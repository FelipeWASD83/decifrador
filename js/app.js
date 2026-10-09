// A tela: cola o texto, manda para o worker e desenha a fita e a resposta.
// Nada é guardado (nem localStorage): o que você cola some ao fechar a aba.

import { EXEMPLOS } from './exemplos.js';

const $ = (id) => document.getElementById(id);

function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'texto') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null) el.append(f);
  return el;
}

/** append que ignora null (o DOM escreveria a palavra "null"). */
function anexar(pai, ...itens) {
  for (const i of itens.flat()) if (i != null) pai.append(i);
}

const NOME_LINGUA = { pt: 'português', en: 'inglês' };
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  form: $('formulario'),
  entrada: $('entrada'),
  chave: $('chave'),
  botao: $('botao'),
  parar: $('parar'),
  limpar: $('limpar'),
  fita: $('fita'),
  fitaVazia: $('fita-vazia'),
  fitaResumo: $('fita-resumo'),
  resposta: $('resposta'),
  mesa: $('mesa'),
  hudMetodos: $('hud-metodos'),
  hudEstado: $('hud-estado'),
  exemplos: $('exemplos'),
  catalogo: $('catalogo'),
};

let worker = null;
let idAtual = 0;
let rodando = false;
let linhas = [];
let ultimaCamada = 0;
let tentativas = 0;
let cabecaCamada = null;
let ocultasNaCamada = 0;

// ---------- exemplos ----------
for (const ex of EXEMPLOS) {
  el.exemplos.append(h('button', {
    type: 'button',
    class: 'chip',
    texto: ex.rotulo,
    onclick: () => {
      el.entrada.value = ex.texto;
      el.chave.value = '';
      el.entrada.focus();
      executar();
    },
  }));
}

// ---------- worker ----------
function criarWorker() {
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (e) {
    el.hudEstado.textContent = 'seu navegador não abriu o worker';
    return;
  }
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.tipo === 'catalogo') montarCatalogo(m.itens);
    if (m.id !== idAtual) return;
    if (m.tipo === 'tentativa') adicionarLinha(m.ev);
    if (m.tipo === 'fim') terminar(m.resultado);
  };
  worker.onerror = () => {
    rodando = false;
    el.botao.disabled = false;
    el.parar.hidden = true;
    el.hudEstado.textContent = 'erro no motor';
  };
}

// ---------- fita ----------
function barra(nota) {
  const cheias = Math.round(Math.min(1, nota) * 10);
  return h('span', { class: 'barra', 'aria-hidden': 'true' }, Array.from({ length: 10 }, (_, i) => h('i', { class: i < cheias ? 'on' : '' })));
}

function adicionarLinha(ev) {
  tentativas++;
  if (el.fitaVazia) el.fitaVazia.remove();
  el.fitaVazia = null;
  if (ev.camada !== ultimaCamada) {
    ultimaCamada = ev.camada;
    cabecaCamada = h('div', { class: 'camada', texto: `camada ${ev.camada}` });
    ocultasNaCamada = 0;
    el.fita.append(cabecaCamada);
  }
  const li = h('div', { class: 'linha', role: 'listitem' },
    h('span', { class: 'n', texto: String(linhas.length + 1).padStart(2, '0') }),
    h('span', { class: 'nome', texto: ev.nome, title: ev.detalhe || ev.nome }),
    barra(ev.nota),
    h('span', { class: 'valor', texto: ev.nota.toFixed(2) }),
    h('span', { class: 'previa', texto: ev.previa }));
  const semSinal = ev.nota < 0.08 && !(ev.camada === 1 && ev.estrito);
  if (semSinal) {
    li.classList.add('mudo');
    ocultasNaCamada++;
    cabecaCamada.dataset.ocultas = ocultasNaCamada;
    cabecaCamada.textContent = `camada ${ev.camada} · ${ocultasNaCamada} sem sinal, escondidas`;
  }
  li.style.setProperty('--i', Math.min(linhas.length, 40));
  li.dataset.camada = ev.camada;
  li.dataset.id = ev.id;
  li.dataset.detalhe = ev.detalhe ?? '';
  el.fita.append(li);
  linhas.push(li);
  el.fita.scrollTop = el.fita.scrollHeight;
  el.fitaResumo.textContent = `${linhas.length} linhas`;
  el.hudEstado.textContent = `testando… ${tentativas}`;
}

function marcarCaminho(melhor) {
  if (!melhor) return;
  melhor.caminho.forEach((passo, i) => {
    const alvo = linhas.find((l) => Number(l.dataset.camada) === i + 1 && l.dataset.id === passo.id && l.dataset.detalhe === (passo.detalhe ?? ''));
    if (!alvo) return;
    alvo.classList.add('no-caminho');
    alvo.classList.remove('mudo');
    if (i === melhor.caminho.length - 1) {
      alvo.classList.add('venceu');
      alvo.scrollIntoView({ block: 'nearest' });
    }
  });
}

// ---------- resposta ----------
function confianca(nota) {
  if (nota >= 0.8) return ['alta', 'alta'];
  if (nota >= 0.6) return ['média', 'media'];
  return ['baixa', 'baixa'];
}

function chipsCaminho(caminho) {
  const nos = [];
  caminho.forEach((p, i) => {
    if (i) nos.push(h('span', { class: 'seta', 'aria-hidden': 'true', texto: '→' }));
    nos.push(h('span', { class: 'passo' }, p.nome, p.detalhe ? h('small', { texto: ` · ${p.detalhe}` }) : null));
  });
  return h('div', { class: 'caminho' }, nos);
}

function avisos(lista) {
  return lista.map((a) => h('div', { class: 'aviso', role: 'note' }, h('strong', { texto: a.titulo }), h('p', { texto: a.texto })));
}

async function copiar(texto, botao) {
  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = 'copiado';
  } catch {
    botao.textContent = 'não deu para copiar';
  }
  setTimeout(() => { botao.textContent = 'copiar'; }, 1600);
}

function corpoDoResultado(c, r) {
  const [rotuloConf, classeConf] = confianca(c.nota);
  const curto = c.letras < 25 && c.caminho.some((p) => p.grupo === 'cifra');
  const botaoCopiar = h('button', { type: 'button', class: 'botao-secundario', texto: 'copiar' });
  botaoCopiar.addEventListener('click', () => copiar(c.estado.texto, botaoCopiar));
  return [
    h('div', { class: 'texto-claro', texto: c.estado.texto }),
    c.espacado ? h('p', { class: 'espacado' }, 'Com espaços: ', h('b', { texto: c.espacado })) : null,
    chipsCaminho(c.caminho),
    h('div', { class: 'meta' },
      h('span', { texto: `idioma: ${NOME_LINGUA[c.lingua] ?? c.lingua}` }),
      h('span', { class: classeConf, texto: `confiança ${rotuloConf} (${Math.round(c.nota * 100)}%)` }),
      h('span', { texto: `${c.caminho.length} ${c.caminho.length === 1 ? 'camada' : 'camadas'}` }),
      h('span', { texto: `${r.ms} ms` })),
    curto ? h('p', { class: 'nota aviso-curto', texto: 'Texto curto: cifra clássica com poucas letras pode ter outra leitura. Veja as outras hipóteses.' }) : null,
    h('div', { class: 'acoes' },
      botaoCopiar,
      h('button', {
        type: 'button',
        class: 'botao-secundario',
        texto: 'decifrar este de novo',
        onclick: () => { el.entrada.value = c.estado.texto; executar(); },
      })),
  ];
}

function outrasHipoteses(r) {
  if (!r.alternativas.length) return null;
  return h('details', { class: 'outras' },
    h('summary', { texto: `outras hipóteses (${r.alternativas.length})` }),
    h('ul', {}, r.alternativas.map((c) => h('li', {},
      h('button', {
        type: 'button',
        onclick: () => {
          const nova = { ...r, melhor: c, alternativas: [r.melhor, ...r.alternativas.filter((x) => x !== c)] };
          desenharResposta(nova);
          marcarCaminho(c);
        },
      },
      h('span', { class: 'via', texto: `${c.caminho.map((p) => p.nome).join(' → ')} · ${Math.round(c.nota * 100)}%` }),
      h('span', { class: 'amostra', texto: c.estado.texto }))))));
}

function desenharResposta(r) {
  const caixa = el.resposta;
  caixa.replaceChildren();
  caixa.classList.remove('falhou');
  const m = r.melhor;

  if (r.jaLegivel) {
    anexar(caixa, h('h3', { class: 'titulo' }, h('span', { class: 'forte', texto: 'Isso já é texto legível.' }), h('span', { class: 'fraco', texto: ' Não tem o que decifrar. Se ainda assim parte dele parecer estranha, cole só essa parte.' })));
    return;
  }

  anexar(caixa, ...avisos(r.avisos));

  if (m && m.nota >= 0.5) {
    anexar(caixa, 
      h('h3', { class: 'titulo' }, h('span', { class: 'forte', texto: 'Decifrado.' }), h('span', { class: 'fraco', texto: m.caminho.length > 1 ? ` Eram ${m.caminho.length} camadas.` : ' Uma camada só.' })),
      ...corpoDoResultado(m, r), outrasHipoteses(r));
    return;
  }
  if (m) {
    anexar(caixa, 
      h('h3', { class: 'titulo' }, h('span', { class: 'forte', texto: 'Talvez.' }), h('span', { class: 'fraco', texto: ' Nada passou da nota de corte, este é o palpite mais próximo de uma língua.' })),
      ...corpoDoResultado(m, r), outrasHipoteses(r));
    return;
  }
  caixa.classList.add('falhou');
  if (r.avisos.length) {
    anexar(caixa, h('h3', { class: 'titulo' }, h('span', { class: 'forte', texto: 'Isso não dá para decifrar aqui.' }), h('span', { class: 'fraco', texto: ' O motivo está acima.' })));
    return;
  }
  anexar(caixa, 
    h('h3', { class: 'titulo' }, h('span', { class: 'forte', texto: 'Não achei nada que faça sentido.' }), h('span', { class: 'fraco', texto: ` Testei ${r.tentativas} métodos em ${r.camadas} ${r.camadas === 1 ? 'camada' : 'camadas'}.` })),
    h('div', { class: 'texto-claro motivos' },
      '• O texto pode ser curto demais para a estatística funcionar.\n',
      '• Pode precisar de uma chave: abra "Sei uma chave" lá em cima.\n',
      '• Pode ser uma cifra que o site não tem (Playfair, Enigma, livro de códigos).\n',
      '• Pode ser criptografia moderna, que só abre com a chave.'),
    r.parou === 'tempo' ? h('p', { class: 'nota aviso-curto', texto: 'Parei por tempo (25 s).' }) : null);
}

function terminar(r) {
  rodando = false;
  el.botao.disabled = false;
  el.botao.textContent = '[ DECIFRAR ]';
  el.parar.hidden = true;
  el.hudEstado.classList.remove('ativo');
  el.hudEstado.textContent = r.parou === 'cancelado' ? 'interrompido' : `${r.tentativas} métodos · ${r.ms} ms`;
  el.fitaResumo.textContent = `${linhas.length} linhas · ${r.ms} ms`;
  if (!linhas.length) {
    el.fita.replaceChildren(h('p', { class: 'fita-vazia', texto: r.jaLegivel ? 'Nenhum método foi preciso.' : 'Nenhum método se aplicou a este formato.' }));
  }
  desenharResposta(r);
  marcarCaminho(r.melhor);
}

// ---------- executar ----------
function executar() {
  const texto = el.entrada.value;
  if (!texto.trim()) {
    el.entrada.focus();
    return;
  }
  if (!worker) criarWorker();
  if (!worker) return;
  if (rodando) worker.postMessage({ tipo: 'cancelar' });
  idAtual++;
  rodando = true;
  linhas = [];
  ultimaCamada = 0;
  tentativas = 0;
  el.fita.replaceChildren();
  el.fitaResumo.textContent = '0 linhas';
  el.resposta.classList.remove('falhou');
  el.resposta.replaceChildren(h('p', { class: 'resposta-vazia', texto: 'Testando…' }));
  el.botao.disabled = true;
  el.botao.textContent = '[ TESTANDO… ]';
  el.parar.hidden = false;
  el.hudEstado.classList.add('ativo');
  el.hudEstado.textContent = 'testando…';
  el.mesa.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'start' });
  worker.postMessage({ tipo: 'decifrar', id: idAtual, entrada: texto, chave: el.chave.value });
}

el.form.addEventListener('submit', (e) => { e.preventDefault(); executar(); });
el.entrada.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); executar(); }
});
el.parar.addEventListener('click', () => worker?.postMessage({ tipo: 'cancelar' }));
el.limpar.addEventListener('click', () => {
  if (rodando) worker?.postMessage({ tipo: 'cancelar' });
  el.entrada.value = '';
  el.chave.value = '';
  el.entrada.focus();
});

// ---------- catálogo (vem do próprio motor, para a contagem nunca mentir) ----------
const TEXTO_GRUPO = {
  codificacao: ['codificações', 'Sem chave, com volta exata', 'Formatos que qualquer um desfaz se souber qual é. O site tenta todos e vê qual deixa texto limpo.'],
  cifra: ['cifras clássicas', 'Quebradas pela estatística', 'Sem chave: o site descobre o deslocamento, o tamanho da chave ou o alfabeto embaralhado pela frequência das letras.'],
};

function montarCatalogo(itens) {
  el.hudMetodos.textContent = `${itens.length} métodos`;
  const cols = [];
  for (const grupo of ['codificacao', 'cifra']) {
    const lista = itens.filter((i) => i.grupo === grupo && i.id !== 'chave');
    const [rot, titulo, texto] = TEXTO_GRUPO[grupo];
    cols.push(h('div', { class: 'coluna' },
      h('p', { class: 'rotulo', texto: `${lista.length} ${rot}` }),
      h('h3', { texto: titulo }),
      h('p', { texto }),
      h('ul', {}, lista.map((i) => h('li', { texto: i.nome })))));
  }
  cols.push(h('div', { class: 'coluna' },
    h('p', { class: 'rotulo', texto: 'em camadas' }),
    h('h3', { texto: 'Uma dentro da outra' }),
    h('p', { texto: 'Base64 de um hexa de um ROT13? Ele desfaz uma camada, guarda as melhores pistas e segue, até quatro camadas.' }),
    h('ul', {}, ['Base64 → hexa → ROT13', 'hexa → XOR', 'Base64 → gzip → César'].map((t) => h('li', { texto: t })))));
  el.catalogo.replaceChildren(...cols);
}

criarWorker();
worker?.postMessage({ tipo: 'catalogo' });

// ?exemplo=cadeia abre já com o exemplo rodando (serve para mostrar e para os testes de tela)
const pedido = new URLSearchParams(location.search).get('exemplo');
const ex = EXEMPLOS.find((x) => x.id === pedido);
if (ex) {
  el.entrada.value = ex.texto;
  executar();
}
