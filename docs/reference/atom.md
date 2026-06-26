---
title: Acorn Atom BASIC reference
---

<script setup>
import { atomReference } from './data/atom';
</script>

# Acorn Atom BASIC reference

Every command, function and operator in Acorn Atom BASIC.

> **Not yet in this dialect.** Real Atom BASIC reaches memory through the
> indirection operators `?` (byte), `!` (4-byte word) and `$` (string) instead
> of `PEEK`/`POKE`, and offers the remainder operator `%` and the bitwise
> operators `&` (AND), `\` (OR) and `:` (XOR). It also has the functions/words
> `LEN`, `COUNT`, `PTR`, `BGET`/`BPUT`, `EXT`, `FIN`/`FOUT` and `SGET`/`SPUT`.
> These are not yet handled by this IDE's Atom dialect, so they are absent from
> the table below. (Atom BASIC has no `DIV` or `MOD` — those are BBC BASIC.)

<ReferenceTable :data="atomReference" />
