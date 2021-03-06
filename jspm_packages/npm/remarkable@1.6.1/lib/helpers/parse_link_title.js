/* */ 
'use strict';
var unescapeMd = require('../common/utils').unescapeMd;
module.exports = function parseLinkTitle(state, pos) {
  var code,
      start = pos,
      max = state.posMax,
      marker = state.src.charCodeAt(pos);
  if (marker !== 0x22 && marker !== 0x27 && marker !== 0x28) {
    return false;
  }
  pos++;
  if (marker === 0x28) {
    marker = 0x29;
  }
  while (pos < max) {
    code = state.src.charCodeAt(pos);
    if (code === marker) {
      state.pos = pos + 1;
      state.linkContent = unescapeMd(state.src.slice(start + 1, pos));
      return true;
    }
    if (code === 0x5C && pos + 1 < max) {
      pos += 2;
      continue;
    }
    pos++;
  }
  return false;
};
