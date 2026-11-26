# Arquitetura

JavaScript puro em módulos ES, empacotado pelo Vite. Sem framework de UI: a interface é DOM mínimo (`src/ui/dom.js`) e o instrumento é desenhado em um único `<canvas>`.

```
src/
  main.js            entrada: App + Shell + registro dos modos + tela inicial + service worker
  app.js             núcleo: áudio, transporte, performer, luzes, superfícies, câmera, laço de quadros
  core/              emitter, util, timeline (mapa de tempo), transport, performer, midi, haptics
  audio/             engine (master, limiter), channel (instrumento → inserts → pedais → mix),
                     voices (Karplus-Strong estendido, modal/FM, subtrativo), drums, effects, dsp (worklets)
  instruments/       catálogo (37 instrumentos) e presets de pedais
  surfaces/          formas de tocar: strings (harpa/cordas livres), fretboard (braço), keys, mallets, pads, theremin
  physics/           modelo de corda para o desenho (tensão, vibração)
  light/             motor de iluminação (Follow the Lights) e desenho das luzes
  learn/             formato de música, biblioteca, avaliador, motor de prática
  genius/            máquina de estados pura, gerador com semente, controlador
  studio/            sessão/looper e padrões de bateria
  export/            WAV (OfflineAudioContext) — MIDI fica em core/midi.js
  hands/             rastreamento de mãos (MediaPipe, carregado sob demanda) + filtro One Euro
  persist/           IndexedDB (sessões, instrumentos, músicas, MIDI, Genius, progresso) e configurações
  ui/                casca, painéis, folhas (bottom sheets), tutorial
  modes/             play, learn, genius, studio, create, playground
```

## Fluxo de uma nota

1. Um gesto (toque, mouse, teclado, pinça da câmera) chega à **superfície** ativa como ponteiro.
2. A superfície decide nota, força e técnica (ex.: puxar e soltar → `pull`; zona de slap no braço → `slap`) e chama `performer.noteOn`.
3. O **Performer** toca no canal atual e emite um evento unificado `{id, midi, vel, tech, time, source, target, inst}`.
4. Quem precisa escuta esse evento: avaliador do Follow the Lights, Genius, gravação do Estúdio, arpejador, tutorial. Ninguém lê o DOM ou o canvas para saber o que foi tocado.

## Relógio único

Tudo que precisa de sincronia usa `AudioContext.currentTime`:
- o **Transport** agenda com lookahead (cerca de 140 ms à frente) sobre um mapa de tempo (mudanças de BPM, velocidade, loop, contagem, pausa);
- as **luzes** usam `engine.now - outputLatency`, então acendem quando o som realmente sai;
- o **avaliador** compensa a latência de saída e a de entrada (toque/câmera, calibrável nas configurações).

O transporte tem um "dono" (`app.transportOwner`: `studio`, `learn`, `playground`, `arp`, `metronome`) para que só a parte certa toque.

## Áudio

- Cordas: Karplus-Strong com afinação fracionária (allpass), posição de ataque, decaimento T60, brilho por força, transientes de slap/pop/abafado/harmônico. Os buffers são renderizados uma vez e reutilizados (cache LRU), o que mantém a latência baixa no iPhone.
- Teclas e percussão melódica: síntese modal/aditiva e FM; sintetizadores: osciladores e filtros.
- Bateria: síntese por instrumento (bumbo, caixa, pratos, percussão brasileira), mapeada em notas GM.
- Pedais criados sob demanda (só os ligados existem no grafo); bitcrusher e octaver em AudioWorklet.
- Master com compressor suave, limitador e ambiência. No iOS, `navigator.audioSession.type = 'playback'` (toca com o botão de silencioso) e retomada após interrupções.

## Desempenho

O laço de quadros mede o tempo médio por quadro e reduz primeiro os efeitos visuais (densidade de pixels, partículas, quadros da câmera). O áudio nunca é rebaixado. O rastreamento de mãos (~8 MB) só carrega quando a câmera é ligada.

## Persistência

`localStorage` guarda configurações. IndexedDB guarda o resto, com backup/restauração em JSON pelo menu "Dados e backup".
