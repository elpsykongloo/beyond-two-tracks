/* Minimal runtime for the Beyond Two Tracks demo page.
   Renders <template> markup with {{holes}}, <sc-for>, <sc-if>, design-system
   imports and nested components, and patches the DOM in place on state change. */
(function () {
  'use strict';

  var defs = {};
  var insts = {};
  var nextId = 1;
  var HOLE = /\{\{\s*([\w$.]+)\s*\}\}/g;
  var EXACT = /^\{\{\s*([\w$.]+)\s*\}\}$/;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  window.DCLogic = function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  };
  window.DCLogic.prototype.setState = function (patch) {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state, this.props) : patch);
    if (this.__dc) this.__dc.schedule();
  };

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.'), v = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) v = v == null ? undefined : v[parts[i]];
    return v;
  }

  function raw(value, scope) {
    var m = EXACT.exec(value);
    return m ? lookup(scope, m[1]) : interp(value, scope);
  }

  function interp(value, scope) {
    return value.replace(HOLE, function (_, p) {
      var v = lookup(scope, p);
      return v == null ? '' : String(v);
    });
  }

  /* ---- design-system pieces ---- */
  function el(tag, style, attrs) {
    var e = document.createElement(tag);
    if (style) e.setAttribute('style', style);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  var SCRIMS = {
    soft: 'linear-gradient(180deg,rgba(0,0,0,.10) 0%,rgba(0,0,0,.55) 70%)',
    deep: 'linear-gradient(180deg,rgba(21,21,21,.45) 0%,rgba(21,21,21,.92) 100%)',
    bottom: 'linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.75) 100%)'
  };

  var DS = {
    Backdrop: function (p) {
      var out = [el('div', 'position:absolute;inset:0;background-image:url(' + p.src + ');background-size:cover;background-position:center;pointer-events:none')];
      if (p.scrim) out.push(el('div', 'position:absolute;inset:0;background:' + (SCRIMS[p.scrim] || p.scrim) + ';pointer-events:none'));
      return out;
    },
    Wordmark: function (p) {
      var s = el('span', 'display:inline-flex;align-items:center');
      var t = el('span', 'font-family:var(--font-display);font-weight:700;font-size:' + (p.size || 22) + 'px;line-height:1;letter-spacing:-.02em;color:#F7F7F7');
      t.textContent = 'lulula';
      s.appendChild(t);
      return [s];
    },
    PlayButton: function (p, reg) {
      var size = +p.size || 44, playing = !!p.playing;
      var b = el('button', 'width:' + size + 'px;height:' + size + 'px;border:0;padding:0;cursor:pointer;border-radius:50%;background:#FF0132;box-shadow:' +
        (playing ? '0 4px 4px rgba(0,0,0,.25),0 0 24px rgba(255,1,50,.55)' : '0 4px 4px rgba(0,0,0,.25),0 0 18px rgba(255,1,50,.35)') +
        ';display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto', {
        type: 'button', 'class': 'dc-play', 'aria-label': p['aria-label'] || (playing ? 'Pause' : 'Play')
      });
      if (typeof p['on-click'] === 'function') b.setAttribute('data-dc-h-click', reg(p['on-click']));
      var k = (playing ? 0.36 : 0.38) * size;
      b.innerHTML = playing
        ? '<svg width="' + k + '" height="' + k + '" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>'
        : '<svg width="' + k + '" height="' + k + '" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"></path></svg>';
      return [b];
    }
  };

  /* ---- component instances ---- */
  function Inst(name, props) {
    var def = defs[name];
    this.id = 'c' + (nextId++);
    this.def = def;
    this.comp = new def.Cls(props || {});
    this.comp.__dc = this;
    this.root = null;
    this.children = [];
    this.handlers = {};
    this.pending = false;
    this.mounted = false;
    insts[this.id] = this;
  }

  Inst.prototype.schedule = function () {
    if (this.pending) return;
    this.pending = true;
    var self = this;
    Promise.resolve().then(function () { self.pending = false; self.render(); });
  };

  Inst.prototype.reg = function (fn) {
    var key = this.id + ':' + (this.hid++);
    this.handlers[key] = fn;
    return key;
  };

  Inst.prototype.render = function () {
    if (!this.root) return;
    var vals = this.comp.renderVals();
    this.hid = 0;
    this.handlers = {};
    this.slots = [];
    var wrap = document.createElement('div');
    build(this.def.tpl, vals, wrap, this, false);
    morphChildren(this.root, wrap);
    var self = this;
    var slotEls = Array.prototype.filter.call(this.root.querySelectorAll('[data-dc-slot]'), function (s) {
      return s.getAttribute('data-dc-owner') === self.id;
    });
    slotEls.forEach(function (slot, i) {
      var spec = self.slots[i], child = self.children[i];
      if (!spec) return;
      if (!child || child.def !== defs[spec.name]) {
        child = self.children[i] = new Inst(spec.name, spec.props);
        child.root = slot;
        child.render();
        return;
      }
      var prev = child.comp.props, moved = child.root !== slot;
      child.comp.props = spec.props;
      child.root = slot;
      var changed = Object.keys(spec.props).some(function (k) { return spec.props[k] !== prev[k]; });
      if (changed && child.comp.componentDidUpdate) child.comp.componentDidUpdate(prev);
      if (moved || changed) child.render();
    });
    if (!this.mounted) {
      this.mounted = true;
      if (this.comp.componentDidMount) this.comp.componentDidMount();
    }
  };

  function build(node, scope, parent, inst, inSvg) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        parent.appendChild(document.createTextNode(interp(c.nodeValue, scope)));
        continue;
      }
      if (c.nodeType !== 1) continue;
      var tag = c.localName;
      if (tag === 'sc-for') {
        var list = raw(c.getAttribute('list'), scope) || [], as = c.getAttribute('as');
        for (var i = 0; i < list.length; i++) {
          var s2 = Object.create(scope);
          s2[as] = list[i];
          build(c, s2, parent, inst, inSvg);
        }
        continue;
      }
      if (tag === 'sc-if') {
        if (raw(c.getAttribute('value'), scope)) build(c, scope, parent, inst, inSvg);
        continue;
      }
      if (tag === 'x-import') {
        var name = (c.getAttribute('component-from-global-scope') || '').split('.').pop(), p = {};
        Array.prototype.forEach.call(c.attributes, function (a) {
          if (a.name !== 'component-from-global-scope') p[a.name] = raw(a.value, scope);
        });
        (DS[name] ? DS[name](p, inst.reg.bind(inst)) : []).forEach(function (n) { parent.appendChild(n); });
        continue;
      }
      if (tag === 'dc-import') {
        var props = {};
        Array.prototype.forEach.call(c.attributes, function (a) {
          if (a.name !== 'name' && a.name.indexOf('hint-') !== 0) props[a.name] = raw(a.value, scope);
        });
        inst.slots.push({ name: c.getAttribute('name'), props: props });
        parent.appendChild(el('div', null, { 'data-dc-slot': String(inst.slots.length - 1), 'data-dc-owner': inst.id }));
        continue;
      }
      var svg = inSvg || tag === 'svg';
      var e = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
      Array.prototype.forEach.call(c.attributes, function (a) {
        var n = a.name;
        if (n.indexOf('hint-') === 0) return;
        if (/^on-?[a-z]+$/.test(n)) {
          var fn = raw(a.value, scope);
          if (typeof fn !== 'function') return;
          var ev = n.replace(/^on-?/, '');
          if (ev === 'change') ev = 'input';
          e.setAttribute('data-dc-h-' + ev, inst.reg(fn));
          return;
        }
        e.setAttribute(n, interp(a.value, scope));
      });
      build(c.content || c, scope, e, inst, svg);
      parent.appendChild(e);
    }
  }

  /* ---- in-place patching ---- */
  function sameKind(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1 && a.hasAttribute('data-dc-slot') !== b.hasAttribute('data-dc-slot')) return false;
    return true;
  }

  function morphChildren(from, to) {
    var f = from.firstChild, t = to.firstChild;
    while (t) {
      var nt = t.nextSibling;
      if (!f) {
        from.appendChild(t);
      } else if (!sameKind(f, t)) {
        var nf = f.nextSibling;
        from.replaceChild(t, f);
        f = nf;
      } else {
        morphNode(f, t);
        f = f.nextSibling;
      }
      t = nt;
    }
    while (f) { var n = f.nextSibling; from.removeChild(f); f = n; }
  }

  function morphNode(f, t) {
    if (f.nodeType !== 1) {
      if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue;
      return;
    }
    var i, a;
    for (i = f.attributes.length - 1; i >= 0; i--) {
      a = f.attributes[i];
      if (!t.hasAttribute(a.name)) f.removeAttribute(a.name);
    }
    for (i = 0; i < t.attributes.length; i++) {
      a = t.attributes[i];
      if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
    }
    if (f.nodeName === 'INPUT' && t.hasAttribute('value') && f.value !== t.getAttribute('value')) f.value = t.getAttribute('value');
    if (f.hasAttribute('data-dc-slot')) return;
    if (f.nodeName === 'svg' || f.namespaceURI === SVG_NS) {
      if (f.innerHTML !== t.innerHTML) f.innerHTML = t.innerHTML;
      return;
    }
    morphChildren(f, t);
  }

  /* ---- delegated events ---- */
  ['click', 'input'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var attr = 'data-dc-h-' + type;
      var node = e.target.closest ? e.target.closest('[' + attr + ']') : null;
      if (!node) return;
      var key = node.getAttribute(attr), inst = insts[key.split(':')[0]];
      var fn = inst && inst.handlers[key];
      if (fn) fn(e);
    });
  });

  window.DC = {
    define: function (name, tplId, factory) {
      defs[name] = { tpl: document.getElementById(tplId).content, Cls: factory() };
    },
    mount: function (name, rootEl) {
      var inst = new Inst(name, {});
      inst.root = rootEl;
      inst.render();
      return inst;
    }
  };
})();
