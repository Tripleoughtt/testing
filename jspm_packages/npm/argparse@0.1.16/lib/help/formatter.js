/* */ 
(function(process) {
  'use strict';
  var _ = require('underscore');
  _.str = require('underscore.string');
  var $$ = require('../const');
  function Section(parent, heading) {
    this._parent = parent;
    this._heading = heading;
    this._items = [];
  }
  Section.prototype.addItem = function(callback) {
    this._items.push(callback);
  };
  Section.prototype.formatHelp = function(formatter) {
    var itemHelp,
        heading;
    if (!!this._parent) {
      formatter._indent();
    }
    itemHelp = this._items.map(function(item) {
      var obj,
          func,
          args;
      obj = formatter;
      func = item[0];
      args = item[1];
      return func.apply(obj, args);
    });
    itemHelp = formatter._joinParts(itemHelp);
    if (!!this._parent) {
      formatter._dedent();
    }
    if (!itemHelp) {
      return '';
    }
    heading = '';
    if (!!this._heading && this._heading !== $$.SUPPRESS) {
      var currentIndent = formatter.currentIndent;
      heading = _.str.repeat(' ', currentIndent) + this._heading + ':' + $$.EOL;
    }
    return formatter._joinParts([$$.EOL, heading, itemHelp, $$.EOL]);
  };
  var HelpFormatter = module.exports = function HelpFormatter(options) {
    options = options || {};
    this._prog = options.prog;
    this._maxHelpPosition = options.maxHelpPosition || 24;
    this._width = (options.width || ((process.env.COLUMNS || 80) - 2));
    this._currentIndent = 0;
    this._indentIncriment = options.indentIncriment || 2;
    this._level = 0;
    this._actionMaxLength = 0;
    this._rootSection = new Section(null);
    this._currentSection = this._rootSection;
    this._whitespaceMatcher = new RegExp('\\s+', 'g');
    this._longBreakMatcher = new RegExp($$.EOL + $$.EOL + $$.EOL + '+', 'g');
  };
  HelpFormatter.prototype._indent = function() {
    this._currentIndent += this._indentIncriment;
    this._level += 1;
  };
  HelpFormatter.prototype._dedent = function() {
    this._currentIndent -= this._indentIncriment;
    this._level -= 1;
    if (this._currentIndent < 0) {
      throw new Error('Indent decreased below 0.');
    }
  };
  HelpFormatter.prototype._addItem = function(func, args) {
    this._currentSection.addItem([func, args]);
  };
  HelpFormatter.prototype.startSection = function(heading) {
    this._indent();
    var section = new Section(this._currentSection, heading);
    var func = section.formatHelp.bind(section);
    this._addItem(func, [this]);
    this._currentSection = section;
  };
  HelpFormatter.prototype.endSection = function() {
    this._currentSection = this._currentSection._parent;
    this._dedent();
  };
  HelpFormatter.prototype.addText = function(text) {
    if (!!text && text !== $$.SUPPRESS) {
      this._addItem(this._formatText, [text]);
    }
  };
  HelpFormatter.prototype.addUsage = function(usage, actions, groups, prefix) {
    if (usage !== $$.SUPPRESS) {
      this._addItem(this._formatUsage, [usage, actions, groups, prefix]);
    }
  };
  HelpFormatter.prototype.addArgument = function(action) {
    if (action.help !== $$.SUPPRESS) {
      var self = this;
      var invocations = [this._formatActionInvocation(action)];
      var invocationLength = invocations[0].length;
      var actionLength;
      if (!!action._getSubactions) {
        this._indent();
        action._getSubactions().forEach(function(subaction) {
          var invocationNew = self._formatActionInvocation(subaction);
          invocations.push(invocationNew);
          invocationLength = Math.max(invocationLength, invocationNew.length);
        });
        this._dedent();
      }
      actionLength = invocationLength + this._currentIndent;
      this._actionMaxLength = Math.max(this._actionMaxLength, actionLength);
      this._addItem(this._formatAction, [action]);
    }
  };
  HelpFormatter.prototype.addArguments = function(actions) {
    var self = this;
    actions.forEach(function(action) {
      self.addArgument(action);
    });
  };
  HelpFormatter.prototype.formatHelp = function() {
    var help = this._rootSection.formatHelp(this);
    if (help) {
      help = help.replace(this._longBreakMatcher, $$.EOL + $$.EOL);
      help = _.str.strip(help, $$.EOL) + $$.EOL;
    }
    return help;
  };
  HelpFormatter.prototype._joinParts = function(partStrings) {
    return partStrings.filter(function(part) {
      return (!!part && part !== $$.SUPPRESS);
    }).join('');
  };
  HelpFormatter.prototype._formatUsage = function(usage, actions, groups, prefix) {
    if (!prefix && !_.isString(prefix)) {
      prefix = 'usage: ';
    }
    actions = actions || [];
    groups = groups || [];
    if (usage) {
      usage = _.str.sprintf(usage, {prog: this._prog});
    } else if (!usage && actions.length === 0) {
      usage = this._prog;
    } else if (!usage) {
      var prog = this._prog;
      var optionals = [];
      var positionals = [];
      var actionUsage;
      var textWidth;
      actions.forEach(function(action) {
        if (action.isOptional()) {
          optionals.push(action);
        } else {
          positionals.push(action);
        }
      });
      actionUsage = this._formatActionsUsage([].concat(optionals, positionals), groups);
      usage = [prog, actionUsage].join(' ');
      textWidth = this._width - this._currentIndent;
      if ((prefix.length + usage.length) > textWidth) {
        var regexpPart = new RegExp('\\(.*?\\)+|\\[.*?\\]+|\\S+', 'g');
        var optionalUsage = this._formatActionsUsage(optionals, groups);
        var positionalUsage = this._formatActionsUsage(positionals, groups);
        var optionalParts = optionalUsage.match(regexpPart);
        var positionalParts = positionalUsage.match(regexpPart) || [];
        if (optionalParts.join(' ') !== optionalUsage) {
          throw new Error('assert "optionalParts.join(\' \') === optionalUsage"');
        }
        if (positionalParts.join(' ') !== positionalUsage) {
          throw new Error('assert "positionalParts.join(\' \') === positionalUsage"');
        }
        var _getLines = function(parts, indent, prefix) {
          var lines = [];
          var line = [];
          var lineLength = !!prefix ? prefix.length - 1 : indent.length - 1;
          parts.forEach(function(part) {
            if (lineLength + 1 + part.length > textWidth) {
              lines.push(indent + line.join(' '));
              line = [];
              lineLength = indent.length - 1;
            }
            line.push(part);
            lineLength += part.length + 1;
          });
          if (line) {
            lines.push(indent + line.join(' '));
          }
          if (prefix) {
            lines[0] = lines[0].substr(indent.length);
          }
          return lines;
        };
        var lines,
            indent,
            parts;
        if (prefix.length + prog.length <= 0.75 * textWidth) {
          indent = _.str.repeat(' ', (prefix.length + prog.length + 1));
          if (optionalParts) {
            lines = [].concat(_getLines([prog].concat(optionalParts), indent, prefix), _getLines(positionalParts, indent));
          } else if (positionalParts) {
            lines = _getLines([prog].concat(positionalParts), indent, prefix);
          } else {
            lines = [prog];
          }
        } else {
          indent = _.str.repeat(' ', prefix.length);
          parts = optionalParts + positionalParts;
          lines = _getLines(parts, indent);
          if (lines.length > 1) {
            lines = [].concat(_getLines(optionalParts, indent), _getLines(positionalParts, indent));
          }
          lines = [prog] + lines;
        }
        usage = lines.join($$.EOL);
      }
    }
    return prefix + usage + $$.EOL + $$.EOL;
  };
  HelpFormatter.prototype._formatActionsUsage = function(actions, groups) {
    var groupActions = [];
    var inserts = [];
    var self = this;
    groups.forEach(function(group) {
      var end;
      var i;
      var start = actions.indexOf(group._groupActions[0]);
      if (start >= 0) {
        end = start + group._groupActions.length;
        if (_.isEqual(actions.slice(start, end), group._groupActions)) {
          group._groupActions.forEach(function(action) {
            groupActions.push(action);
          });
          if (!group.required) {
            if (!!inserts[start]) {
              inserts[start] += ' [';
            } else {
              inserts[start] = '[';
            }
            inserts[end] = ']';
          } else {
            if (!!inserts[start]) {
              inserts[start] += ' (';
            } else {
              inserts[start] = '(';
            }
            inserts[end] = ')';
          }
          for (i = start + 1; i < end; i += 1) {
            inserts[i] = '|';
          }
        }
      }
    });
    var parts = [];
    actions.forEach(function(action, actionIndex) {
      var part;
      var optionString;
      var argsDefault;
      var argsString;
      if (action.help === $$.SUPPRESS) {
        parts.push(null);
        if (inserts[actionIndex] === '|') {
          inserts.splice(actionIndex, actionIndex);
        } else if (inserts[actionIndex + 1] === '|') {
          inserts.splice(actionIndex + 1, actionIndex + 1);
        }
      } else if (!action.isOptional()) {
        part = self._formatArgs(action, action.dest);
        if (groupActions.indexOf(action) >= 0) {
          if (part[0] === '[' && part[part.length - 1] === ']') {
            part = part.slice(1, -1);
          }
        }
        parts.push(part);
      } else {
        optionString = action.optionStrings[0];
        if (action.nargs === 0) {
          part = '' + optionString;
        } else {
          argsDefault = action.dest.toUpperCase();
          argsString = self._formatArgs(action, argsDefault);
          part = optionString + ' ' + argsString;
        }
        if (!action.required && groupActions.indexOf(action) < 0) {
          part = '[' + part + ']';
        }
        parts.push(part);
      }
    });
    for (var i = inserts.length - 1; i >= 0; --i) {
      if (inserts[i] !== null) {
        parts.splice(i, 0, inserts[i]);
      }
    }
    var text = parts.filter(function(part) {
      return !!part;
    }).join(' ');
    text = text.replace(/([\[(]) /g, '$1');
    text = text.replace(/ ([\])])/g, '$1');
    text = text.replace(/\[ *\]/g, '');
    text = text.replace(/\( *\)/g, '');
    text = text.replace(/\(([^|]*)\)/g, '$1');
    text = _.str.strip(text);
    return text;
  };
  HelpFormatter.prototype._formatText = function(text) {
    text = _.str.sprintf(text, {prog: this._prog});
    var textWidth = this._width - this._currentIndent;
    var indentIncriment = _.str.repeat(' ', this._currentIndent);
    return this._fillText(text, textWidth, indentIncriment) + $$.EOL + $$.EOL;
  };
  HelpFormatter.prototype._formatAction = function(action) {
    var self = this;
    var helpText;
    var helpLines;
    var parts;
    var indentFirst;
    var helpPosition = Math.min(this._actionMaxLength + 2, this._maxHelpPosition);
    var helpWidth = this._width - helpPosition;
    var actionWidth = helpPosition - this._currentIndent - 2;
    var actionHeader = this._formatActionInvocation(action);
    if (!action.help) {
      actionHeader = _.str.repeat(' ', this._currentIndent) + actionHeader + $$.EOL;
    } else if (actionHeader.length <= actionWidth) {
      actionHeader = _.str.repeat(' ', this._currentIndent) + actionHeader + '  ' + _.str.repeat(' ', actionWidth - actionHeader.length);
      indentFirst = 0;
    } else {
      actionHeader = _.str.repeat(' ', this._currentIndent) + actionHeader + $$.EOL;
      indentFirst = helpPosition;
    }
    parts = [actionHeader];
    if (!!action.help) {
      helpText = this._expandHelp(action);
      helpLines = this._splitLines(helpText, helpWidth);
      parts.push(_.str.repeat(' ', indentFirst) + helpLines[0] + $$.EOL);
      helpLines.slice(1).forEach(function(line) {
        parts.push(_.str.repeat(' ', helpPosition) + line + $$.EOL);
      });
    } else if (actionHeader.charAt(actionHeader.length - 1) !== $$.EOL) {
      parts.push($$.EOL);
    }
    if (!!action._getSubactions) {
      this._indent();
      action._getSubactions().forEach(function(subaction) {
        parts.push(self._formatAction(subaction));
      });
      this._dedent();
    }
    return this._joinParts(parts);
  };
  HelpFormatter.prototype._formatActionInvocation = function(action) {
    if (!action.isOptional()) {
      var format_func = this._metavarFormatter(action, action.dest);
      var metavars = format_func(1);
      return metavars[0];
    } else {
      var parts = [];
      var argsDefault;
      var argsString;
      if (action.nargs === 0) {
        parts = parts.concat(action.optionStrings);
      } else {
        argsDefault = action.dest.toUpperCase();
        argsString = this._formatArgs(action, argsDefault);
        action.optionStrings.forEach(function(optionString) {
          parts.push(optionString + ' ' + argsString);
        });
      }
      return parts.join(', ');
    }
  };
  HelpFormatter.prototype._metavarFormatter = function(action, metavarDefault) {
    var result;
    if (!!action.metavar || action.metavar === '') {
      result = action.metavar;
    } else if (!!action.choices) {
      var choices = action.choices;
      if (_.isString(choices)) {
        choices = choices.split('').join(', ');
      } else if (_.isArray(choices)) {
        choices = choices.join(',');
      } else {
        choices = _.keys(choices).join(',');
      }
      result = '{' + choices + '}';
    } else {
      result = metavarDefault;
    }
    return function(size) {
      if (Array.isArray(result)) {
        return result;
      } else {
        var metavars = [];
        for (var i = 0; i < size; i += 1) {
          metavars.push(result);
        }
        return metavars;
      }
    };
  };
  HelpFormatter.prototype._formatArgs = function(action, metavarDefault) {
    var result;
    var metavars;
    var buildMetavar = this._metavarFormatter(action, metavarDefault);
    switch (action.nargs) {
      case undefined:
      case null:
        metavars = buildMetavar(1);
        result = '' + metavars[0];
        break;
      case $$.OPTIONAL:
        metavars = buildMetavar(1);
        result = '[' + metavars[0] + ']';
        break;
      case $$.ZERO_OR_MORE:
        metavars = buildMetavar(2);
        result = '[' + metavars[0] + ' [' + metavars[1] + ' ...]]';
        break;
      case $$.ONE_OR_MORE:
        metavars = buildMetavar(2);
        result = '' + metavars[0] + ' [' + metavars[1] + ' ...]';
        break;
      case $$.REMAINDER:
        result = '...';
        break;
      case $$.PARSER:
        metavars = buildMetavar(1);
        result = metavars[0] + ' ...';
        break;
      default:
        metavars = buildMetavar(action.nargs);
        result = metavars.join(' ');
    }
    return result;
  };
  HelpFormatter.prototype._expandHelp = function(action) {
    var params = {prog: this._prog};
    Object.keys(action).forEach(function(actionProperty) {
      var actionValue = action[actionProperty];
      if (actionValue !== $$.SUPPRESS) {
        params[actionProperty] = actionValue;
      }
    });
    if (!!params.choices) {
      if (_.isString(params.choices)) {
        params.choices = params.choices.split('').join(', ');
      } else if (_.isArray(params.choices)) {
        params.choices = params.choices.join(', ');
      } else {
        params.choices = _.keys(params.choices).join(', ');
      }
    }
    return _.str.sprintf(this._getHelpString(action), params);
  };
  HelpFormatter.prototype._splitLines = function(text, width) {
    var lines = [];
    var delimiters = [" ", ".", ",", "!", "?"];
    var re = new RegExp('[' + delimiters.join('') + '][^' + delimiters.join('') + ']*$');
    text = text.replace(/[\n\|\t]/g, ' ');
    text = _.str.strip(text);
    text = text.replace(this._whitespaceMatcher, ' ');
    text.split($$.EOL).forEach(function(line) {
      if (width >= line.length) {
        lines.push(line);
        return;
      }
      var wrapStart = 0;
      var wrapEnd = width;
      var delimiterIndex = 0;
      while (wrapEnd <= line.length) {
        if (wrapEnd !== line.length && delimiters.indexOf(line[wrapEnd] < -1)) {
          delimiterIndex = (re.exec(line.substring(wrapStart, wrapEnd)) || {}).index;
          wrapEnd = wrapStart + delimiterIndex + 1;
        }
        lines.push(line.substring(wrapStart, wrapEnd));
        wrapStart = wrapEnd;
        wrapEnd += width;
      }
      if (wrapStart < line.length) {
        lines.push(line.substring(wrapStart, wrapEnd));
      }
    });
    return lines;
  };
  HelpFormatter.prototype._fillText = function(text, width, indent) {
    var lines = this._splitLines(text, width);
    lines = lines.map(function(line) {
      return indent + line;
    });
    return lines.join($$.EOL);
  };
  HelpFormatter.prototype._getHelpString = function(action) {
    return action.help;
  };
})(require('process'));
