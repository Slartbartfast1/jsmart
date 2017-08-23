/*!
 * jSmart JavaScript template engine (v2.15.1)
 * https://github.com/umakantp/jsmart
 *
 * Copyright 2011-2017, Umakant Patil <me at umakantpatil dot com>
 *                      Max Miroshnikov <miroshnikov at gmail dot com>
 * https://opensource.org/licenses/MIT
 *
 * Date: 2017-08-23T12:50Z
 */
(function(factory) {
  "use strict";

  if (typeof module === "object" && module && typeof module.exports === "object") {
    // Node.js like environment. Export jSmart
    module.exports = factory();
  } else {
    if (window && window.document) {
      // Assign to browser window if window is present.
      window.jSmart = factory();
    }

    if (typeof define === "function" && define.amd) {
        // Require js is present? Lets define module.
        define("jSmart", [], factory);
    }
  }
// Pass this if window is not defined yet
})(function() {
"use strict";

 
function ObjectMerge(ob1, ob2 /*, ...*/) {
    for (var i=1; i<arguments.length; ++i) {
      for (var nm in arguments[i]) {
        ob1[nm] = arguments[i][nm];
      }
    }
    return ob1;
  }
function EvalString(s) {
    return s.replace(/\\t/,'\t').replace(/\\n/,'\n').replace(/\\(['"\\])/g,'$1');
  }
// Trim all quotes.
  function TrimAllQuotes(s) {
    return EvalString(s.replace(/^['"](.*)['"]$/,'$1')).replace(/^\s+|\s+$/g,'');
  }
// Parser object. Plain object which just does parsing.
  var jSmartParser = {

    // jSmart object used for current parsing.
    jSmart: {},

    // Object which is copy of jSmart.smarty for local modification.
    smarty: {},

    // Parse the template and return the data.
    getParsed: function (template, that) {
      var tree, smarty;
      // Copy the jSmart object, so we could use it while parsing.
      this.jSmart = that;
      // Create a copy of smarty object, as we modify that data and
      // we want to keep a copy rather than modifying original jSmart object.
      ObjectMerge(this.smarty, that.smarty);

      // Parse the template and get the output.
      tree = this.parse(template),
      smarty = this.smarty;
      // Empty parser objects. Clean up.
      // We do not want old data held up here.
      this.jSmart = {};
      this.smarty = {};
      return tree;
    },

    // Parse the template and generate tree.
    parse: function (tpl) {
      var tree = [],
          openTag,
          tag,
          name,
          paramStr,
          node;

      for (openTag = this.findTag('', tpl); openTag; openTag = this.findTag('', tpl))  {
        if (openTag.index) {
          tree = tree.concat(this.parseText(tpl.slice(0, openTag.index)));
        }
        tpl = tpl.slice((openTag.index + openTag[0].length));
        tag = openTag[1].match(/^\s*(\w+)(.*)$/);

        if (tag) {
          // Function?!
          name = tag[1];
          paramStr = (tag.length > 2) ? tag[2].replace(/^\s+|\s+$/g, '') : '';
          if (name in this.buildInFunctions) {
            var buildIn = this.buildInFunctions[name];
            var params = ('parseParams' in buildIn ? buildIn.parseParams : this.parseParams.bind(this))(paramStr);
            if (buildIn.type == 'block') {
              // TODO:: Design block plugins later.
              // Remove new line after block open tag (like in Smarty)
              tpl = tpl.replace(/^\n/, '');
              var closeTag = this.findCloseTag('\/'+name, name+' +[^}]*', tpl);
              tree = tree.concat(buildIn.parse.call(this, params, tpl.slice(0, closeTag.index)));
              tpl = tpl.slice(closeTag.index+closeTag[0].length);
            } else {
              tree = tree.concat(buildIn.parse.call(this, params));
              if (name == 'extends') {
                // TODO:: How to implement this?
                //tree = []; //throw away further parsing except for {block}
              }
            }
            tpl = tpl.replace(/^\n/,'');
          }
        } else {
          // Variable.
          node = this.buildInFunctions.expression.parse.call(this, openTag[1]);
          if (node.type=='build-in' && node.name=='operator' && node.op == '=') {
            tpl = tpl.replace(/^\n/, '');
          }
          tree.push(node);
        }
      }
      if (tpl) {
        tree = tree.concat(this.parseText(tpl));
      }
      console.log(tree);
      return tree;
    },

    // Find a first {tag} in the string.
    findTag: function(expression, s) {
      var openCount = 0,
          offset = 0,
          i,
          ldelim = this.smarty.ldelim,
          rdelim = this.smarty.rdelim,
          skipInWhitespace = this.jSmart.autoLiteral,
          expressionAny = /^\s*(.+)\s*$/i,
          expressionTag = expression ? new RegExp('^\\s*('+expression+')\\s*$','i') : expressionAny,
          sTag,
          found;

      for (i = 0; i < s.length; ++i) {
        if (s.substr(i, ldelim.length) == ldelim) {
          if (skipInWhitespace && (i + 1) < s.length && s.substr((i + 1), 1).match(/\s/)) {
            continue;
          }
          if (!openCount) {
            s = s.slice(i);
            offset += parseInt(i);
            i = 0;
          }
          ++openCount;
        } else if (s.substr(i, rdelim.length) == rdelim) {
          if (skipInWhitespace && (i - 1) >= 0 && s.substr((i - 1), 1).match(/\s/)) {
            continue;
          }
          if (!--openCount) {
            sTag = s.slice(ldelim.length, i).replace(/[\r\n]/g, ' '),
            found = sTag.match(expressionTag);
            if (found) {
              found.index = offset;
              found[0] = s.slice(0, (i + rdelim.length));
              return found;
            }
          }
          if (openCount < 0) {
            // Ignore any number of unmatched right delimiters.
            openCount = 0;
          }
        }
      }
      return null;
    },

    findElseTag: function(reOpen, reClose, reElse, s) {
      var offset = 0;
      for (var elseTag = this.findTag(reElse, s); elseTag; elseTag = this.findTag(reElse, s)) {
        var openTag = this.findTag(reOpen, s);
        if (!openTag || openTag.index > elseTag.index) {
          elseTag.index += offset;
          return elseTag;
        } else {
          s = s.slice(openTag.index+openTag[0].length);
          offset += openTag.index+openTag[0].length;
          var closeTag = this.findCloseTag(reClose,reOpen,s);
          s = s.slice(closeTag.index + closeTag[0].length);
          offset += closeTag.index + closeTag[0].length;
        }
      }
      return null;
    },

    // Find closing tag which matches. expressionClose.
    findCloseTag: function(expressionClose, expressionOpen, s) {
      var sInner = '',
          closeTag = null,
          openTag = null,
          findIndex = 0;

      do {
        if (closeTag) {
          findIndex += closeTag[0].length;
        }
        closeTag = this.findTag(expressionClose, s);
        if (!closeTag) {
          throw new Error('Unclosed '+this.smarty.ldelim+expressionOpen+this.smarty.rdelim);
        }
        sInner += s.slice(0, closeTag.index);
        findIndex += closeTag.index;
        s = s.slice((closeTag.index + closeTag[0].length));
        openTag = this.findTag(expressionOpen, sInner);
        if (openTag) {
          sInner = sInner.slice((openTag.index + openTag[0].length));
        }
      } while(openTag);

      closeTag.index = findIndex;
      return closeTag;
    },

    bundleOp: function (i, tree, precedence) {
      var op = tree[i];
      if (op.name == 'operator' && op.precedence == precedence && !op.params.__parsed) {
        if (op.optype == 'binary') {
            op.params.__parsed = [tree[(i - 1)],tree[(i + 1)]];
            tree.splice((i - 1), 3, op);
            return [true, tree];
        } else if (op.optype == 'post-unary') {
            op.params.__parsed = [tree[(i - 1)]];
            tree.splice((i - 1), 2, op);
            return [true, tree];
        }

        op.params.__parsed = [tree[(i + 1)]];
        tree.splice(i, 2, op);
      }
      return [false, tree];
    },

    composeExpression: function(tree) {
      var i = 0,
          data;
      for (i = 0; i < tree.length; ++i) {
        if (tree[i] instanceof Array) {
          tree[i] = this.composeExpression(tree[i]);
        }
      }

      for (var precedence = 1; precedence < 14; ++precedence) {
        if (precedence == 2 || precedence == 10) {
          for (i = tree.length; i > 0; --i) {
              data = this.bundleOp(i-1, tree, precedence);
              i -= data[0];
              tree = data[1];
          }
        } else {
          for (i=0; i<tree.length; ++i) {
            data = this.bundleOp(i, tree, precedence);
            i -= data[0];
            tree = data[1];
          }
        }
      }
      // Only one node should be left.
      return tree[0];
    },

    getMatchingToken: function (s) {
      for (var i = 0; i < this.tokens.length; ++i) {
        if (s.match(this.tokens[i].regex)) {
          return i;
        }
      }
      return false;
    },

    parseVar: function (s, name) {
      var expression = /^(?:\.|\s*->\s*|\[\s*)/,
          op,
          data = {value: '', tree: []},
          lookUpData,
          token = '',
          parts = [{type: 'text', data: name}];

      for (op = s.match(expression); op; op = s.match(expression)) {
        token += op[0];
        s = s.slice(op[0].length);
        if (op[0].match(/\[/)) {
          data = this.parseExpression(s);
          if (data.tree) {
            token += data.value;
            parts.push(data.tree);
            s = s.slice(data.value.length);
          }
          var closeOp = s.match(/\s*\]/);
          if (closeOp) {
            token += closeOp[0];
            s = s.slice(closeOp[0].length);
          }
        } else {
          var parseMod = this.parseModifiersStop;
          this.parseModifiersStop = true;
          lookUpData = this.lookUp(s, data.value);

          if (lookUpData) {
            data.tree = data.tree.concat(lookUpData.tree);
            data.value = lookUpData.value;
            token += lookUpData.value;

            if (lookUpData.ret) {
              var part = data.tree[0];
              if (part.type == 'plugin' && part.name == '__func') {
                  part.hasOwner = true;
              }
              parts.push(part);
              s = s.slice(data.value.length);
            } else {
              data = false;
            }
          }
          this.parseModifiersStop = parseMod;
        }
        if (!data) {
          parts.push({type:'text', data:''});
        }
      }

      return {s: s, token: token, tree: [{type: 'var', parts: parts}]};
    },

    parseFunc: function(name, params, tree) {
      params.__parsed.name = this.parseText(name, [])[0];
      tree.push({
          type: 'plugin',
          name: '__func',
          params: params
      });
      return tree;
    },

    parseOperator: function(op, type, precedence) {
      return [{
        type: 'build-in',
        name: 'operator',
        op: op,
        optype: type,
        precedence: precedence,
        params: {}
      }];
    },

    parsePluginFunc: function (name, params) {
      return [{
          type: 'plugin',
          name: name,
          params: params
      }];
    },

    parseModifiers: function (s, tree) {
      var modifier = s.match(/^\|(\w+)/),
          value = '',
          funcName;
      if (this.parseModifiersStop) {
        return;
      }
      if (!modifier) {
        return;
      }
      value += modifier[0];

      funcName = ((modifier[1] == 'default') ? 'defaultValue' : modifier[1]);
      s = s.slice(modifier[0].length).replace(/^\s+/,'');

      this.parseModifiersStop = true;
      var params = [];
      for (var colon = s.match(/^\s*:\s*/); colon; colon = s.match(/^\s*:\s*/)) {
        value += s.slice(0, colon[0].length);
        s = s.slice(colon[0].length);
        var lookUpData = this.lookUp(s, '');
        if (lookUpData.ret) {
          value += lookUpData.value;
          params.push(lookUpData.tree[0]);
          s = s.slice(lookUpData.value.length);
        } else {
          params.push(this.parseText(''));
        }
      }
      this.parseModifiersStop = false;

      // Modifiers have the highest priority.
      params.unshift(tree.pop());
      var funcData = this.parseFunc(funcName, {__parsed: params}, []);
      tree.push(funcData[0]);

      // Modifiers can be combined.
      var selfData = this.parseModifiers(s, tree);
      // If data is returned merge the current tree and tree we got.
      if (selfData) {
        tree = tree.concat(selfData.tree);
      }
      return {value: value, tree: tree};
    },

    parseParams: function(paramsStr, regexDelim, regexName) {
      var s = paramsStr.replace(/\n/g, ' ').replace(/^\s+|\s+$/g, ''),
          params = [],
          paramsStr = '';

      params.__parsed = [];

      if (!s) {
        return params;
      }

      if (!regexDelim) {
        regexDelim = /^\s+/;
        regexName = /^(\w+)\s*=\s*/;
      }

      while (s) {
        var name = null;
        if (regexName) {
          var foundName = s.match(regexName);
          if (foundName) {
            var firstChar = foundName[1].charAt(0).match(/^\d+/),
                skip = (firstChar ? true : false);
            if (foundName[1] == 'true' || foundName[1] == 'false' || foundName[1] == 'null') {
              skip = true;
            }

            if (!skip) {
              name = TrimAllQuotes(foundName[1]);
              paramsStr += s.slice(0, foundName[0].length);
              s = s.slice(foundName[0].length);
            }
          }
        }

        var param = this.parseExpression(s);
        console.log(param);
        if (!param) {
          break;
        }

        if (name) {
          params[name] = param.value;
          params.__parsed[name] = param.tree;
        } else {
          params.push(param.value);
          params.__parsed.push(param.tree);
        }

        paramsStr += s.slice(0, param.value.length);
        s = s.slice(param.value.length);

        var foundDelim = s.match(regexDelim);
        if (foundDelim) {
          paramsStr += s.slice(0,foundDelim[0].length);
          s = s.slice(foundDelim[0].length);
        } else {
            break;
        }
      }
      params.toString = function() {
        return paramsStr;
      };
      return params;
    },

    lookUp: function (s, value) {
      var tree = [];
      if (!s) {
        return false;
      }

      if (s.substr(0, this.smarty.ldelim) == this.smarty.ldelim) {
        // TODO :: Explore more where it is used.
        tag = this.findTag('', s);
        value += tag[0];
        if (tag) {
          tree.concat(this.parse(tag[0]));
          var modData = this.parseModifiers(s.slice(value.length), tree);
          return {ret: true, tree: modData.tree, value: value};
        }
      }

      var anyMatchingToken = this.getMatchingToken(s);
      if (anyMatchingToken !== false) {
        value += RegExp.lastMatch;
        var newTree = this.tokens[anyMatchingToken].parse.call(this, s.slice(RegExp.lastMatch.length), { tree: tree, token: RegExp.lastMatch });
        if ((!!newTree) && (newTree.constructor === Object)) {
          // TODO :: figure out, how we would we get this done by
          // only getting tree (no value should be needed.)
          value += newTree.value;
          newTree = newTree.tree;
        }
        tree = tree.concat(newTree);
        return {ret: true, tree: tree, value: value};
      }
      return {ret: false, tree: tree, value: value};
    },

    // Parse expression.
    parseExpression: function (s) {
      var tree = [],
          value = '',
          data,
          tag,
          treeFromToken;

      while(true) {
        data = this.lookUp(s.slice(value.length), value);
        if (data) {
          tree = tree.concat(data.tree);
          value = data.value;
          if (!data.ret) {
            break;
          }
        } else {
          break;
        }
      }
      if (!tree.length) {
        return false;
      }
      tree = this.composeExpression(tree);
      return {tree: tree, value: value};
    },

	// Parse boolean.
    parseBool: function (boolVal) {
      return [{type: 'boolean', data: boolVal}];
    },

    // Parse text.
    parseText: function (text) {
      var tree = [];
      if (this.parseEmbeddedVars) {
        var re = /([$][\w@]+)|`([^`]*)`/;
        for (var found=re.exec(text); found; found=re.exec(text)) {
          tree.push({type: 'text', data: text.slice(0,found.index)});
          var d = this.parseExpression(found[1] ? found[1] : found[2]);
          tree.push(d.tree);
          text = text.slice(found.index + found[0].length);
        }
      }
      tree.push({type: 'text', data: text});
      return tree;
    },

    // Tokens to indentify data inside template.
    tokens: [
      {
        // Token for variable.
        'regex': /^\$([\w@]+)/,
        parse: function(s, data) {
          var dataVar = this.parseVar(s, RegExp.$1);
          var dataMod = this.parseModifiers(dataVar.s, dataVar.tree);
          if (dataMod) {
            dataVar.value += dataMod.value;
            return dataMod.tree;
          }
          return dataVar.tree;
        }
      },
  	  {
  		  // Token for boolean.
  		  'regex': /^(true|false)/i,
    		parse: function(s, data) {
    		  return this.parseBool(data.token.match(/true/i) ? true : false);
    		}
  	  },
  	  {
    		// Token for to grab data inside single quotes.
    		'regex': /^'([^'\\]*(?:\\.[^'\\]*)*)'/,
    	  parse: function(s, data) {
    		  // Data inside single quote is like string, we do not parse it.
    		  var regexStr = EvalString(RegExp.$1);
    		  var dataVar = this.parseText(s, regexStr);
    		  var dataMod = this.parseModifiers(dataVar.s, dataVar.tree);
          if (dataMod) {
    		      return dataMod.tree;
          }
          return dataVar.tree;
  	    }
  	  },
      {
        // Token for to grab data inside double quotes.
        // We parse data inside double quotes.
        'regex': /^"([^"\\]*(?:\\.[^"\\]*)*)"/,
        parse: function(s, data) {
          var v = EvalString(RegExp.$1);
          var isVar = v.match(this.tokens[0]['regex']);
          if (isVar) {
            var newData = this.parseVar(v, isVar[1]);
            if ((isVar[0] + newData.token).length == v.length) {
              return [newData.tree[0]];
            }
          }
          this.parseEmbeddedVars = true;
          var tree = [];
          tree.push({
            type: 'plugin',
            name: '__quoted',
            params: {__parsed: this.parse(v, [])}
          });
          this.parseEmbeddedVars = false;
          var modData = this.parseModifiers(s, tree);
          return modData.tree;
        }
      },
      {
        // Token for increment operator.
        'regex': /^\s*(\+\+|--)\s*/,
        parse: function(s, data) {
          if (data.tree.length && data.tree[data.tree.length-1].type == 'var') {
            return this.parseOperator(RegExp.$1, 'post-unary', 1);
          } else {
            return this.parseOperator(RegExp.$1, 'pre-unary', 1);
          }
        }
      },
      {
        // Regex for strict equal, strict not equal, equal and not equal operator.
        'regex': /^\s*(===|!==|==|!=)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1, 'binary', 6);
        }
      },
      {
        // Regex for equal, not equal operator.
        'regex': /^\s+(eq|ne|neq)\s+/i,
        parse: function(s, data) {
          var op = RegExp.$1.replace(/ne(q)?/,'!=').replace(/eq/,'==');
          return this.parseOperator(op, 'binary', 6);
        }
      },
      {
        // Regex for NOT operator.
        'regex': /^\s*!\s*/,
        parse: function(s, data) {
          return this.parseOperator('!', 'pre-unary', 2);
        }
      },
      {
        // Regex for NOT operator.
        'regex': /^\s+not\s+/i,
        parse: function(s, data) {
          return this.parseOperator('!', 'pre-unary', 2);
        }
      },
      {
        // Regex for =, +=, *=, /=, %= operator.
        'regex': /^\s*(=|\+=|-=|\*=|\/=|%=)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1, 'binary', 10);
        }
      },
      {
        // Regex for *, /, % binary operator.
        'regex': /^\s*(\*|\/|%)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1, 'binary', 3);
        }
      },
      {
        // Regex for mod operator.
        'regex': /^\s+mod\s+/i,
        parse: function(s, data) {
          return this.parseOperator('%', 'binary', 3);
        }
      },
      {
        // Regex for +/- operator.
        'regex': /^\s*(\+|-)\s*/,
        parse: function(s, data) {
          if (!data.tree.length || data.tree[data.tree.length-1].name == 'operator') {
            return this.parseOperator(RegExp.$1, 'pre-unary', 4);
          } else {
            return this.parseOperator(RegExp.$1, 'binary', 4);
          }
        }
      },
      {
        // Regex for less than, greater than, less than equal, reather than equal.
        'regex': /^\s*(<=|>=|<>|<|>)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1.replace(/<>/,'!='), 'binary', 5);
        }
      },
      {
        // Regex for less than, greater than, less than equal, reather than equal.
        'regex': /^\s+(lt|lte|le|gt|gte|ge)\s+/i,
        parse: function(s, data) {
          var op = RegExp.$1.replace(/l(t)?e/,'<').replace(/lt/,'<=').replace(/g(t)?e/,'>').replace(/gt/,'>=');
          return this.parseOperator(op, 'binary', 5);
        }
      },
      {
        // Regex for short hand "is (not) div by".
        'regex': /^\s+(is\s+(not\s+)?div\s+by)\s+/i,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$2?'div_not':'div', 'binary', 7);
        }
      },
      {
        // Regex for short hand "is (not) even/odd by".
        'regex': /^\s+is\s+(not\s+)?(even|odd)(\s+by\s+)?\s*/i,
        parse: function(s, data) {
          var op = RegExp.$1 ? ((RegExp.$2=='odd')?'even':'even_not') : ((RegExp.$2=='odd')?'even_not':'even');
          var tree = this.parseOperator(op, 'binary', 7);
          if (!RegExp.$3) {
            return tree.concat(this.parseText('1', e.tree));
          }
          return tree;
        }
      },
      {
        // Regex for AND operator.
        'regex': /^\s*(&&)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1, 'binary', 8);
        }
      },
      {
        // Regex for OR operator.
        'regex': /^\s*(\|\|)\s*/,
        parse: function(s, data) {
          return this.parseOperator(RegExp.$1, 'binary', 9);
        }
      },
      {
        // Regex for AND operator.
        'regex': /^\s+and\s+/i,
        parse: function(s, data) {
          return this.parseOperator('&&', 'binary', 11);
        }
      },
      {
        // Regex for XOR operator.
        'regex': /^\s+xor\s+/i,
        parse: function(s, data) {
          return this.parseOperator('xor', 'binary', 12);
        }
      },
      {
        // Regex for OR operator.
        'regex': /^\s+or\s+/i,
        parse: function(s, data) {
          return this.parseOperator('||', 'binary', 13);
        }
      },
      {
        // Regex for config variable.
        'regex': /^#(\w+)#/,
        parse: function(s, data) {
          // TODO yet to be worked on.
          var eVar = {token:'$smarty', tree:[]};
          parseVar('.config.'+RegExp.$1, eVar, 'smarty');
          e.tree.push( eVar.tree[0] );
          parseModifiers(s, e);
        }
      },
      {
        // Regex for array.
        'regex': /^\s*\[\s*/,
        parse: function(s, data) {
          var params = this.parseParams(s, /^\s*,\s*/, /^('[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"|\w+)\s*=>\s*/);
          var tree = this.parsePluginFunc('__array', params);
          var value = params.toString();
          var paren = s.slice(params.toString().length).match(/\s*\]/);
          if (paren) {
            value += paren[0];
          }
          return {tree: tree, value: value};
        }
      },
      {
        // Regex for number.
        'regex': /^[\d.]+/,
        parse: function(s, data) {
          if (data.token.indexOf('.') > -1) {
              data.token = parseFloat(data.token);
          } else {
              data.token = parseInt(data.token, 10);
          }
          var textTree = this.parseText(data.token);
          var dataMod = this.parseModifiers(s, textTree);
          if (dataMod) {
            return dataMod.tree;
          }
          return textTree;
        }
      },
      {
        // Regex for static.
        'regex': /^\w+/,
        parse: function(s, data) {
          var textTree = this.parseText(data.token);
          var dataMod = this.parseModifiers(s, textTree);
          if (dataMod) {
            return dataMod.tree;
          }
          return textTree;
        }
      }
    ],
    buildInFunctions: {
      expression: {
        parse: function(s) {
          var data = this.parseExpression(s);
          return {
            type: 'build-in',
            name: 'expression',
            // Expression expanded inside this sub tree.
            expression: data.tree,
            params: this.parseParams(s.slice(data.value.length).replace(/^\s+|\s+$/g,'')),
          };
        }
      },
      section: {
        type: 'block',
        parse: function(params, content) {
          var subTree = [];
          var subTreeElse = [];

          var findElse = this.findElseTag('section [^}]+', '\/section', 'sectionelse', content);
          if (findElse) {
            subTree = this.parse(content.slice(0, findElse.index));
            subTreeElse = this.parse(content.slice(findElse.index+findElse[0].length).replace(/^[\r\n]/,''));
          } else {
            subTree = this.parse(content);
          }
          return {
            type: 'build-in',
            name: 'section',
            params: params,
            subTree: subTree,
            subTreeElse: subTreeElse
          };
        },
        'if': {
          type: 'block',
          parse: function(params, content) {
            var subTreeIf = [],
                subTreeElse = [];

            var findElse = this.findElseTag('if\\s+[^}]+', '\/if', 'else[^}]*', content);
            if (findElse) {
              subTreeIf = this.parse(content.slice(0, findElse.index));
              content = content.slice(findElse.index+findElse[0].length);
              var findElseIf = findElse[1].match(/^else\s*if(.*)/);
              if (findElseIf) {
                subTreeElse = this.buildInFunctions['if'].parse(this.parseParams(findElseIf[1]), content.replace(/^\n/,''));
              } else {
                subTreeElse = this.parse(content.replace(/^\n/,''));
              }
            } else {
              subTreeIf = this.parse(content);
            }
            return [{
              type: 'build-in',
              name: 'if',
              params: params,
              subTreeIf: subTreeIf,
              subTreeElse: subTreeElse
            }];
          }
        }
      }
    }
  };
// Find in array.
  function FindInArray(arr, val) {
    if (Array.prototype.indexOf) {
      return arr.indexOf(val);
    }
    for (var i = 0; i < arr.length; ++i) {
      if (arr[i] === val) {
        return i;
      }
    }
    return -1;
  }
/**
   * Returns boolean true if object is empty otherwise false.
   *
   * @param object hash Object you are testing against.
   *
   * @return boolean
   */
  function IsEmptyObject(hash) {
    for (var i in hash) {
      if (hash.hasOwnProperty(i)) {
        return false;
      }
    }
    return true;
  }
function CountProperties(ob) {
    var count = 0;
    for (var name in ob) {
      if (ob.hasOwnProperty(name)) {
        count++;
      }
    }
    return count;
  }
// Processor object. Plain object which just does processing.
  var jSmartProcessor = {

    // jSmart object used for current processing.
    jSmart: {},

    // Object which is copy of jSmart.smarty for local modification.
    smarty: {},

    // Process the tree and return the data.
    getProcessed: function (tree, data, that) {
      // Copy the jSmart object, so we could use it while processing.
      this.jSmart = that;
      // Create a copy of smarty object, as we modify that data and
      // we want to keep a copy rather than modifying original jSmart object.
      ObjectMerge(this.smarty, that.smarty);

      // Process the tree and get the output.
      var output = this.process(tree, data),
          smarty = this.smarty;
      // Empty parser objects. Clean up.
      // We do not want old data held up here.
      this.jSmart = {};
      this.smarty = {};
      return {
        output: output,
        smarty: smarty
      };
    },

    // Process the tree and apply data.
    process: function (tree, data) {
      var res = '',
          i,
          s,
          node;

      for (i = 0; i < tree.length; ++i) {
        s = '';
        node = tree[i];
        if (node.type == 'text') {
          s = node.data;
		    } else if (node.type == 'var') {
          s = this.getVarValue(node, data);
		    } else if (node.type == 'boolean') {
          s = node.data ? '1' : '';
        } else if (node.type == 'build-in') {
          s = this.buildInFunctions[node.name].process.call(this, node, data);
        } else if (node.type == 'plugin') {
          var plugin = this.plugins[node.name];
          if (plugin.type == 'block') {

          } else if (plugin.type == 'function') {
            s = plugin.process(this.getActualParamValues(node.params, data), data);
          }
        }
        if (typeof s == 'boolean') {
            s = s ? '1' : '';
        }
        if (s == null) {
            s = '';
        }
        if (tree.length == 1) {
            return s;
        }
        res += ((s!==null) ? s : '');
      }
      return res;
    },

    getActualParamValues: function (params, data) {
      var actualParams = [];
      for (var name in params.__parsed) {
        if (params.__parsed.hasOwnProperty(name)) {
          var v = this.process([params.__parsed[name]], data);
          actualParams[name] = v;
        }
      }
      actualParams.__get = function(name, defVal, id) {
        if (name in actualParams && typeof(actualParams[name]) != 'undefined') {
          return actualParams[name];
        }
        if (typeof(id)!='undefined' && typeof(actualParams[id]) != 'undefined') {
          return actualParams[id];
        }
        if (defVal === null) {
          throw new Error("The required attribute '"+name+"' is missing");
        }
        return defVal;
      };
      return actualParams;
    },

    getVarValue: function (node, data, value) {
      var v = data,
          name = '',
          i,
          part;

      for (i = 0; i < node.parts.length; ++i) {
        part = node.parts[i];
        if (part.type == 'plugin' && part.name == '__func' && part.hasOwner) {
            data.__owner = v;
            v = this.process([node.parts[i]], data);
            delete data.__owner;
        } else {
          name = this.process([part], data);

          // Section Name
          if (name in this.smarty.section && part.type=='text' && (this.process([node.parts[0]], data) != 'smarty')) {
            name = this.smarty.section[name].index;
          }

          // Add to array
          if (!name && typeof val != 'undefined' && v instanceof Array) {
            name = v.length;
          }

          // Set new value.
          if (value != undefined && i == (node.parts.length - 1)) {
              v[name] = value;
          }

          if (typeof v == 'object' && v !== null && name in v) {
              v = v[name];
          } else {
            if (value == undefined) {
              return value;
            }
            v[name] = {};
            v = v[name];
          }
        }
      }
      return v;
    },

    // TODO:: Remove this duplicate function.
    // Apply the filters to template.
    applyFilters: function(filters, tpl) {
      for (var i=0; i<filters.length; ++i) {
        tpl = filters[i](tpl);
      }
      return tpl;
    },

    buildInFunctions: {
      expression: {
        process: function(node, data) {
          var params = this.getActualParamValues(node.params, data),
              res = this.process([node.expression], data);

          if (FindInArray(params, 'nofilter') < 0) {
            for (var i=0; i < this.jSmart.defaultModifiers.length; ++i) {
              var m = this.jSmart.defaultModifiers[i];
              m.params.__parsed[0] = {type: 'text', data: res};
              res = this.process([m],data);
            }
            if (this.jSmart.escapeHtml) {
              res = modifiers.escape(res);
            }
            res = this.applyFilters(this.jSmart.globalAndDefaultFilters, res);
          }
          return res;
        }
      },

      operator: {
  		  process: function(node, data) {
          var params = this.getActualParamValues(node.params, data);
    		  var arg1 = params[0];

    		  if (node.optype == 'binary') {
    			  var arg2 = params[1];
      			if (node.op == '=') {
              // TODO:: why do not we return the var value?
      				this.getVarValue(node.params.__parsed[0], data, arg2);
              return '';
      			} else if (node.op.match(/(\+=|-=|\*=|\/=|%=)/)) {
      				arg1 = getVarValue(node.params.__parsed[0], data);
      				switch (node.op) {
      				  case '+=': {
                  arg1+=arg2;
                  break;
                }
      				  case '-=':
                  arg1-=arg2;
                  break;

                case '*=':
                  arg1*=arg2;
                  break;

                case '/=':
                  arg1/=arg2;
                  break;
                case '%=':
                  arg1%=arg2;
                  break;
              }
              return this.getVarValue(node.params.__parsed[0], data, arg1);
            } else if (node.op.match(/div/)) {
              return (node.op != 'div')^(arg1%arg2==0);
            } else if (node.op.match(/even/)) {
              return (node.op != 'even')^((arg1/arg2)%2==0);
            } else if (node.op.match(/xor/)) {
              return (arg1 || arg2) && !(arg1 && arg2);
            }

            switch (node.op) {
              case '==': return arg1==arg2;
              case '!=': return arg1!=arg2;
              case '+':  return Number(arg1)+Number(arg2);
              case '-':  return Number(arg1)-Number(arg2);
              case '*':  return Number(arg1)*Number(arg2);
              case '/':  return Number(arg1)/Number(arg2);
              case '%':  return Number(arg1)%Number(arg2);
              case '&&': return arg1&&arg2;
              case '||': return arg1||arg2;
              case '<':  return arg1<arg2;
              case '<=': return arg1<=arg2;
              case '>':  return arg1>arg2;
              case '>=': return arg1>=arg2;
              case '===': return arg1===arg2;
              case '!==': return arg1!==arg2;
            }
          } else if (node.op == '!') {
            return !arg1;
          } else {
            var isVar = node.params.__parsed[0].type == 'var';
            if (isVar) {
              arg1 = this.getVarValue(node.params.__parsed[0], data);
            }
            var v = arg1;
            if (node.optype == 'pre-unary') {
              switch (node.op) {
                case '-':  v=-arg1;  break;
                case '++': v=++arg1; break;
                case '--': v=--arg1; break;
              }
              if (isVar) {
                this.getVarValue(node.params.__parsed[0], data, arg1);
              }
            } else {
              switch (node.op) {
                case '++': arg1++; break;
                case '--': arg1--; break;
              }
              this.getVarValue(node.params.__parsed[0], data, arg1);
            }
            return v;
          }
        }
      },

      section: {
        process: function(node, data) {
          var params = this.getActualParamValues(node.params, data);

          var props = {};
          this.smarty.section[params.__get('name', null, 0)] = props;

          var show = params.__get('show', true);
          props.show = show;
          if (!show) {
            return this.process(node.subTreeElse, data);
          }

          var from = parseInt(params.__get('start', 0));
          var to = (params.loop instanceof Object) ? CountProperties(params.loop) : isNaN(params.loop) ? 0 : parseInt(params.loop);
          var step = parseInt(params.__get('step', 1));
          var max = parseInt(params.__get('max'));
          if (isNaN(max)) {
            max = Number.MAX_VALUE;
          }

          if (from < 0) {
            from += to;
            if (from < 0) {
              from = 0;
            }
          } else if (from >= to) {
            from = to ? to-1 : 0;
          }

          var count = 0;
          var loop = 0;
          var i = from;
          for (; ((i >= 0) && (i < to) && (count < max)); i+=step, ++count) {
            loop = i;
          }
          props.total = count;
          props.loop = count;  //? - because it is so in Smarty

          count = 0;
          var s = '';
          for (i=from; i>=0 && i<to && count<max; i+=step,++count) {
            if (this.smarty['break']) {
              break;
            }

            props.first = (i==from);
            props.last = ((i+step)<0 || (i+step)>=to);
            props.index = i;
            props.index_prev = i-step;
            props.index_next = i+step;
            props.iteration = props.rownum = count+1;

            s += this.process(node.subTree, data);
            this.smarty['continue'] = false;
          }
          this.smarty['break'] = false;

          if (count) {
            return s;
          }
          return this.process(node.subTreeElse, data);
        }
      },

      'if': {
        process: function(node, data) {
          var value = this.getActualParamValues(node.params, data)[0];
          // Zero length arrays or empty associative arrays are false in PHP.
          if (value && !((value instanceof Array && value.length == 0)
            || (typeof value == 'object' && IsEmptyObject(value)))
          ) {
            return this.process(node.subTreeIf, data);
          } else {
            return this.process(node.subTreeElse, data);
          }
        }
      }
    }
  };
var
      version = '2.15.1',

      /*
       Define jsmart constructor. jSmart object just stores,
       tree, $smarty block and some intialization methods.
       We keep jSmart object light weight as one page or program
       might contain to many jSmart objects.
       Keep parser and processor outside of jSmart objects, help
       us not to store, same parser and processor methods in all
       jSmart object.
      */
      jSmart = function (template, options) {
        this.parse(template, options);
      };

  // Add more properties to jSmart core.
  jSmart.prototype = {

    constructor: jSmart,

    // Current tree structure.
    tree: [],

    // Current javascript files loaded via include_javascript.
    scripts: {},

    // List of all modifiers present in the app.
    modifiers: [],

    // All the modifiers to apply by default to all variables.
    defaultModifiers: [],

    // Global modifiers which which can be used in all instances.
    defaultModifiersGlobal: [],

    // Cache for global and default modifiers merged version to apply.
    globalAndDefaultModifiers: [],

    // Filters which are applied to all variables are in 'variable'.
    // Filters which are applied after processing whole template are in 'post'.
    filters: {
      'variable': [],
      'post': []
    },

    // Global filters. pre, post and variable. All of them.
    filtersGlobal: {
      'pre': [],
      'variable': [],
      'post': []
    },

    // Cached value for all default and global variable filters.
    // Only for variable.
    globalAndDefaultFilters: [],

    // Build in functions of the smarty.
    buildInFunctions: {},

    // Plugins of the functions.
    plugins: {},

    // Whether to skip tags in open brace { followed by white space(s) and close brace } with white space(s) before.
    autoLiteral: true,

    // Escape html??
    escapeHtml: false,

    // Currently disabled, will decide in future, what TODO.
    debugging: false,

    // Smarty object which has version, delimiters, config, current directory
    // and all blocks like PHP Smarty.
    smarty: {

      // Blocks in the current smarty object.
      block: {},

      // TODO:: Yet to figure out, what it is.
      'break': false,

      // All the capture blocks in the current smarty object.
      capture: {},

      // TODO:: Yet to figure out, what it is.
      'continue': false,

      // Current counter information. Smarty like feature.
      counter: {},

      // TODO:: Yet to figure out, what it is.
      cycle: {},

      // All the foreach blocks in the current smarty object.
      'foreach': {},

      // All the section blocks in the current smarty object.
      section: {},

      // Current timestamp, when the object is created.
      now: Math.floor(((new Date()).getTime() / 1000)),

      // All the constants defined the current smarty object.
      'const': {},

      // Current configuration.
      config: {},

      // Current directory, underscored name as PHP Smarty does it.
      current_dir: '/',

      // Currrent template.
      template: '',

      // Left delimiter.
      ldelim: '{',

      // Right delimiter.
      rdelim: '}',

      // Current version of jSmart.
      version: version
    },

    // Initialize, jSmart, set settings and parse the template.
    parse: function (template, options) {
      var parsedTemplate;

      if (!options) {
        options = {};
      }
      if (options.rdelim) {
        // If delimiters are passed locally take them.
        this.smarty.rdelim = options.rdelim;
      } else if (jSmart.prototype.right_delimiter) {
        // If no delimiters are passed locally, take global if present.
        this.smarty.rdelim = jSmart.prototype.right_delimiter;
      }
      if (options.ldelim) {
        // If delimiters are passed locally take them.
        this.smarty.ldelim = options.ldelim;
      } else if (jSmart.prototype.left_delimiter) {
        // If no delimiters are passed locally, take global if present.
        this.smarty.ldelim = jSmart.prototype.left_delimiter;
      }
      if (options.autoLiteral !== undefined) {
        // If autoLiteral is passed locally, take it.
        this.autoLiteral = options.autoLiteral;
      } else if (jSmart.prototype.auto_literal !== undefined) {
        // If no autoLiteral is passed locally, take global if present.
        this.autoLiteral = jSmart.prototype.auto_literal;
      }

      if (options.debugging !== undefined) {
        // If debugging is passed locally, take it.
        this.debugging = options.debugging;
      } else if (jSmart.prototype.debugging !== undefined) {
        // If no debugging is passed locally, take global if present.
        this.debugging = jSmart.prototype.debugging;
      }

      // Is template string or at least defined?!
      template = new String(template ? template : '');
      // Remove comments, we never want them.
      template = this.removeComments(template);
      // Make use of linux new comments. It will be consistent across all templates.
      template = template.replace(/\r\n/g,'\n');
      // Apply global pre filters to the template. These are global filters,
      // so we take it from global object, rather than taking it as args to
      // "new jSmart()" object.
      template = this.applyFilters(jSmart.prototype.filtersGlobal.pre, template);

      // Generate the tree. We pass "this", so Parser can read jSmart.*
      // config values. Please note that, jSmart.* are not supposed to be
      // modified in parsers. We get them here and then update jSmart object.

      this.tree = jSmartParser.getParsed(template, this);
    },

    // Process the generated tree.
    fetch: function (data) {
      var outputData = '';
      if (!(typeof data == 'object')) {
        data = {};
      }
      // Define smarty inside data and copy smarty vars, so one can use $smarty
      // vars inside templates.
      data.smarty = {};
      ObjectMerge(data.smarty, this.smarty);

      // Take default global modifiers, add with local default modifiers.
      // Merge them and keep them cached.
      this.globalAndDefaultModifiers = jSmart.prototype.defaultModifiersGlobal.concat(this.defaultModifiers);


      // Take default global filters, add with local default filters.
      // Merge them and keep them cached.
      this.globalAndDefaultFilters = jSmart.prototype.filtersGlobal.variable.concat(this.filters.variable);

      // Capture the output by processing the template.
      outputData = jSmartProcessor.getProcessed(this.tree, data, this);

      // Merge back smarty data returned by process to original object.
      ObjectMerge(this.smarty, outputData.smarty);
      // Apply post filters to output and return the template data.
      return this.applyFilters(jSmart.prototype.filtersGlobal.post.concat(this.filters.post), outputData.output);
    },

    // Apply the filters to template.
    applyFilters: function(filters, tpl) {
      for (var i=0; i<filters.length; ++i) {
        tpl = filters[i](tpl);
      }
      return tpl;
    },

    // Remove comments. We do not want to parse them anyway.
    removeComments: function (tpl) {
      var ldelim = new RegExp(this.smarty.ldelim+'\\*'),
          rdelim = new RegExp('\\*'+this.smarty.rdelim),
          newTpl = '';

      for (var openTag=tpl.match(ldelim); openTag; openTag=tpl.match(rdelim)) {
        newTpl += tpl.slice(0,openTag.index);
        s = tpl.slice(openTag.index+openTag[0].length);
        var closeTag = tpl.match(rDelim);
        if (!closeTag)
        {
          throw new Error('Unclosed '+this.smarty.ldelim+'*');
        }
        tpl = tpl.slice(closeTag.index+closeTag[0].length);
      }
      return newTpl + tpl;
    },

    // Register a plugin.
    registerPlugin: function (type, name, callback) {
      if (type == 'modifier') {
        this.modifiers[name] = callback;
      } else {
        this.plugins[name] = {'type': type, 'process': callback};
      }
    },

    // Register a filter.
    registerFilter: function(type, callback) {
        (this.tree ? this.filters : jSmart.prototype.filtersGlobal)[((type == 'output') ? 'post' : type)].push(callback);
    },

    add: function(thingsToAdd) {
      for (var i in thingsToAdd) {
        if (thingsToAdd.hasOwnProperty(i)) {
          jSmart.prototype[i] = thingsToAdd[i];
        }
      }
    },

    addDefaultModifier: function(modifiers) {
      if (!(modifiers instanceof Array)) {
        modifiers = [modifiers];
      }

      for (var i=0; i<modifiers.length; ++i) {
        var data = jSmartParser.parseModifiers('|'+modifiers[i], [0]);
        (this.tree ? this.defaultModifiers : this.defaultModifiersGlobal).push(data.tree[0]);
      }
    }
  };
jSmart.prototype.registerPlugin(
    'modifier',
    'upper',
    function(s) {
      return (new String(s)).toUpperCase();
    }
  );
/**
   * Execute function when we have a object.
   *
   * @param object obj  Object of the function to be called.
   * @param array  args Arguments to pass to a function.
   *
   * @return
   * @throws Error If function obj does not exists.
   */
  function ExecuteByFuncObject(obj, args) {
    try {
      return obj.apply(this, args);
    } catch (e) {
      throw new Error(e.message);
    }
  }
jSmart.prototype.registerPlugin(
    'function',
    '__quoted',
    function(params, data) {
      return params.join('');
    }
  );

  // Register __array which gets called for all arrays.
  jSmart.prototype.registerPlugin(
    'function',
    '__array',
    function(params, data) {
      var a = [];
      for (var name in params) {
        if (params.hasOwnProperty(name) && params[name] && typeof params[name] != 'function') {
          a[name] = params[name];
        }
      }
      return a;
    }
  );

  // Register __func which gets called for all modifiers and function calls.
  jSmart.prototype.registerPlugin(
    'function',
    '__func',
    function(params, data) {
      var paramNames = [],
          paramValues = {},
          paramData = [],
          i,
          fname,
          mergedParams;

      for (i = 0; i < params.length; ++i) {
        paramNames.push((params.name + '__p'+i));
        paramData.push(params[i]);
        paramValues[(params.name + '__p' + i)] = params[i];
      }

      mergedParams = ObjectMerge({}, data, paramValues);
      if (('__owner' in data && params.name in data.__owner)) {
        fname = '__owner.'+params.name;
        return execute(fname + '(' + paramNames.join(',') + ')', mergedParams);
      } else if (jSmart.prototype.modifiers.hasOwnProperty(params.name)) {
        fname = jSmart.prototype.modifiers[params.name]
        return ExecuteByFuncObject(fname, paramData, mergedParams);
      } else {
        fname = params.name;
        return execute(fname + '(' + paramNames.join(',') + ')', mergedParams);
      }
    }
  );


 // build.js inserts compiled jQuery here

  return jSmart;
});