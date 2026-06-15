/**
 * ZX80 character set.
 *
 * The ZX80 and ZX81 share the same display character codes for the printable
 * range (space, punctuation, digits 0x1C-0x25, letters 0x26-0x3F, inverse
 * 0x80-0xBF) and the same block graphics, so the text<->code mapping is reused
 * wholesale from the ZX81. What differs between the machines is the *keyword
 * token* set and how numeric literals are stored — both of which live in the
 * tokenizer, not here. (The ZX81's NUMBER_MARKER float convention does not
 * apply to the ZX80, whose numbers are stored as their digit characters only.)
 */
export {
  parseChar,
  NEWLINE,
  QUOTE,
  QUOTE_IMAGE,
  INVERSE,
  zx81Charset as zx80Charset,
} from '../zx81/charset';
