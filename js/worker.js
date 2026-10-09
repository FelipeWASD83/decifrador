// Roda o motor fora da tela, para a página não travar enquanto testa as cifras.

import { decifrar, METODOS } from './motor.js';

let corrida = 0;

self.onmessage = async (e) => {
  const m = e.data;
  if (m.tipo === 'catalogo') {
    self.postMessage({ tipo: 'catalogo', itens: METODOS.map(({ id, nome, grupo }) => ({ id, nome, grupo })) });
    return;
  }
  if (m.tipo === 'cancelar') {
    corrida++; // invalida a busca em andamento
    return;
  }
  if (m.tipo !== 'decifrar') return;
  const minha = ++corrida;
  const r = await decifrar(m.entrada, {
    chave: m.chave,
    aoTentar: (ev) => { if (minha === corrida) self.postMessage({ tipo: 'tentativa', id: m.id, ev }); },
    cancelado: () => minha !== corrida,
  });
  self.postMessage({ tipo: 'fim', id: m.id, resultado: r });
};
