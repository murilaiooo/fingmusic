# Formato de música/lição (v1)

```json
{
  "format": "fingmusic-song",
  "version": 1,
  "id": "minha-licao",
  "title": "Minha lição",
  "composer": "Você",
  "license": "user",
  "kind": "exercise",
  "genre": "minhas",
  "difficulty": 1,
  "key": { "root": 0, "scale": "major" },
  "tempo": [{ "b": 0, "bpm": 80 }, { "b": 32, "bpm": 92 }],
  "timeSig": [4, 4],
  "techniques": ["slap"],
  "sections": [{ "name": "Frase 1", "from": 0, "to": 8 }],
  "defaultTrack": "main",
  "tracks": [
    { "id": "main", "name": "Baixo", "role": "bass", "instrument": "bassSlap", "volume": 0.8,
      "notes": [{ "b": 0, "d": 1, "m": 33, "v": 0.9, "tech": "slap" }] }
  ]
}
```

- `b` = início em batidas, `d` = duração em batidas, `m` = nota MIDI, `v` = força (0–1.2), `tech` = técnica opcional.
- Técnicas: `finger`, `soft`, `hard`, `pull`, `slap`, `pop`, `mute`, `ghost`, `harmonic`, `hammer`, `slide`, `bend`, `vibrato`, `sustain`, `chord`.
- `tempo` aceita mudanças de andamento; `sections` é opcional (gerado automaticamente em frases de 2 ou 4 compassos).
- Um arquivo de versão mais nova que o app é recusado com mensagem clara; campos desconhecidos são preservados.

## Notação compacta

Usada na biblioteca embutida e no editor de lições:

```
E4 E4 F4 G4 | G4:2@0.4!soft [C4 E4 G4]:2!chord r:1 A1:0.5!slap
```

`nota[:duração][@força][!técnica]`, `r` é pausa, `[...]` é acorde e `|` é só um separador visual.

## MIDI

Arquivos `.mid` (formato 0 e 1) são lidos localmente: notas, mudanças de andamento, fórmula de compasso, nomes de pista e programa GM (convertido para o instrumento mais próximo). Se a pista escolhida não cabe na extensão do instrumento, o app mostra as opções (transpor oitava, transpor semitons, dobrar notas, expandir o instrumento) e nada é alterado sem a escolha do usuário. O arquivo original e a música convertida ficam no IndexedDB.
