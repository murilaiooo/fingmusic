# Fingmusic

Instrumentos musicais de luz para tocar com os dedos, mouse, teclado ou com as mãos no ar (câmera). Tudo é sintetizado em tempo real no navegador, sem samples de terceiros, e o app funciona offline como PWA. Prioridade: iPhone no Safari.

## O que tem

| Modo | Para quê |
|---|---|
| **Tocar** | Modo livre. Acordes da escala, jam automática (bateria + baixo + acordes em 8 estilos), arpejador sincronizado, metrônomo, tap tempo e gravação rápida para o Estúdio. |
| **Aprender** (Follow the Lights) | O instrumento acende onde e quando tocar: antecipação, pulso, sustentação, acerto/erro e símbolos por técnica. Modos Ouvir, Passo a passo, Guiado, Praticar (loop de trecho + adaptação), Memória e Apresentação. Biblioteca com 45 itens (músicas em domínio público com arranjos originais, composições originais, 14 grooves de baixo, 13 lições de técnica, exercícios e percepção). Importa MIDI e lições JSON. |
| **Genius** | Jogo de memória no próprio instrumento (não é um clone de 4 botões). 11 modos: Clássico, Tranquilo, Velocidade, Ritmo, Memória musical, Às cegas, Reverso, Eco, Técnica, Zen e Genius Bass. 4 dificuldades, desafio do dia, código para desafiar amigos, duelo, construir juntos, duas mãos, recordes e conquistas locais. |
| **Estúdio** | Looper com pistas, contagem, overdub, quantização, mute/solo/volume/pan, desfazer/refazer, sequenciador de bateria por passos, piano roll, 12 padrões de bateria originais, sessões salvas, exportação WAV e MIDI. Uma pista vira lição ou desafio do Genius. |
| **Criar** | Instrumento de cordas desenhado na tela (nota, timbre e cor por corda, código para compartilhar), editor de lições com gravação a partir do instrumento, criador de desafios do Genius. |
| **Playground** | Emissores de orbes com gravidade no tempo da música e o dado "Surpresa". |

**Instrumentos (37):** harpas, violões, guitarras (clean, overdrive, distorção, ambiente), ukulele, cavaquinho, koto, sitar; baixos finger, slap, pop, palheta, fretless, funk, synth, sub, 808 e distorcido; piano, piano elétrico, órgão; marimba, vibrafone, kalimba, sinos; sintetizadores lead, pad, space, pluck e theremin; 3 kits de bateria.

**Técnicas:** puxar e soltar a corda (tensão real), slap, pop, palm mute, harmônicos, hammer-on, pull-off, slide, bend, vibrato, tapping, glissando, várias cordas ao mesmo tempo.

**14 pedais:** octaver, compressor, wah (auto/envelope/pedal), overdrive, distorção, bitcrusher, EQ, filtro, chorus, flanger, phaser, tremolo, delay sincronizado ao BPM e reverb, com 12 presets (Funk Bass, Ambient Guitar, Dream Harp, Deep House Bass, Lo-fi Keys, Space Synth…).

**Câmera:** pinça para tocar, dedos passando pelas cordas, mão de efeito (altura controla wah/filtro), filtro One Euro para estabilidade, calibração da pinça, câmera frontal/traseira, opacidade do vídeo. O processamento é 100% local.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173 (use o IP da rede para abrir no celular)
npm run build      # gera dist/ com service worker
npm run preview
npm test           # testes unitários (Vitest)
npm run icons      # regenera ícones/splash a partir de public/icons/icon.svg
```

A câmera exige HTTPS (ou localhost). Para testar no iPhone em desenvolvimento, use `npm run build && npm run preview` atrás de um túnel HTTPS, ou publique no Netlify.

## Atalhos de teclado

`A S D F G H J K L Ç` e `Q W E R T Y U I O P` tocam notas · `Shift` forte · `Alt` suave · `Z`/`X` oitava/posição · `1`–`7` acordes · `Espaço` tocar/pausar · `.` gravar · `M` metrônomo · `Ctrl+Z` desfazer.

## Deploy no Netlify (site `harpa-no-ar`)

O repositório já tem `netlify.toml` (build `npm ci && npm run build`, publica `dist`, cabeçalhos de cache e permissão de câmera). Para publicar:

1. No painel do Netlify, abra o site **harpa-no-ar** → *Site configuration* → *Build & deploy* → *Link repository* e escolha `murilaiooo/fingmusic` (branch `main`). O Netlify lê o `netlify.toml` sozinho.
2. Ou pela linha de comando, com acesso à conta:
   ```bash
   npm ci && npm run build
   npx netlify-cli login
   npx netlify-cli link --name harpa-no-ar
   npx netlify-cli deploy --prod --dir dist
   ```

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): módulos, fluxo de áudio, relógio e decisões.
- [docs/SONG_FORMAT.md](docs/SONG_FORMAT.md): formato de música/lição v1 e notação compacta.
- [docs/TESTING.md](docs/TESTING.md): o que é testado automaticamente e o que precisa de teste manual.

A versão original (um único `index.html`) está preservada em [`legacy/index.html`](legacy/index.html).
