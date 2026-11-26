# Testes

## Automáticos

`npm test` roda os testes unitários (Vitest):
- teoria musical (escalas, acordes, progressões, encaixe na escala);
- síntese (afinação das cordas medida com YIN, ausência de clipping);
- linha do tempo e transporte (mapa de tempo, loop, contagem) com relógio falso.

`npm run build` também é usado como verificação rápida de que todos os módulos se resolvem.

## Não testado nesta entrega (precisa de teste manual)

Por pedido do dono do projeto, a validação visual e de interação foi deixada para depois. Não foram verificados:
- iPhone/iPad reais (Safari e PWA instalado), Android e desktop: layout, safe areas, rotação, toque multitoque;
- latência real de áudio e a calibração de latência;
- vibração (háptico) no iOS e no Android;
- modo câmera com mãos reais (MediaPipe, pinça, mão de efeito, frontal/traseira);
- escuta crítica dos timbres, pedais e da exportação WAV/MIDI em outros programas;
- fluxo completo de cada modo (Aprender, Genius, Estúdio, Criar, Playground) e instalação offline do service worker.

Foi feito apenas um teste de fumaça automatizado: abrir cada modo no Chromium sem erros no console, iniciar uma lição, uma partida do Genius e a jam.

## Checklist sugerido para o teste manual

1. Abrir no iPhone, adicionar à Tela de Início e abrir offline.
2. Tocar: deslizar pelas cordas, puxar e soltar, trocar para Baixo slap e testar slap/pop/abafar.
3. Pedais: ligar wah + delay e conferir o som; aplicar o preset Funk Bass.
4. Aprender: "Ode à Alegria" no modo Guiado; depois um groove de baixo no modo Praticar a 75%.
5. Genius: Clássico/Iniciante; depois Genius Bass; compartilhar o resultado.
6. Estúdio: bateria pronta + gravar uma pista com contagem; exportar WAV e MIDI.
7. Criar: desenhar 5 cordas, mudar notas, salvar e reabrir.
8. Câmera: ativar, tocar com a pinça, trocar de câmera, calibrar.
