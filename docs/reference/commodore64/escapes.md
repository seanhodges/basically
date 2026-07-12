---
title: Commodore 64 escape codes
---

<script setup>
import { commodore64Escapes } from '../data/escapes/commodore64';
</script>

# Commodore 64 escape codes

Every escape that can be typed in C64 source, and the PETSCII byte it stores. Escapes are recognised in string literals, REM and DATA bodies. Canonical names follow this app's decode; the petcat/VICE aliases (`{wht}`, `{rvof}`, decimal `{147}`, `{CBM-x}`/`{SHIFT-x}`) are accepted on input so archived petcat listings paste straight in. The lower-case display bank and tokenizer keyword abbreviations (`pO`, `gO`, ...) are not yet modelled. Filters can be prefilled with `?q=` and `?cat=` query parameters.

See also the [Commodore BASIC reference](../commodore64) and
[file formats](../file-formats#escape-notation).

<EscapeTable :data="commodore64Escapes" />
