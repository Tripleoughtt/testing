/* */ 
'use strict';
var HTML_TAG_RE = require('../common/html_re').HTML_TAG_RE;
function isLetter(ch) {
  var lc = ch | 0x20;
  return (lc >= 0x61) && (lc <= 0x7a);
}
module.exports = function htmltag(state, silent) {
  var ch,
      match,
      max,
      pos = state.pos;
  if (!state.options.html) {
    return false;
  }
  max = state.posMax;
  if (state.src.charCodeAt(pos) !== 0x3C || pos + 2 >= max) {
    return false;
  }
  ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21 && ch !== 0x3F && ch !== 0x2F && !isLetter(ch)) {
    return false;
  }
  match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) {
    return false;
  }
  if (!silent) {
    state.push({
      type: 'htmltag',
      content: state.src.slice(pos, pos + match[0].length),
      level: state.level
    });
  }
  state.pos += match[0].length;
  return true;
};
