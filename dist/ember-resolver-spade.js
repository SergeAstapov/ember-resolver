// ==========================================================================
// Project:   Ember - JavaScript Application Framework
// Copyright: Copyright 2013 Stefan Penner and Ember App Kit Contributors
// License:   Licensed under MIT license
//            See https://raw.github.com/stefanpenner/ember-jj-abrams-resolver/master/LICENSE
// ==========================================================================


 // Version: 0.0.1

minispade.register('ember-resolver/core', "(function() {/*globals define registry requirejs */\n\ndefine(\"resolver\",\n  [],\n  function() {\n    \"use strict\";\n  /*\n   * This module defines a subclass of Ember.DefaultResolver that adds two\n   * important features:\n   *\n   *  1) The resolver makes the container aware of es6 modules via the AMD\n   *     output. The loader's _seen is consulted so that classes can be\n   *     resolved directly via the module loader, without needing a manual\n   *     `import`.\n   *  2) is able provide injections to classes that implement `extend`\n   *     (as is typical with Ember).\n   */\n\n  function classFactory(klass) {\n    return {\n      create: function (injections) {\n        if (typeof klass.extend === 'function') {\n          return klass.extend(injections);\n        } else {\n          return klass;\n        }\n      }\n    };\n  }\n\n  var underscore = Ember.String.underscore;\n  var classify = Ember.String.classify;\n  var get = Ember.get;\n\n  function parseName(fullName) {\n    /*jshint validthis:true */\n\n    var nameParts = fullName.split(\":\"),\n        type = nameParts[0], fullNameWithoutType = nameParts[1],\n        name = fullNameWithoutType,\n        namespace = get(this, 'namespace'),\n        root = namespace;\n\n    return {\n      fullName: fullName,\n      type: type,\n      fullNameWithoutType: fullNameWithoutType,\n      name: name,\n      root: root,\n      resolveMethodName: \"resolve\" + classify(type)\n    };\n  }\n\n  function chooseModuleName(seen, moduleName) {\n    var underscoredModuleName = Ember.String.underscore(moduleName);\n\n    if (moduleName !== underscoredModuleName && seen[moduleName] && seen[underscoredModuleName]) {\n      throw new TypeError(\"Ambiguous module names: `\" + moduleName + \"` and `\" + underscoredModuleName + \"`\");\n    }\n\n    if (seen[moduleName]) {\n      return moduleName;\n    } else if (seen[underscoredModuleName]) {\n      return underscoredModuleName;\n    } else {\n      return moduleName;\n    }\n  }\n\n  function logLookup(found, parsedName, moduleName) {\n    if (Ember.ENV.LOG_MODULE_RESOLVER) {\n      var symbol;\n\n      if (found) { symbol = '[✓]'; }\n      else       { symbol = '[ ]'; }\n\n      Ember.Logger.info(symbol, parsedName.fullName, new Array(40 - parsedName.fullName.length).join('.'), moduleName);\n    }\n  }\n\n  function resolveOther(parsedName) {\n    /*jshint validthis:true */\n\n    var moduleName, tmpModuleName, prefix, podPrefix, moduleRegistry;\n\n    prefix = this.namespace.modulePrefix;\n    podPrefix = this.namespace.podModulePrefix || prefix;\n    moduleRegistry = requirejs._eak_seen;\n\n    Ember.assert('module prefix must be defined', prefix);\n\n    var pluralizedType = parsedName.type + 's';\n    var name = parsedName.fullNameWithoutType;\n\n    // lookup using POD formatting first\n    tmpModuleName = podPrefix + '/' + name + '/' + parsedName.type;\n    if (moduleRegistry[tmpModuleName]) {\n      moduleName = tmpModuleName;\n    }\n\n    // if not using POD format, use the custom prefix\n    if (this.namespace[parsedName.type + 'Prefix']) {\n      prefix = this.namespace[parsedName.type + 'Prefix'];\n    }\n\n    // if router:main or adapter:main look for a module with just the type first\n    tmpModuleName = prefix + '/' + parsedName.type;\n    if (!moduleName && name === 'main' && moduleRegistry[tmpModuleName]) {\n      moduleName = prefix + '/' + parsedName.type;\n    }\n\n    // fallback if not type:main or POD format\n    if (!moduleName) { moduleName = prefix + '/' +  pluralizedType + '/' + name; }\n\n    // allow treat all dashed and all underscored as the same thing\n    // supports components with dashes and other stuff with underscores.\n    var normalizedModuleName = chooseModuleName(moduleRegistry, moduleName);\n\n    if (moduleRegistry[normalizedModuleName]) {\n      var module = require(normalizedModuleName, null, null, true /* force sync */);\n\n      if (module && module['default']) { module = module['default']; }\n\n      if (module === undefined) {\n        throw new Error(\" Expected to find: '\" + parsedName.fullName + \"' within '\" + normalizedModuleName + \"' but got 'undefined'. Did you forget to `export default` within '\" + normalizedModuleName + \"'?\");\n      }\n\n      if (this.shouldWrapInClassFactory(module, parsedName)) {\n        module = classFactory(module);\n      }\n\n      logLookup(true, parsedName, moduleName);\n\n      return module;\n    } else {\n      logLookup(false, parsedName, moduleName);\n\n      return this._super(parsedName);\n    }\n  }\n  // Ember.DefaultResolver docs:\n  //   https://github.com/emberjs/ember.js/blob/master/packages/ember-application/lib/system/resolver.js\n  var Resolver = Ember.DefaultResolver.extend({\n    resolveTemplate: resolveOther,\n    resolveOther: resolveOther,\n    makeToString: function(factory, fullName) {\n      return '' + this.namespace.modulePrefix + '@' + fullName + ':';\n    },\n    parseName: parseName,\n    shouldWrapInClassFactory: function(module, parsedName){\n      return false;\n    },\n    normalize: function(fullName) {\n      // replace `.` with `/` in order to make nested controllers work in the following cases\n      // 1. `needs: ['posts/post']`\n      // 2. `{{render \"posts/post\"}}`\n      // 3. `this.render('posts/post')` from Route\n      var split = fullName.split(':');\n      if (split.length > 1) {\n        var undotted = split[1].replace(/\\./g, '/');\n        var normalized = Ember.String.dasherize(undotted);\n        if(Ember.String.decamelize(undotted) !== undotted) {\n          //assert if camel case is used in the needs array\n          var error = 'Nested controllers need be referenced as ['+ Ember.String.decamelize(split[1]).replace(/\\_/g, '/') +\n          '], instead of ['+split[1]+']. Refer documentation: http://iamstef.net/ember-app-kit/guides/naming-conventions.html';\n          Ember.assert(error);\n        }\n        return split[0] + ':' + normalized;\n      } else {\n        return fullName;\n      }\n    }\n  });\n\n  Resolver['default'] = Resolver;\n  return Resolver;\n});\n\n})();\n//@ sourceURL=ember-resolver/core");minispade.register('ember-resolver', "(function() {minispade.require('ember-resolver/core');\n\n})();\n//@ sourceURL=ember-resolver");