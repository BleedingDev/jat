var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _a, _commit_callbacks, _discard_callbacks, _pending, _blocking_pending, _deferred, _dirty_effects, _maybe_dirty_effects, _decrement_queued, _Batch_instances, traverse_effect_tree_fn, defer_effects_fn, commit_fn, _anchor, _hydrate_open, _props, _children, _effect, _main_effect, _pending_effect, _failed_effect, _offscreen_fragment, _pending_anchor, _local_pending_count, _pending_count, _pending_count_update_queued, _is_creating_fallback, _dirty_effects2, _maybe_dirty_effects2, _effect_pending, _effect_pending_subscriber, _Boundary_instances, hydrate_resolved_content_fn, hydrate_pending_content_fn, get_anchor_fn, run_fn, show_pending_snippet_fn, update_pending_count_fn, _batches, _onscreen, _offscreen, _outroing, _transition, _commit, _discard;
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link2 of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link2);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link2) {
    const fetchOpts = {};
    if (link2.integrity) fetchOpts.integrity = link2.integrity;
    if (link2.referrerPolicy) fetchOpts.referrerPolicy = link2.referrerPolicy;
    if (link2.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link2.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link2) {
    if (link2.ep)
      return;
    link2.ep = true;
    const fetchOpts = getFetchOpts(link2);
    fetch(link2.href, fetchOpts);
  }
})();
const PUBLIC_VERSION = "5";
if (typeof window !== "undefined") {
  ((_a = window.__svelte ?? (window.__svelte = {})).v ?? (_a.v = /* @__PURE__ */ new Set())).add(PUBLIC_VERSION);
}
const EACH_ITEM_REACTIVE = 1;
const EACH_INDEX_REACTIVE = 1 << 1;
const EACH_IS_CONTROLLED = 1 << 2;
const EACH_IS_ANIMATED = 1 << 3;
const EACH_ITEM_IMMUTABLE = 1 << 4;
const TEMPLATE_FRAGMENT = 1;
const TEMPLATE_USE_IMPORT_NODE = 1 << 1;
const UNINITIALIZED = Symbol();
const NAMESPACE_HTML = "http://www.w3.org/1999/xhtml";
const DEV = false;
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var includes = Array.prototype.includes;
var array_from = Array.from;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var get_descriptors = Object.getOwnPropertyDescriptors;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;
var is_extensible = Object.isExtensible;
function run_all(arr) {
  for (var i = 0; i < arr.length; i++) {
    arr[i]();
  }
}
function deferred() {
  var resolve;
  var reject;
  var promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function to_array(value, n) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!(Symbol.iterator in value)) {
    return Array.from(value);
  }
  const array = [];
  for (const element of value) {
    array.push(element);
    if (array.length === n) break;
  }
  return array;
}
const DERIVED = 1 << 1;
const EFFECT = 1 << 2;
const RENDER_EFFECT = 1 << 3;
const MANAGED_EFFECT = 1 << 24;
const BLOCK_EFFECT = 1 << 4;
const BRANCH_EFFECT = 1 << 5;
const ROOT_EFFECT = 1 << 6;
const BOUNDARY_EFFECT = 1 << 7;
const CONNECTED = 1 << 9;
const CLEAN = 1 << 10;
const DIRTY = 1 << 11;
const MAYBE_DIRTY = 1 << 12;
const INERT = 1 << 13;
const DESTROYED = 1 << 14;
const EFFECT_RAN = 1 << 15;
const EFFECT_TRANSPARENT = 1 << 16;
const EAGER_EFFECT = 1 << 17;
const HEAD_EFFECT = 1 << 18;
const EFFECT_PRESERVED = 1 << 19;
const USER_EFFECT = 1 << 20;
const EFFECT_OFFSCREEN = 1 << 25;
const WAS_MARKED = 1 << 15;
const REACTION_IS_UPDATING = 1 << 21;
const ASYNC = 1 << 22;
const ERROR_VALUE = 1 << 23;
const STATE_SYMBOL = Symbol("$state");
const LOADING_ATTR_SYMBOL = Symbol("");
const STALE_REACTION = new class StaleReactionError extends Error {
  constructor() {
    super(...arguments);
    __publicField(this, "name", "StaleReactionError");
    __publicField(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function async_derived_orphan() {
  {
    throw new Error(`https://svelte.dev/e/async_derived_orphan`);
  }
}
function effect_in_teardown(rune) {
  {
    throw new Error(`https://svelte.dev/e/effect_in_teardown`);
  }
}
function effect_in_unowned_derived() {
  {
    throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
  }
}
function effect_orphan(rune) {
  {
    throw new Error(`https://svelte.dev/e/effect_orphan`);
  }
}
function effect_update_depth_exceeded() {
  {
    throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
  }
}
function state_descriptors_fixed() {
  {
    throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
  }
}
function state_prototype_fixed() {
  {
    throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
  }
}
function state_unsafe_mutation() {
  {
    throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
  }
}
function svelte_boundary_reset_onerror() {
  {
    throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
  }
}
function select_multiple_invalid_value() {
  {
    console.warn(`https://svelte.dev/e/select_multiple_invalid_value`);
  }
}
function svelte_boundary_reset_noop() {
  {
    console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
  }
}
function equals(value) {
  return value === this.v;
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
}
function safe_equals(value) {
  return !safe_not_equal(value, this.v);
}
let tracing_mode_flag = false;
let component_context = null;
function set_component_context(context) {
  component_context = context;
}
function push(props, runes = false, fn) {
  component_context = {
    p: component_context,
    i: false,
    c: null,
    e: null,
    s: props,
    x: null,
    l: null
  };
}
function pop(component) {
  var context = (
    /** @type {ComponentContext} */
    component_context
  );
  var effects = context.e;
  if (effects !== null) {
    context.e = null;
    for (var fn of effects) {
      create_user_effect(fn);
    }
  }
  context.i = true;
  component_context = context.p;
  return (
    /** @type {T} */
    {}
  );
}
function is_runes() {
  return true;
}
let micro_tasks = [];
function run_micro_tasks() {
  var tasks = micro_tasks;
  micro_tasks = [];
  run_all(tasks);
}
function queue_micro_task(fn) {
  if (micro_tasks.length === 0 && !is_flushing_sync) {
    var tasks = micro_tasks;
    queueMicrotask(() => {
      if (tasks === micro_tasks) run_micro_tasks();
    });
  }
  micro_tasks.push(fn);
}
function flush_tasks() {
  while (micro_tasks.length > 0) {
    run_micro_tasks();
  }
}
function handle_error(error) {
  var effect2 = active_effect;
  if (effect2 === null) {
    active_reaction.f |= ERROR_VALUE;
    return error;
  }
  if ((effect2.f & EFFECT_RAN) === 0) {
    if ((effect2.f & BOUNDARY_EFFECT) === 0) {
      throw error;
    }
    effect2.b.error(error);
  } else {
    invoke_error_boundary(error, effect2);
  }
}
function invoke_error_boundary(error, effect2) {
  while (effect2 !== null) {
    if ((effect2.f & BOUNDARY_EFFECT) !== 0) {
      try {
        effect2.b.error(error);
        return;
      } catch (e) {
        error = e;
      }
    }
    effect2 = effect2.parent;
  }
  throw error;
}
const STATUS_MASK = -7169;
function set_signal_status(signal, status) {
  signal.f = signal.f & STATUS_MASK | status;
}
function update_derived_status(derived2) {
  if ((derived2.f & CONNECTED) !== 0 || derived2.deps === null) {
    set_signal_status(derived2, CLEAN);
  } else {
    set_signal_status(derived2, MAYBE_DIRTY);
  }
}
function clear_marked(deps) {
  if (deps === null) return;
  for (const dep of deps) {
    if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
      continue;
    }
    dep.f ^= WAS_MARKED;
    clear_marked(
      /** @type {Derived} */
      dep.deps
    );
  }
}
function defer_effect(effect2, dirty_effects, maybe_dirty_effects) {
  if ((effect2.f & DIRTY) !== 0) {
    dirty_effects.add(effect2);
  } else if ((effect2.f & MAYBE_DIRTY) !== 0) {
    maybe_dirty_effects.add(effect2);
  }
  clear_marked(effect2.deps);
  set_signal_status(effect2, CLEAN);
}
const batches = /* @__PURE__ */ new Set();
let current_batch = null;
let previous_batch = null;
let batch_values = null;
let queued_root_effects = [];
let last_scheduled_effect = null;
let is_flushing = false;
let is_flushing_sync = false;
const _Batch = class _Batch {
  constructor() {
    __privateAdd(this, _Batch_instances);
    __publicField(this, "committed", false);
    /**
     * The current values of any sources that are updated in this batch
     * They keys of this map are identical to `this.#previous`
     * @type {Map<Source, any>}
     */
    __publicField(this, "current", /* @__PURE__ */ new Map());
    /**
     * The values of any sources that are updated in this batch _before_ those updates took place.
     * They keys of this map are identical to `this.#current`
     * @type {Map<Source, any>}
     */
    __publicField(this, "previous", /* @__PURE__ */ new Map());
    /**
     * When the batch is committed (and the DOM is updated), we need to remove old branches
     * and append new ones by calling the functions added inside (if/each/key/etc) blocks
     * @type {Set<() => void>}
     */
    __privateAdd(this, _commit_callbacks, /* @__PURE__ */ new Set());
    /**
     * If a fork is discarded, we need to destroy any effects that are no longer needed
     * @type {Set<(batch: Batch) => void>}
     */
    __privateAdd(this, _discard_callbacks, /* @__PURE__ */ new Set());
    /**
     * The number of async effects that are currently in flight
     */
    __privateAdd(this, _pending, 0);
    /**
     * The number of async effects that are currently in flight, _not_ inside a pending boundary
     */
    __privateAdd(this, _blocking_pending, 0);
    /**
     * A deferred that resolves when the batch is committed, used with `settled()`
     * TODO replace with Promise.withResolvers once supported widely enough
     * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
     */
    __privateAdd(this, _deferred, null);
    /**
     * Deferred effects (which run after async work has completed) that are DIRTY
     * @type {Set<Effect>}
     */
    __privateAdd(this, _dirty_effects, /* @__PURE__ */ new Set());
    /**
     * Deferred effects that are MAYBE_DIRTY
     * @type {Set<Effect>}
     */
    __privateAdd(this, _maybe_dirty_effects, /* @__PURE__ */ new Set());
    /**
     * A set of branches that still exist, but will be destroyed when this batch
     * is committed — we skip over these during `process`
     * @type {Set<Effect>}
     */
    __publicField(this, "skipped_effects", /* @__PURE__ */ new Set());
    __publicField(this, "is_fork", false);
    __privateAdd(this, _decrement_queued, false);
  }
  is_deferred() {
    return this.is_fork || __privateGet(this, _blocking_pending) > 0;
  }
  /**
   *
   * @param {Effect[]} root_effects
   */
  process(root_effects) {
    queued_root_effects = [];
    this.apply();
    var effects = [];
    var render_effects = [];
    for (const root2 of root_effects) {
      __privateMethod(this, _Batch_instances, traverse_effect_tree_fn).call(this, root2, effects, render_effects);
    }
    if (this.is_deferred()) {
      __privateMethod(this, _Batch_instances, defer_effects_fn).call(this, render_effects);
      __privateMethod(this, _Batch_instances, defer_effects_fn).call(this, effects);
      for (const e of this.skipped_effects) {
        reset_branch(e);
      }
    } else {
      for (const fn of __privateGet(this, _commit_callbacks)) fn();
      __privateGet(this, _commit_callbacks).clear();
      if (__privateGet(this, _pending) === 0) {
        __privateMethod(this, _Batch_instances, commit_fn).call(this);
      }
      previous_batch = this;
      current_batch = null;
      flush_queued_effects(render_effects);
      flush_queued_effects(effects);
      previous_batch = null;
      __privateGet(this, _deferred)?.resolve();
    }
    batch_values = null;
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} value
   */
  capture(source2, value) {
    if (value !== UNINITIALIZED && !this.previous.has(source2)) {
      this.previous.set(source2, value);
    }
    if ((source2.f & ERROR_VALUE) === 0) {
      this.current.set(source2, source2.v);
      batch_values?.set(source2, source2.v);
    }
  }
  activate() {
    current_batch = this;
    this.apply();
  }
  deactivate() {
    if (current_batch !== this) return;
    current_batch = null;
    batch_values = null;
  }
  flush() {
    this.activate();
    if (queued_root_effects.length > 0) {
      flush_effects();
      if (current_batch !== null && current_batch !== this) {
        return;
      }
    } else if (__privateGet(this, _pending) === 0) {
      this.process([]);
    }
    this.deactivate();
  }
  discard() {
    for (const fn of __privateGet(this, _discard_callbacks)) fn(this);
    __privateGet(this, _discard_callbacks).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(blocking) {
    __privateSet(this, _pending, __privateGet(this, _pending) + 1);
    if (blocking) __privateSet(this, _blocking_pending, __privateGet(this, _blocking_pending) + 1);
  }
  /**
   *
   * @param {boolean} blocking
   */
  decrement(blocking) {
    __privateSet(this, _pending, __privateGet(this, _pending) - 1);
    if (blocking) __privateSet(this, _blocking_pending, __privateGet(this, _blocking_pending) - 1);
    if (__privateGet(this, _decrement_queued)) return;
    __privateSet(this, _decrement_queued, true);
    queue_micro_task(() => {
      __privateSet(this, _decrement_queued, false);
      if (!this.is_deferred()) {
        this.revive();
      } else if (queued_root_effects.length > 0) {
        this.flush();
      }
    });
  }
  revive() {
    for (const e of __privateGet(this, _dirty_effects)) {
      __privateGet(this, _maybe_dirty_effects).delete(e);
      set_signal_status(e, DIRTY);
      schedule_effect(e);
    }
    for (const e of __privateGet(this, _maybe_dirty_effects)) {
      set_signal_status(e, MAYBE_DIRTY);
      schedule_effect(e);
    }
    this.flush();
  }
  /** @param {() => void} fn */
  oncommit(fn) {
    __privateGet(this, _commit_callbacks).add(fn);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(fn) {
    __privateGet(this, _discard_callbacks).add(fn);
  }
  settled() {
    return (__privateGet(this, _deferred) ?? __privateSet(this, _deferred, deferred())).promise;
  }
  static ensure() {
    if (current_batch === null) {
      const batch = current_batch = new _Batch();
      batches.add(current_batch);
      if (!is_flushing_sync) {
        queue_micro_task(() => {
          if (current_batch !== batch) {
            return;
          }
          batch.flush();
        });
      }
    }
    return current_batch;
  }
  apply() {
    return;
  }
};
_commit_callbacks = new WeakMap();
_discard_callbacks = new WeakMap();
_pending = new WeakMap();
_blocking_pending = new WeakMap();
_deferred = new WeakMap();
_dirty_effects = new WeakMap();
_maybe_dirty_effects = new WeakMap();
_decrement_queued = new WeakMap();
_Batch_instances = new WeakSet();
/**
 * Traverse the effect tree, executing effects or stashing
 * them for later execution as appropriate
 * @param {Effect} root
 * @param {Effect[]} effects
 * @param {Effect[]} render_effects
 */
traverse_effect_tree_fn = function(root2, effects, render_effects) {
  root2.f ^= CLEAN;
  var effect2 = root2.first;
  var pending_boundary = null;
  while (effect2 !== null) {
    var flags2 = effect2.f;
    var is_branch = (flags2 & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
    var is_skippable_branch = is_branch && (flags2 & CLEAN) !== 0;
    var skip = is_skippable_branch || (flags2 & INERT) !== 0 || this.skipped_effects.has(effect2);
    if (!skip && effect2.fn !== null) {
      if (is_branch) {
        effect2.f ^= CLEAN;
      } else if (pending_boundary !== null && (flags2 & (EFFECT | RENDER_EFFECT | MANAGED_EFFECT)) !== 0) {
        pending_boundary.b.defer_effect(effect2);
      } else if ((flags2 & EFFECT) !== 0) {
        effects.push(effect2);
      } else if (is_dirty(effect2)) {
        if ((flags2 & BLOCK_EFFECT) !== 0) __privateGet(this, _maybe_dirty_effects).add(effect2);
        update_effect(effect2);
      }
      var child2 = effect2.first;
      if (child2 !== null) {
        effect2 = child2;
        continue;
      }
    }
    var parent = effect2.parent;
    effect2 = effect2.next;
    while (effect2 === null && parent !== null) {
      if (parent === pending_boundary) {
        pending_boundary = null;
      }
      effect2 = parent.next;
      parent = parent.parent;
    }
  }
};
/**
 * @param {Effect[]} effects
 */
defer_effects_fn = function(effects) {
  for (var i = 0; i < effects.length; i += 1) {
    defer_effect(effects[i], __privateGet(this, _dirty_effects), __privateGet(this, _maybe_dirty_effects));
  }
};
commit_fn = function() {
  var _a2;
  if (batches.size > 1) {
    this.previous.clear();
    var previous_batch_values = batch_values;
    var is_earlier = true;
    for (const batch of batches) {
      if (batch === this) {
        is_earlier = false;
        continue;
      }
      const sources = [];
      for (const [source2, value] of this.current) {
        if (batch.current.has(source2)) {
          if (is_earlier && value !== batch.current.get(source2)) {
            batch.current.set(source2, value);
          } else {
            continue;
          }
        }
        sources.push(source2);
      }
      if (sources.length === 0) {
        continue;
      }
      const others = [...batch.current.keys()].filter((s) => !this.current.has(s));
      if (others.length > 0) {
        var prev_queued_root_effects = queued_root_effects;
        queued_root_effects = [];
        const marked = /* @__PURE__ */ new Set();
        const checked = /* @__PURE__ */ new Map();
        for (const source2 of sources) {
          mark_effects(source2, others, marked, checked);
        }
        if (queued_root_effects.length > 0) {
          current_batch = batch;
          batch.apply();
          for (const root2 of queued_root_effects) {
            __privateMethod(_a2 = batch, _Batch_instances, traverse_effect_tree_fn).call(_a2, root2, [], []);
          }
          batch.deactivate();
        }
        queued_root_effects = prev_queued_root_effects;
      }
    }
    current_batch = null;
    batch_values = previous_batch_values;
  }
  this.committed = true;
  batches.delete(this);
};
let Batch = _Batch;
function flushSync(fn) {
  var was_flushing_sync = is_flushing_sync;
  is_flushing_sync = true;
  try {
    var result;
    if (fn) ;
    while (true) {
      flush_tasks();
      if (queued_root_effects.length === 0) {
        current_batch?.flush();
        if (queued_root_effects.length === 0) {
          last_scheduled_effect = null;
          return (
            /** @type {T} */
            result
          );
        }
      }
      flush_effects();
    }
  } finally {
    is_flushing_sync = was_flushing_sync;
  }
}
function flush_effects() {
  is_flushing = true;
  var source_stacks = null;
  try {
    var flush_count = 0;
    while (queued_root_effects.length > 0) {
      var batch = Batch.ensure();
      if (flush_count++ > 1e3) {
        var updates, entry;
        if (DEV) ;
        infinite_loop_guard();
      }
      batch.process(queued_root_effects);
      old_values.clear();
      if (DEV) ;
    }
  } finally {
    is_flushing = false;
    last_scheduled_effect = null;
  }
}
function infinite_loop_guard() {
  try {
    effect_update_depth_exceeded();
  } catch (error) {
    invoke_error_boundary(error, last_scheduled_effect);
  }
}
let eager_block_effects = null;
function flush_queued_effects(effects) {
  var length = effects.length;
  if (length === 0) return;
  var i = 0;
  while (i < length) {
    var effect2 = effects[i++];
    if ((effect2.f & (DESTROYED | INERT)) === 0 && is_dirty(effect2)) {
      eager_block_effects = /* @__PURE__ */ new Set();
      update_effect(effect2);
      if (effect2.deps === null && effect2.first === null && effect2.nodes === null) {
        if (effect2.teardown === null && effect2.ac === null) {
          unlink_effect(effect2);
        } else {
          effect2.fn = null;
        }
      }
      if (eager_block_effects?.size > 0) {
        old_values.clear();
        for (const e of eager_block_effects) {
          if ((e.f & (DESTROYED | INERT)) !== 0) continue;
          const ordered_effects = [e];
          let ancestor = e.parent;
          while (ancestor !== null) {
            if (eager_block_effects.has(ancestor)) {
              eager_block_effects.delete(ancestor);
              ordered_effects.push(ancestor);
            }
            ancestor = ancestor.parent;
          }
          for (let j = ordered_effects.length - 1; j >= 0; j--) {
            const e2 = ordered_effects[j];
            if ((e2.f & (DESTROYED | INERT)) !== 0) continue;
            update_effect(e2);
          }
        }
        eager_block_effects.clear();
      }
    }
  }
  eager_block_effects = null;
}
function mark_effects(value, sources, marked, checked) {
  if (marked.has(value)) return;
  marked.add(value);
  if (value.reactions !== null) {
    for (const reaction of value.reactions) {
      const flags2 = reaction.f;
      if ((flags2 & DERIVED) !== 0) {
        mark_effects(
          /** @type {Derived} */
          reaction,
          sources,
          marked,
          checked
        );
      } else if ((flags2 & (ASYNC | BLOCK_EFFECT)) !== 0 && (flags2 & DIRTY) === 0 && depends_on(reaction, sources, checked)) {
        set_signal_status(reaction, DIRTY);
        schedule_effect(
          /** @type {Effect} */
          reaction
        );
      }
    }
  }
}
function depends_on(reaction, sources, checked) {
  const depends = checked.get(reaction);
  if (depends !== void 0) return depends;
  if (reaction.deps !== null) {
    for (const dep of reaction.deps) {
      if (includes.call(sources, dep)) {
        return true;
      }
      if ((dep.f & DERIVED) !== 0 && depends_on(
        /** @type {Derived} */
        dep,
        sources,
        checked
      )) {
        checked.set(
          /** @type {Derived} */
          dep,
          true
        );
        return true;
      }
    }
  }
  checked.set(reaction, false);
  return false;
}
function schedule_effect(signal) {
  var effect2 = last_scheduled_effect = signal;
  while (effect2.parent !== null) {
    effect2 = effect2.parent;
    var flags2 = effect2.f;
    if (is_flushing && effect2 === active_effect && (flags2 & BLOCK_EFFECT) !== 0 && (flags2 & HEAD_EFFECT) === 0) {
      return;
    }
    if ((flags2 & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
      if ((flags2 & CLEAN) === 0) return;
      effect2.f ^= CLEAN;
    }
  }
  queued_root_effects.push(effect2);
}
function reset_branch(effect2) {
  if ((effect2.f & BRANCH_EFFECT) !== 0 && (effect2.f & CLEAN) !== 0) {
    return;
  }
  set_signal_status(effect2, CLEAN);
  var e = effect2.first;
  while (e !== null) {
    reset_branch(e);
    e = e.next;
  }
}
function createSubscriber(start) {
  let subscribers = 0;
  let version = source(0);
  let stop;
  return () => {
    if (effect_tracking()) {
      get(version);
      render_effect(() => {
        if (subscribers === 0) {
          stop = untrack(() => start(() => increment(version)));
        }
        subscribers += 1;
        return () => {
          queue_micro_task(() => {
            subscribers -= 1;
            if (subscribers === 0) {
              stop?.();
              stop = void 0;
              increment(version);
            }
          });
        };
      });
    }
  };
}
var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED | BOUNDARY_EFFECT;
function boundary(node, props, children) {
  new Boundary(node, props, children);
}
class Boundary {
  /**
   * @param {TemplateNode} node
   * @param {BoundaryProps} props
   * @param {((anchor: Node) => void)} children
   */
  constructor(node, props, children) {
    __privateAdd(this, _Boundary_instances);
    /** @type {Boundary | null} */
    __publicField(this, "parent");
    __publicField(this, "is_pending", false);
    /** @type {TemplateNode} */
    __privateAdd(this, _anchor);
    /** @type {TemplateNode | null} */
    __privateAdd(this, _hydrate_open, null);
    /** @type {BoundaryProps} */
    __privateAdd(this, _props);
    /** @type {((anchor: Node) => void)} */
    __privateAdd(this, _children);
    /** @type {Effect} */
    __privateAdd(this, _effect);
    /** @type {Effect | null} */
    __privateAdd(this, _main_effect, null);
    /** @type {Effect | null} */
    __privateAdd(this, _pending_effect, null);
    /** @type {Effect | null} */
    __privateAdd(this, _failed_effect, null);
    /** @type {DocumentFragment | null} */
    __privateAdd(this, _offscreen_fragment, null);
    /** @type {TemplateNode | null} */
    __privateAdd(this, _pending_anchor, null);
    __privateAdd(this, _local_pending_count, 0);
    __privateAdd(this, _pending_count, 0);
    __privateAdd(this, _pending_count_update_queued, false);
    __privateAdd(this, _is_creating_fallback, false);
    /** @type {Set<Effect>} */
    __privateAdd(this, _dirty_effects2, /* @__PURE__ */ new Set());
    /** @type {Set<Effect>} */
    __privateAdd(this, _maybe_dirty_effects2, /* @__PURE__ */ new Set());
    /**
     * A source containing the number of pending async deriveds/expressions.
     * Only created if `$effect.pending()` is used inside the boundary,
     * otherwise updating the source results in needless `Batch.ensure()`
     * calls followed by no-op flushes
     * @type {Source<number> | null}
     */
    __privateAdd(this, _effect_pending, null);
    __privateAdd(this, _effect_pending_subscriber, createSubscriber(() => {
      __privateSet(this, _effect_pending, source(__privateGet(this, _local_pending_count)));
      return () => {
        __privateSet(this, _effect_pending, null);
      };
    }));
    __privateSet(this, _anchor, node);
    __privateSet(this, _props, props);
    __privateSet(this, _children, children);
    this.parent = /** @type {Effect} */
    active_effect.b;
    this.is_pending = !!__privateGet(this, _props).pending;
    __privateSet(this, _effect, block(() => {
      active_effect.b = this;
      {
        var anchor = __privateMethod(this, _Boundary_instances, get_anchor_fn).call(this);
        try {
          __privateSet(this, _main_effect, branch(() => children(anchor)));
        } catch (error) {
          this.error(error);
        }
        if (__privateGet(this, _pending_count) > 0) {
          __privateMethod(this, _Boundary_instances, show_pending_snippet_fn).call(this);
        } else {
          this.is_pending = false;
        }
      }
      return () => {
        __privateGet(this, _pending_anchor)?.remove();
      };
    }, flags));
  }
  /**
   * Defer an effect inside a pending boundary until the boundary resolves
   * @param {Effect} effect
   */
  defer_effect(effect2) {
    defer_effect(effect2, __privateGet(this, _dirty_effects2), __privateGet(this, _maybe_dirty_effects2));
  }
  /**
   * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
   * @returns {boolean}
   */
  is_rendered() {
    return !this.is_pending && (!this.parent || this.parent.is_rendered());
  }
  has_pending_snippet() {
    return !!__privateGet(this, _props).pending;
  }
  /**
   * Update the source that powers `$effect.pending()` inside this boundary,
   * and controls when the current `pending` snippet (if any) is removed.
   * Do not call from inside the class
   * @param {1 | -1} d
   */
  update_pending_count(d) {
    __privateMethod(this, _Boundary_instances, update_pending_count_fn).call(this, d);
    __privateSet(this, _local_pending_count, __privateGet(this, _local_pending_count) + d);
    if (!__privateGet(this, _effect_pending) || __privateGet(this, _pending_count_update_queued)) return;
    __privateSet(this, _pending_count_update_queued, true);
    queue_micro_task(() => {
      __privateSet(this, _pending_count_update_queued, false);
      if (__privateGet(this, _effect_pending)) {
        internal_set(__privateGet(this, _effect_pending), __privateGet(this, _local_pending_count));
      }
    });
  }
  get_effect_pending() {
    __privateGet(this, _effect_pending_subscriber).call(this);
    return get(
      /** @type {Source<number>} */
      __privateGet(this, _effect_pending)
    );
  }
  /** @param {unknown} error */
  error(error) {
    var onerror = __privateGet(this, _props).onerror;
    let failed = __privateGet(this, _props).failed;
    if (__privateGet(this, _is_creating_fallback) || !onerror && !failed) {
      throw error;
    }
    if (__privateGet(this, _main_effect)) {
      destroy_effect(__privateGet(this, _main_effect));
      __privateSet(this, _main_effect, null);
    }
    if (__privateGet(this, _pending_effect)) {
      destroy_effect(__privateGet(this, _pending_effect));
      __privateSet(this, _pending_effect, null);
    }
    if (__privateGet(this, _failed_effect)) {
      destroy_effect(__privateGet(this, _failed_effect));
      __privateSet(this, _failed_effect, null);
    }
    var did_reset = false;
    var calling_on_error = false;
    const reset = () => {
      if (did_reset) {
        svelte_boundary_reset_noop();
        return;
      }
      did_reset = true;
      if (calling_on_error) {
        svelte_boundary_reset_onerror();
      }
      Batch.ensure();
      __privateSet(this, _local_pending_count, 0);
      if (__privateGet(this, _failed_effect) !== null) {
        pause_effect(__privateGet(this, _failed_effect), () => {
          __privateSet(this, _failed_effect, null);
        });
      }
      this.is_pending = this.has_pending_snippet();
      __privateSet(this, _main_effect, __privateMethod(this, _Boundary_instances, run_fn).call(this, () => {
        __privateSet(this, _is_creating_fallback, false);
        return branch(() => __privateGet(this, _children).call(this, __privateGet(this, _anchor)));
      }));
      if (__privateGet(this, _pending_count) > 0) {
        __privateMethod(this, _Boundary_instances, show_pending_snippet_fn).call(this);
      } else {
        this.is_pending = false;
      }
    };
    queue_micro_task(() => {
      try {
        calling_on_error = true;
        onerror?.(error, reset);
        calling_on_error = false;
      } catch (error2) {
        invoke_error_boundary(error2, __privateGet(this, _effect) && __privateGet(this, _effect).parent);
      }
      if (failed) {
        __privateSet(this, _failed_effect, __privateMethod(this, _Boundary_instances, run_fn).call(this, () => {
          Batch.ensure();
          __privateSet(this, _is_creating_fallback, true);
          try {
            return branch(() => {
              failed(
                __privateGet(this, _anchor),
                () => error,
                () => reset
              );
            });
          } catch (error2) {
            invoke_error_boundary(
              error2,
              /** @type {Effect} */
              __privateGet(this, _effect).parent
            );
            return null;
          } finally {
            __privateSet(this, _is_creating_fallback, false);
          }
        }));
      }
    });
  }
}
_anchor = new WeakMap();
_hydrate_open = new WeakMap();
_props = new WeakMap();
_children = new WeakMap();
_effect = new WeakMap();
_main_effect = new WeakMap();
_pending_effect = new WeakMap();
_failed_effect = new WeakMap();
_offscreen_fragment = new WeakMap();
_pending_anchor = new WeakMap();
_local_pending_count = new WeakMap();
_pending_count = new WeakMap();
_pending_count_update_queued = new WeakMap();
_is_creating_fallback = new WeakMap();
_dirty_effects2 = new WeakMap();
_maybe_dirty_effects2 = new WeakMap();
_effect_pending = new WeakMap();
_effect_pending_subscriber = new WeakMap();
_Boundary_instances = new WeakSet();
hydrate_resolved_content_fn = function() {
  try {
    __privateSet(this, _main_effect, branch(() => __privateGet(this, _children).call(this, __privateGet(this, _anchor))));
  } catch (error) {
    this.error(error);
  }
};
hydrate_pending_content_fn = function() {
  const pending = __privateGet(this, _props).pending;
  if (!pending) return;
  __privateSet(this, _pending_effect, branch(() => pending(__privateGet(this, _anchor))));
  queue_micro_task(() => {
    var anchor = __privateMethod(this, _Boundary_instances, get_anchor_fn).call(this);
    __privateSet(this, _main_effect, __privateMethod(this, _Boundary_instances, run_fn).call(this, () => {
      Batch.ensure();
      return branch(() => __privateGet(this, _children).call(this, anchor));
    }));
    if (__privateGet(this, _pending_count) > 0) {
      __privateMethod(this, _Boundary_instances, show_pending_snippet_fn).call(this);
    } else {
      pause_effect(
        /** @type {Effect} */
        __privateGet(this, _pending_effect),
        () => {
          __privateSet(this, _pending_effect, null);
        }
      );
      this.is_pending = false;
    }
  });
};
get_anchor_fn = function() {
  var anchor = __privateGet(this, _anchor);
  if (this.is_pending) {
    __privateSet(this, _pending_anchor, create_text());
    __privateGet(this, _anchor).before(__privateGet(this, _pending_anchor));
    anchor = __privateGet(this, _pending_anchor);
  }
  return anchor;
};
/**
 * @param {() => Effect | null} fn
 */
run_fn = function(fn) {
  var previous_effect = active_effect;
  var previous_reaction = active_reaction;
  var previous_ctx = component_context;
  set_active_effect(__privateGet(this, _effect));
  set_active_reaction(__privateGet(this, _effect));
  set_component_context(__privateGet(this, _effect).ctx);
  try {
    return fn();
  } catch (e) {
    handle_error(e);
    return null;
  } finally {
    set_active_effect(previous_effect);
    set_active_reaction(previous_reaction);
    set_component_context(previous_ctx);
  }
};
show_pending_snippet_fn = function() {
  const pending = (
    /** @type {(anchor: Node) => void} */
    __privateGet(this, _props).pending
  );
  if (__privateGet(this, _main_effect) !== null) {
    __privateSet(this, _offscreen_fragment, document.createDocumentFragment());
    __privateGet(this, _offscreen_fragment).append(
      /** @type {TemplateNode} */
      __privateGet(this, _pending_anchor)
    );
    move_effect(__privateGet(this, _main_effect), __privateGet(this, _offscreen_fragment));
  }
  if (__privateGet(this, _pending_effect) === null) {
    __privateSet(this, _pending_effect, branch(() => pending(__privateGet(this, _anchor))));
  }
};
/**
 * Updates the pending count associated with the currently visible pending snippet,
 * if any, such that we can replace the snippet with content once work is done
 * @param {1 | -1} d
 */
update_pending_count_fn = function(d) {
  var _a2;
  if (!this.has_pending_snippet()) {
    if (this.parent) {
      __privateMethod(_a2 = this.parent, _Boundary_instances, update_pending_count_fn).call(_a2, d);
    }
    return;
  }
  __privateSet(this, _pending_count, __privateGet(this, _pending_count) + d);
  if (__privateGet(this, _pending_count) === 0) {
    this.is_pending = false;
    for (const e of __privateGet(this, _dirty_effects2)) {
      set_signal_status(e, DIRTY);
      schedule_effect(e);
    }
    for (const e of __privateGet(this, _maybe_dirty_effects2)) {
      set_signal_status(e, MAYBE_DIRTY);
      schedule_effect(e);
    }
    __privateGet(this, _dirty_effects2).clear();
    __privateGet(this, _maybe_dirty_effects2).clear();
    if (__privateGet(this, _pending_effect)) {
      pause_effect(__privateGet(this, _pending_effect), () => {
        __privateSet(this, _pending_effect, null);
      });
    }
    if (__privateGet(this, _offscreen_fragment)) {
      __privateGet(this, _anchor).before(__privateGet(this, _offscreen_fragment));
      __privateSet(this, _offscreen_fragment, null);
    }
  }
};
function flatten(blockers, sync, async, fn) {
  const d = derived;
  var pending = blockers.filter((b) => !b.settled);
  if (async.length === 0 && pending.length === 0) {
    fn(sync.map(d));
    return;
  }
  var batch = current_batch;
  var parent = (
    /** @type {Effect} */
    active_effect
  );
  var restore = capture();
  var blocker_promise = pending.length === 1 ? pending[0].promise : pending.length > 1 ? Promise.all(pending.map((b) => b.promise)) : null;
  function finish(values) {
    restore();
    try {
      fn(values);
    } catch (error) {
      if ((parent.f & DESTROYED) === 0) {
        invoke_error_boundary(error, parent);
      }
    }
    batch?.deactivate();
    unset_context();
  }
  if (async.length === 0) {
    blocker_promise.then(() => finish(sync.map(d)));
    return;
  }
  function run() {
    restore();
    Promise.all(async.map((expression) => /* @__PURE__ */ async_derived(expression))).then((result) => finish([...sync.map(d), ...result])).catch((error) => invoke_error_boundary(error, parent));
  }
  if (blocker_promise) {
    blocker_promise.then(run);
  } else {
    run();
  }
}
function capture() {
  var previous_effect = active_effect;
  var previous_reaction = active_reaction;
  var previous_component_context = component_context;
  var previous_batch2 = current_batch;
  return function restore(activate_batch = true) {
    set_active_effect(previous_effect);
    set_active_reaction(previous_reaction);
    set_component_context(previous_component_context);
    if (activate_batch) previous_batch2?.activate();
  };
}
function unset_context() {
  set_active_effect(null);
  set_active_reaction(null);
  set_component_context(null);
}
// @__NO_SIDE_EFFECTS__
function derived(fn) {
  var flags2 = DERIVED | DIRTY;
  var parent_derived = active_reaction !== null && (active_reaction.f & DERIVED) !== 0 ? (
    /** @type {Derived} */
    active_reaction
  ) : null;
  if (active_effect !== null) {
    active_effect.f |= EFFECT_PRESERVED;
  }
  const signal = {
    ctx: component_context,
    deps: null,
    effects: null,
    equals,
    f: flags2,
    fn,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      UNINITIALIZED
    ),
    wv: 0,
    parent: parent_derived ?? active_effect,
    ac: null
  };
  return signal;
}
// @__NO_SIDE_EFFECTS__
function async_derived(fn, label, location) {
  let parent = (
    /** @type {Effect | null} */
    active_effect
  );
  if (parent === null) {
    async_derived_orphan();
  }
  var boundary2 = (
    /** @type {Boundary} */
    parent.b
  );
  var promise = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  );
  var signal = source(
    /** @type {V} */
    UNINITIALIZED
  );
  var should_suspend = !active_reaction;
  var deferreds = /* @__PURE__ */ new Map();
  async_effect(() => {
    var d = deferred();
    promise = d.promise;
    try {
      Promise.resolve(fn()).then(d.resolve, d.reject).then(() => {
        if (batch === current_batch && batch.committed) {
          batch.deactivate();
        }
        unset_context();
      });
    } catch (error) {
      d.reject(error);
      unset_context();
    }
    var batch = (
      /** @type {Batch} */
      current_batch
    );
    if (should_suspend) {
      var blocking = boundary2.is_rendered();
      boundary2.update_pending_count(1);
      batch.increment(blocking);
      deferreds.get(batch)?.reject(STALE_REACTION);
      deferreds.delete(batch);
      deferreds.set(batch, d);
    }
    const handler = (value, error = void 0) => {
      batch.activate();
      if (error) {
        if (error !== STALE_REACTION) {
          signal.f |= ERROR_VALUE;
          internal_set(signal, error);
        }
      } else {
        if ((signal.f & ERROR_VALUE) !== 0) {
          signal.f ^= ERROR_VALUE;
        }
        internal_set(signal, value);
        for (const [b, d2] of deferreds) {
          deferreds.delete(b);
          if (b === batch) break;
          d2.reject(STALE_REACTION);
        }
      }
      if (should_suspend) {
        boundary2.update_pending_count(-1);
        batch.decrement(blocking);
      }
    };
    d.promise.then(handler, (e) => handler(null, e || "unknown"));
  });
  teardown(() => {
    for (const d of deferreds.values()) {
      d.reject(STALE_REACTION);
    }
  });
  return new Promise((fulfil) => {
    function next(p) {
      function go() {
        if (p === promise) {
          fulfil(signal);
        } else {
          next(promise);
        }
      }
      p.then(go, go);
    }
    next(promise);
  });
}
// @__NO_SIDE_EFFECTS__
function user_derived(fn) {
  const d = /* @__PURE__ */ derived(fn);
  push_reaction_value(d);
  return d;
}
// @__NO_SIDE_EFFECTS__
function derived_safe_equal(fn) {
  const signal = /* @__PURE__ */ derived(fn);
  signal.equals = safe_equals;
  return signal;
}
function destroy_derived_effects(derived2) {
  var effects = derived2.effects;
  if (effects !== null) {
    derived2.effects = null;
    for (var i = 0; i < effects.length; i += 1) {
      destroy_effect(
        /** @type {Effect} */
        effects[i]
      );
    }
  }
}
function get_derived_parent_effect(derived2) {
  var parent = derived2.parent;
  while (parent !== null) {
    if ((parent.f & DERIVED) === 0) {
      return (parent.f & DESTROYED) === 0 ? (
        /** @type {Effect} */
        parent
      ) : null;
    }
    parent = parent.parent;
  }
  return null;
}
function execute_derived(derived2) {
  var value;
  var prev_active_effect = active_effect;
  set_active_effect(get_derived_parent_effect(derived2));
  {
    try {
      derived2.f &= ~WAS_MARKED;
      destroy_derived_effects(derived2);
      value = update_reaction(derived2);
    } finally {
      set_active_effect(prev_active_effect);
    }
  }
  return value;
}
function update_derived(derived2) {
  var value = execute_derived(derived2);
  if (!derived2.equals(value)) {
    derived2.wv = increment_write_version();
    if (!current_batch?.is_fork || derived2.deps === null) {
      derived2.v = value;
      if (derived2.deps === null) {
        set_signal_status(derived2, CLEAN);
        return;
      }
    }
  }
  if (is_destroying_effect) {
    return;
  }
  if (batch_values !== null) {
    if (effect_tracking() || current_batch?.is_fork) {
      batch_values.set(derived2, value);
    }
  } else {
    update_derived_status(derived2);
  }
}
let eager_effects = /* @__PURE__ */ new Set();
const old_values = /* @__PURE__ */ new Map();
let eager_effects_deferred = false;
function source(v, stack) {
  var signal = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v,
    reactions: null,
    equals,
    rv: 0,
    wv: 0
  };
  return signal;
}
// @__NO_SIDE_EFFECTS__
function state(v, stack) {
  const s = source(v);
  push_reaction_value(s);
  return s;
}
// @__NO_SIDE_EFFECTS__
function mutable_source(initial_value, immutable = false, trackable = true) {
  const s = source(initial_value);
  if (!immutable) {
    s.equals = safe_equals;
  }
  return s;
}
function set(source2, value, should_proxy = false) {
  if (active_reaction !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) && is_runes() && (active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 && (current_sources === null || !includes.call(current_sources, source2))) {
    state_unsafe_mutation();
  }
  let new_value = should_proxy ? proxy(value) : value;
  return internal_set(source2, new_value);
}
function internal_set(source2, value) {
  if (!source2.equals(value)) {
    var old_value = source2.v;
    if (is_destroying_effect) {
      old_values.set(source2, value);
    } else {
      old_values.set(source2, old_value);
    }
    source2.v = value;
    var batch = Batch.ensure();
    batch.capture(source2, old_value);
    if ((source2.f & DERIVED) !== 0) {
      const derived2 = (
        /** @type {Derived} */
        source2
      );
      if ((source2.f & DIRTY) !== 0) {
        execute_derived(derived2);
      }
      update_derived_status(derived2);
    }
    source2.wv = increment_write_version();
    mark_reactions(source2, DIRTY);
    if (active_effect !== null && (active_effect.f & CLEAN) !== 0 && (active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0) {
      if (untracked_writes === null) {
        set_untracked_writes([source2]);
      } else {
        untracked_writes.push(source2);
      }
    }
    if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
      flush_eager_effects();
    }
  }
  return value;
}
function flush_eager_effects() {
  eager_effects_deferred = false;
  for (const effect2 of eager_effects) {
    if ((effect2.f & CLEAN) !== 0) {
      set_signal_status(effect2, MAYBE_DIRTY);
    }
    if (is_dirty(effect2)) {
      update_effect(effect2);
    }
  }
  eager_effects.clear();
}
function increment(source2) {
  set(source2, source2.v + 1);
}
function mark_reactions(signal, status) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  var length = reactions.length;
  for (var i = 0; i < length; i++) {
    var reaction = reactions[i];
    var flags2 = reaction.f;
    var not_dirty = (flags2 & DIRTY) === 0;
    if (not_dirty) {
      set_signal_status(reaction, status);
    }
    if ((flags2 & DERIVED) !== 0) {
      var derived2 = (
        /** @type {Derived} */
        reaction
      );
      batch_values?.delete(derived2);
      if ((flags2 & WAS_MARKED) === 0) {
        if (flags2 & CONNECTED) {
          reaction.f |= WAS_MARKED;
        }
        mark_reactions(derived2, MAYBE_DIRTY);
      }
    } else if (not_dirty) {
      if ((flags2 & BLOCK_EFFECT) !== 0 && eager_block_effects !== null) {
        eager_block_effects.add(
          /** @type {Effect} */
          reaction
        );
      }
      schedule_effect(
        /** @type {Effect} */
        reaction
      );
    }
  }
}
function proxy(value) {
  if (typeof value !== "object" || value === null || STATE_SYMBOL in value) {
    return value;
  }
  const prototype = get_prototype_of(value);
  if (prototype !== object_prototype && prototype !== array_prototype) {
    return value;
  }
  var sources = /* @__PURE__ */ new Map();
  var is_proxied_array = is_array(value);
  var version = /* @__PURE__ */ state(0);
  var parent_version = update_version;
  var with_parent = (fn) => {
    if (update_version === parent_version) {
      return fn();
    }
    var reaction = active_reaction;
    var version2 = update_version;
    set_active_reaction(null);
    set_update_version(parent_version);
    var result = fn();
    set_active_reaction(reaction);
    set_update_version(version2);
    return result;
  };
  if (is_proxied_array) {
    sources.set("length", /* @__PURE__ */ state(
      /** @type {any[]} */
      value.length
    ));
  }
  return new Proxy(
    /** @type {any} */
    value,
    {
      defineProperty(_, prop, descriptor) {
        if (!("value" in descriptor) || descriptor.configurable === false || descriptor.enumerable === false || descriptor.writable === false) {
          state_descriptors_fixed();
        }
        var s = sources.get(prop);
        if (s === void 0) {
          s = with_parent(() => {
            var s2 = /* @__PURE__ */ state(descriptor.value);
            sources.set(prop, s2);
            return s2;
          });
        } else {
          set(s, descriptor.value, true);
        }
        return true;
      },
      deleteProperty(target, prop) {
        var s = sources.get(prop);
        if (s === void 0) {
          if (prop in target) {
            const s2 = with_parent(() => /* @__PURE__ */ state(UNINITIALIZED));
            sources.set(prop, s2);
            increment(version);
          }
        } else {
          set(s, UNINITIALIZED);
          increment(version);
        }
        return true;
      },
      get(target, prop, receiver) {
        if (prop === STATE_SYMBOL) {
          return value;
        }
        var s = sources.get(prop);
        var exists = prop in target;
        if (s === void 0 && (!exists || get_descriptor(target, prop)?.writable)) {
          s = with_parent(() => {
            var p = proxy(exists ? target[prop] : UNINITIALIZED);
            var s2 = /* @__PURE__ */ state(p);
            return s2;
          });
          sources.set(prop, s);
        }
        if (s !== void 0) {
          var v = get(s);
          return v === UNINITIALIZED ? void 0 : v;
        }
        return Reflect.get(target, prop, receiver);
      },
      getOwnPropertyDescriptor(target, prop) {
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor && "value" in descriptor) {
          var s = sources.get(prop);
          if (s) descriptor.value = get(s);
        } else if (descriptor === void 0) {
          var source2 = sources.get(prop);
          var value2 = source2?.v;
          if (source2 !== void 0 && value2 !== UNINITIALIZED) {
            return {
              enumerable: true,
              configurable: true,
              value: value2,
              writable: true
            };
          }
        }
        return descriptor;
      },
      has(target, prop) {
        if (prop === STATE_SYMBOL) {
          return true;
        }
        var s = sources.get(prop);
        var has = s !== void 0 && s.v !== UNINITIALIZED || Reflect.has(target, prop);
        if (s !== void 0 || active_effect !== null && (!has || get_descriptor(target, prop)?.writable)) {
          if (s === void 0) {
            s = with_parent(() => {
              var p = has ? proxy(target[prop]) : UNINITIALIZED;
              var s2 = /* @__PURE__ */ state(p);
              return s2;
            });
            sources.set(prop, s);
          }
          var value2 = get(s);
          if (value2 === UNINITIALIZED) {
            return false;
          }
        }
        return has;
      },
      set(target, prop, value2, receiver) {
        var s = sources.get(prop);
        var has = prop in target;
        if (is_proxied_array && prop === "length") {
          for (var i = value2; i < /** @type {Source<number>} */
          s.v; i += 1) {
            var other_s = sources.get(i + "");
            if (other_s !== void 0) {
              set(other_s, UNINITIALIZED);
            } else if (i in target) {
              other_s = with_parent(() => /* @__PURE__ */ state(UNINITIALIZED));
              sources.set(i + "", other_s);
            }
          }
        }
        if (s === void 0) {
          if (!has || get_descriptor(target, prop)?.writable) {
            s = with_parent(() => /* @__PURE__ */ state(void 0));
            set(s, proxy(value2));
            sources.set(prop, s);
          }
        } else {
          has = s.v !== UNINITIALIZED;
          var p = with_parent(() => proxy(value2));
          set(s, p);
        }
        var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
        if (descriptor?.set) {
          descriptor.set.call(receiver, value2);
        }
        if (!has) {
          if (is_proxied_array && typeof prop === "string") {
            var ls = (
              /** @type {Source<number>} */
              sources.get("length")
            );
            var n = Number(prop);
            if (Number.isInteger(n) && n >= ls.v) {
              set(ls, n + 1);
            }
          }
          increment(version);
        }
        return true;
      },
      ownKeys(target) {
        get(version);
        var own_keys = Reflect.ownKeys(target).filter((key2) => {
          var source3 = sources.get(key2);
          return source3 === void 0 || source3.v !== UNINITIALIZED;
        });
        for (var [key, source2] of sources) {
          if (source2.v !== UNINITIALIZED && !(key in target)) {
            own_keys.push(key);
          }
        }
        return own_keys;
      },
      setPrototypeOf() {
        state_prototype_fixed();
      }
    }
  );
}
function get_proxied_value(value) {
  try {
    if (value !== null && typeof value === "object" && STATE_SYMBOL in value) {
      return value[STATE_SYMBOL];
    }
  } catch {
  }
  return value;
}
function is(a, b) {
  return Object.is(get_proxied_value(a), get_proxied_value(b));
}
var $window;
var is_firefox;
var first_child_getter;
var next_sibling_getter;
function init_operations() {
  if ($window !== void 0) {
    return;
  }
  $window = window;
  is_firefox = /Firefox/.test(navigator.userAgent);
  var element_prototype = Element.prototype;
  var node_prototype = Node.prototype;
  var text_prototype = Text.prototype;
  first_child_getter = get_descriptor(node_prototype, "firstChild").get;
  next_sibling_getter = get_descriptor(node_prototype, "nextSibling").get;
  if (is_extensible(element_prototype)) {
    element_prototype.__click = void 0;
    element_prototype.__className = void 0;
    element_prototype.__attributes = null;
    element_prototype.__style = void 0;
    element_prototype.__e = void 0;
  }
  if (is_extensible(text_prototype)) {
    text_prototype.__t = void 0;
  }
}
function create_text(value = "") {
  return document.createTextNode(value);
}
// @__NO_SIDE_EFFECTS__
function get_first_child(node) {
  return (
    /** @type {TemplateNode | null} */
    first_child_getter.call(node)
  );
}
// @__NO_SIDE_EFFECTS__
function get_next_sibling(node) {
  return (
    /** @type {TemplateNode | null} */
    next_sibling_getter.call(node)
  );
}
function child(node, is_text) {
  {
    return /* @__PURE__ */ get_first_child(node);
  }
}
function first_child(node, is_text = false) {
  {
    var first = /* @__PURE__ */ get_first_child(node);
    if (first instanceof Comment && first.data === "") return /* @__PURE__ */ get_next_sibling(first);
    return first;
  }
}
function sibling(node, count = 1, is_text = false) {
  let next_sibling = node;
  while (count--) {
    next_sibling = /** @type {TemplateNode} */
    /* @__PURE__ */ get_next_sibling(next_sibling);
  }
  {
    return next_sibling;
  }
}
function clear_text_content(node) {
  node.textContent = "";
}
function should_defer_append() {
  return false;
}
let listening_to_form_reset = false;
function add_form_reset_listener() {
  if (!listening_to_form_reset) {
    listening_to_form_reset = true;
    document.addEventListener(
      "reset",
      (evt) => {
        Promise.resolve().then(() => {
          if (!evt.defaultPrevented) {
            for (
              const e of
              /**@type {HTMLFormElement} */
              evt.target.elements
            ) {
              e.__on_r?.();
            }
          }
        });
      },
      // In the capture phase to guarantee we get noticed of it (no possibility of stopPropagation)
      { capture: true }
    );
  }
}
function without_reactive_context(fn) {
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    return fn();
  } finally {
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
function listen_to_event_and_reset_event(element, event2, handler, on_reset = handler) {
  element.addEventListener(event2, () => without_reactive_context(handler));
  const prev = element.__on_r;
  if (prev) {
    element.__on_r = () => {
      prev();
      on_reset(true);
    };
  } else {
    element.__on_r = () => on_reset(true);
  }
  add_form_reset_listener();
}
function validate_effect(rune) {
  if (active_effect === null) {
    if (active_reaction === null) {
      effect_orphan();
    }
    effect_in_unowned_derived();
  }
  if (is_destroying_effect) {
    effect_in_teardown();
  }
}
function push_effect(effect2, parent_effect) {
  var parent_last = parent_effect.last;
  if (parent_last === null) {
    parent_effect.last = parent_effect.first = effect2;
  } else {
    parent_last.next = effect2;
    effect2.prev = parent_last;
    parent_effect.last = effect2;
  }
}
function create_effect(type, fn, sync) {
  var parent = active_effect;
  if (parent !== null && (parent.f & INERT) !== 0) {
    type |= INERT;
  }
  var effect2 = {
    ctx: component_context,
    deps: null,
    nodes: null,
    f: type | DIRTY | CONNECTED,
    first: null,
    fn,
    last: null,
    next: null,
    parent,
    b: parent && parent.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  if (sync) {
    try {
      update_effect(effect2);
      effect2.f |= EFFECT_RAN;
    } catch (e2) {
      destroy_effect(effect2);
      throw e2;
    }
  } else if (fn !== null) {
    schedule_effect(effect2);
  }
  var e = effect2;
  if (sync && e.deps === null && e.teardown === null && e.nodes === null && e.first === e.last && // either `null`, or a singular child
  (e.f & EFFECT_PRESERVED) === 0) {
    e = e.first;
    if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
      e.f |= EFFECT_TRANSPARENT;
    }
  }
  if (e !== null) {
    e.parent = parent;
    if (parent !== null) {
      push_effect(e, parent);
    }
    if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0 && (type & ROOT_EFFECT) === 0) {
      var derived2 = (
        /** @type {Derived} */
        active_reaction
      );
      (derived2.effects ?? (derived2.effects = [])).push(e);
    }
  }
  return effect2;
}
function effect_tracking() {
  return active_reaction !== null && !untracking;
}
function teardown(fn) {
  const effect2 = create_effect(RENDER_EFFECT, null, false);
  set_signal_status(effect2, CLEAN);
  effect2.teardown = fn;
  return effect2;
}
function user_effect(fn) {
  validate_effect();
  var flags2 = (
    /** @type {Effect} */
    active_effect.f
  );
  var defer = !active_reaction && (flags2 & BRANCH_EFFECT) !== 0 && (flags2 & EFFECT_RAN) === 0;
  if (defer) {
    var context = (
      /** @type {ComponentContext} */
      component_context
    );
    (context.e ?? (context.e = [])).push(fn);
  } else {
    return create_user_effect(fn);
  }
}
function create_user_effect(fn) {
  return create_effect(EFFECT | USER_EFFECT, fn, false);
}
function component_root(fn) {
  Batch.ensure();
  const effect2 = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);
  return (options = {}) => {
    return new Promise((fulfil) => {
      if (options.outro) {
        pause_effect(effect2, () => {
          destroy_effect(effect2);
          fulfil(void 0);
        });
      } else {
        destroy_effect(effect2);
        fulfil(void 0);
      }
    });
  };
}
function effect(fn) {
  return create_effect(EFFECT, fn, false);
}
function async_effect(fn) {
  return create_effect(ASYNC | EFFECT_PRESERVED, fn, true);
}
function render_effect(fn, flags2 = 0) {
  return create_effect(RENDER_EFFECT | flags2, fn, true);
}
function template_effect(fn, sync = [], async = [], blockers = []) {
  flatten(blockers, sync, async, (values) => {
    create_effect(RENDER_EFFECT, () => fn(...values.map(get)), true);
  });
}
function block(fn, flags2 = 0) {
  var effect2 = create_effect(BLOCK_EFFECT | flags2, fn, true);
  return effect2;
}
function branch(fn) {
  return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn, true);
}
function execute_effect_teardown(effect2) {
  var teardown2 = effect2.teardown;
  if (teardown2 !== null) {
    const previously_destroying_effect = is_destroying_effect;
    const previous_reaction = active_reaction;
    set_is_destroying_effect(true);
    set_active_reaction(null);
    try {
      teardown2.call(null);
    } finally {
      set_is_destroying_effect(previously_destroying_effect);
      set_active_reaction(previous_reaction);
    }
  }
}
function destroy_effect_children(signal, remove_dom = false) {
  var effect2 = signal.first;
  signal.first = signal.last = null;
  while (effect2 !== null) {
    const controller = effect2.ac;
    if (controller !== null) {
      without_reactive_context(() => {
        controller.abort(STALE_REACTION);
      });
    }
    var next = effect2.next;
    if ((effect2.f & ROOT_EFFECT) !== 0) {
      effect2.parent = null;
    } else {
      destroy_effect(effect2, remove_dom);
    }
    effect2 = next;
  }
}
function destroy_block_effect_children(signal) {
  var effect2 = signal.first;
  while (effect2 !== null) {
    var next = effect2.next;
    if ((effect2.f & BRANCH_EFFECT) === 0) {
      destroy_effect(effect2);
    }
    effect2 = next;
  }
}
function destroy_effect(effect2, remove_dom = true) {
  var removed = false;
  if ((remove_dom || (effect2.f & HEAD_EFFECT) !== 0) && effect2.nodes !== null && effect2.nodes.end !== null) {
    remove_effect_dom(
      effect2.nodes.start,
      /** @type {TemplateNode} */
      effect2.nodes.end
    );
    removed = true;
  }
  destroy_effect_children(effect2, remove_dom && !removed);
  remove_reactions(effect2, 0);
  set_signal_status(effect2, DESTROYED);
  var transitions = effect2.nodes && effect2.nodes.t;
  if (transitions !== null) {
    for (const transition of transitions) {
      transition.stop();
    }
  }
  execute_effect_teardown(effect2);
  var parent = effect2.parent;
  if (parent !== null && parent.first !== null) {
    unlink_effect(effect2);
  }
  effect2.next = effect2.prev = effect2.teardown = effect2.ctx = effect2.deps = effect2.fn = effect2.nodes = effect2.ac = null;
}
function remove_effect_dom(node, end) {
  while (node !== null) {
    var next = node === end ? null : /* @__PURE__ */ get_next_sibling(node);
    node.remove();
    node = next;
  }
}
function unlink_effect(effect2) {
  var parent = effect2.parent;
  var prev = effect2.prev;
  var next = effect2.next;
  if (prev !== null) prev.next = next;
  if (next !== null) next.prev = prev;
  if (parent !== null) {
    if (parent.first === effect2) parent.first = next;
    if (parent.last === effect2) parent.last = prev;
  }
}
function pause_effect(effect2, callback, destroy = true) {
  var transitions = [];
  pause_children(effect2, transitions, true);
  var fn = () => {
    if (destroy) destroy_effect(effect2);
    if (callback) callback();
  };
  var remaining = transitions.length;
  if (remaining > 0) {
    var check = () => --remaining || fn();
    for (var transition of transitions) {
      transition.out(check);
    }
  } else {
    fn();
  }
}
function pause_children(effect2, transitions, local) {
  if ((effect2.f & INERT) !== 0) return;
  effect2.f ^= INERT;
  var t = effect2.nodes && effect2.nodes.t;
  if (t !== null) {
    for (const transition of t) {
      if (transition.is_global || local) {
        transitions.push(transition);
      }
    }
  }
  var child2 = effect2.first;
  while (child2 !== null) {
    var sibling2 = child2.next;
    var transparent = (child2.f & EFFECT_TRANSPARENT) !== 0 || // If this is a branch effect without a block effect parent,
    // it means the parent block effect was pruned. In that case,
    // transparency information was transferred to the branch effect.
    (child2.f & BRANCH_EFFECT) !== 0 && (effect2.f & BLOCK_EFFECT) !== 0;
    pause_children(child2, transitions, transparent ? local : false);
    child2 = sibling2;
  }
}
function resume_effect(effect2) {
  resume_children(effect2, true);
}
function resume_children(effect2, local) {
  if ((effect2.f & INERT) === 0) return;
  effect2.f ^= INERT;
  if ((effect2.f & CLEAN) === 0) {
    set_signal_status(effect2, DIRTY);
    schedule_effect(effect2);
  }
  var child2 = effect2.first;
  while (child2 !== null) {
    var sibling2 = child2.next;
    var transparent = (child2.f & EFFECT_TRANSPARENT) !== 0 || (child2.f & BRANCH_EFFECT) !== 0;
    resume_children(child2, transparent ? local : false);
    child2 = sibling2;
  }
  var t = effect2.nodes && effect2.nodes.t;
  if (t !== null) {
    for (const transition of t) {
      if (transition.is_global || local) {
        transition.in();
      }
    }
  }
}
function move_effect(effect2, fragment) {
  if (!effect2.nodes) return;
  var node = effect2.nodes.start;
  var end = effect2.nodes.end;
  while (node !== null) {
    var next = node === end ? null : /* @__PURE__ */ get_next_sibling(node);
    fragment.append(node);
    node = next;
  }
}
let is_updating_effect = false;
let is_destroying_effect = false;
function set_is_destroying_effect(value) {
  is_destroying_effect = value;
}
let active_reaction = null;
let untracking = false;
function set_active_reaction(reaction) {
  active_reaction = reaction;
}
let active_effect = null;
function set_active_effect(effect2) {
  active_effect = effect2;
}
let current_sources = null;
function push_reaction_value(value) {
  if (active_reaction !== null && true) {
    if (current_sources === null) {
      current_sources = [value];
    } else {
      current_sources.push(value);
    }
  }
}
let new_deps = null;
let skipped_deps = 0;
let untracked_writes = null;
function set_untracked_writes(value) {
  untracked_writes = value;
}
let write_version = 1;
let read_version = 0;
let update_version = read_version;
function set_update_version(value) {
  update_version = value;
}
function increment_write_version() {
  return ++write_version;
}
function is_dirty(reaction) {
  var flags2 = reaction.f;
  if ((flags2 & DIRTY) !== 0) {
    return true;
  }
  if (flags2 & DERIVED) {
    reaction.f &= ~WAS_MARKED;
  }
  if ((flags2 & MAYBE_DIRTY) !== 0) {
    var dependencies = (
      /** @type {Value[]} */
      reaction.deps
    );
    var length = dependencies.length;
    for (var i = 0; i < length; i++) {
      var dependency = dependencies[i];
      if (is_dirty(
        /** @type {Derived} */
        dependency
      )) {
        update_derived(
          /** @type {Derived} */
          dependency
        );
      }
      if (dependency.wv > reaction.wv) {
        return true;
      }
    }
    if ((flags2 & CONNECTED) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    batch_values === null) {
      set_signal_status(reaction, CLEAN);
    }
  }
  return false;
}
function schedule_possible_effect_self_invalidation(signal, effect2, root2 = true) {
  var reactions = signal.reactions;
  if (reactions === null) return;
  if (current_sources !== null && includes.call(current_sources, signal)) {
    return;
  }
  for (var i = 0; i < reactions.length; i++) {
    var reaction = reactions[i];
    if ((reaction.f & DERIVED) !== 0) {
      schedule_possible_effect_self_invalidation(
        /** @type {Derived} */
        reaction,
        effect2,
        false
      );
    } else if (effect2 === reaction) {
      if (root2) {
        set_signal_status(reaction, DIRTY);
      } else if ((reaction.f & CLEAN) !== 0) {
        set_signal_status(reaction, MAYBE_DIRTY);
      }
      schedule_effect(
        /** @type {Effect} */
        reaction
      );
    }
  }
}
function update_reaction(reaction) {
  var _a2;
  var previous_deps = new_deps;
  var previous_skipped_deps = skipped_deps;
  var previous_untracked_writes = untracked_writes;
  var previous_reaction = active_reaction;
  var previous_sources = current_sources;
  var previous_component_context = component_context;
  var previous_untracking = untracking;
  var previous_update_version = update_version;
  var flags2 = reaction.f;
  new_deps = /** @type {null | Value[]} */
  null;
  skipped_deps = 0;
  untracked_writes = null;
  active_reaction = (flags2 & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;
  current_sources = null;
  set_component_context(reaction.ctx);
  untracking = false;
  update_version = ++read_version;
  if (reaction.ac !== null) {
    without_reactive_context(() => {
      reaction.ac.abort(STALE_REACTION);
    });
    reaction.ac = null;
  }
  try {
    reaction.f |= REACTION_IS_UPDATING;
    var fn = (
      /** @type {Function} */
      reaction.fn
    );
    var result = fn();
    var deps = reaction.deps;
    var is_fork = current_batch?.is_fork;
    if (new_deps !== null) {
      var i;
      if (!is_fork) {
        remove_reactions(reaction, skipped_deps);
      }
      if (deps !== null && skipped_deps > 0) {
        deps.length = skipped_deps + new_deps.length;
        for (i = 0; i < new_deps.length; i++) {
          deps[skipped_deps + i] = new_deps[i];
        }
      } else {
        reaction.deps = deps = new_deps;
      }
      if (effect_tracking() && (reaction.f & CONNECTED) !== 0) {
        for (i = skipped_deps; i < deps.length; i++) {
          ((_a2 = deps[i]).reactions ?? (_a2.reactions = [])).push(reaction);
        }
      }
    } else if (!is_fork && deps !== null && skipped_deps < deps.length) {
      remove_reactions(reaction, skipped_deps);
      deps.length = skipped_deps;
    }
    if (is_runes() && untracked_writes !== null && !untracking && deps !== null && (reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0) {
      for (i = 0; i < /** @type {Source[]} */
      untracked_writes.length; i++) {
        schedule_possible_effect_self_invalidation(
          untracked_writes[i],
          /** @type {Effect} */
          reaction
        );
      }
    }
    if (previous_reaction !== null && previous_reaction !== reaction) {
      read_version++;
      if (previous_reaction.deps !== null) {
        for (let i2 = 0; i2 < previous_skipped_deps; i2 += 1) {
          previous_reaction.deps[i2].rv = read_version;
        }
      }
      if (previous_deps !== null) {
        for (const dep of previous_deps) {
          dep.rv = read_version;
        }
      }
      if (untracked_writes !== null) {
        if (previous_untracked_writes === null) {
          previous_untracked_writes = untracked_writes;
        } else {
          previous_untracked_writes.push(.../** @type {Source[]} */
          untracked_writes);
        }
      }
    }
    if ((reaction.f & ERROR_VALUE) !== 0) {
      reaction.f ^= ERROR_VALUE;
    }
    return result;
  } catch (error) {
    return handle_error(error);
  } finally {
    reaction.f ^= REACTION_IS_UPDATING;
    new_deps = previous_deps;
    skipped_deps = previous_skipped_deps;
    untracked_writes = previous_untracked_writes;
    active_reaction = previous_reaction;
    current_sources = previous_sources;
    set_component_context(previous_component_context);
    untracking = previous_untracking;
    update_version = previous_update_version;
  }
}
function remove_reaction(signal, dependency) {
  let reactions = dependency.reactions;
  if (reactions !== null) {
    var index2 = index_of.call(reactions, signal);
    if (index2 !== -1) {
      var new_length = reactions.length - 1;
      if (new_length === 0) {
        reactions = dependency.reactions = null;
      } else {
        reactions[index2] = reactions[new_length];
        reactions.pop();
      }
    }
  }
  if (reactions === null && (dependency.f & DERIVED) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (new_deps === null || !includes.call(new_deps, dependency))) {
    var derived2 = (
      /** @type {Derived} */
      dependency
    );
    if ((derived2.f & CONNECTED) !== 0) {
      derived2.f ^= CONNECTED;
      derived2.f &= ~WAS_MARKED;
    }
    update_derived_status(derived2);
    destroy_derived_effects(derived2);
    remove_reactions(derived2, 0);
  }
}
function remove_reactions(signal, start_index) {
  var dependencies = signal.deps;
  if (dependencies === null) return;
  for (var i = start_index; i < dependencies.length; i++) {
    remove_reaction(signal, dependencies[i]);
  }
}
function update_effect(effect2) {
  var flags2 = effect2.f;
  if ((flags2 & DESTROYED) !== 0) {
    return;
  }
  set_signal_status(effect2, CLEAN);
  var previous_effect = active_effect;
  var was_updating_effect = is_updating_effect;
  active_effect = effect2;
  is_updating_effect = true;
  try {
    if ((flags2 & (BLOCK_EFFECT | MANAGED_EFFECT)) !== 0) {
      destroy_block_effect_children(effect2);
    } else {
      destroy_effect_children(effect2);
    }
    execute_effect_teardown(effect2);
    var teardown2 = update_reaction(effect2);
    effect2.teardown = typeof teardown2 === "function" ? teardown2 : null;
    effect2.wv = write_version;
    var dep;
    if (DEV && tracing_mode_flag && (effect2.f & DIRTY) !== 0 && effect2.deps !== null) ;
  } finally {
    is_updating_effect = was_updating_effect;
    active_effect = previous_effect;
  }
}
async function tick() {
  await Promise.resolve();
  flushSync();
}
function get(signal) {
  var flags2 = signal.f;
  var is_derived = (flags2 & DERIVED) !== 0;
  if (active_reaction !== null && !untracking) {
    var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;
    if (!destroyed && (current_sources === null || !includes.call(current_sources, signal))) {
      var deps = active_reaction.deps;
      if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
        if (signal.rv < read_version) {
          signal.rv = read_version;
          if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
            skipped_deps++;
          } else if (new_deps === null) {
            new_deps = [signal];
          } else {
            new_deps.push(signal);
          }
        }
      } else {
        (active_reaction.deps ?? (active_reaction.deps = [])).push(signal);
        var reactions = signal.reactions;
        if (reactions === null) {
          signal.reactions = [active_reaction];
        } else if (!includes.call(reactions, active_reaction)) {
          reactions.push(active_reaction);
        }
      }
    }
  }
  if (is_destroying_effect && old_values.has(signal)) {
    return old_values.get(signal);
  }
  if (is_derived) {
    var derived2 = (
      /** @type {Derived} */
      signal
    );
    if (is_destroying_effect) {
      var value = derived2.v;
      if ((derived2.f & CLEAN) === 0 && derived2.reactions !== null || depends_on_old_values(derived2)) {
        value = execute_derived(derived2);
      }
      old_values.set(derived2, value);
      return value;
    }
    var should_connect = (derived2.f & CONNECTED) === 0 && !untracking && active_reaction !== null && (is_updating_effect || (active_reaction.f & CONNECTED) !== 0);
    var is_new = derived2.deps === null;
    if (is_dirty(derived2)) {
      if (should_connect) {
        derived2.f |= CONNECTED;
      }
      update_derived(derived2);
    }
    if (should_connect && !is_new) {
      reconnect(derived2);
    }
  }
  if (batch_values?.has(signal)) {
    return batch_values.get(signal);
  }
  if ((signal.f & ERROR_VALUE) !== 0) {
    throw signal.v;
  }
  return signal.v;
}
function reconnect(derived2) {
  if (derived2.deps === null) return;
  derived2.f |= CONNECTED;
  for (const dep of derived2.deps) {
    (dep.reactions ?? (dep.reactions = [])).push(derived2);
    if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
      reconnect(
        /** @type {Derived} */
        dep
      );
    }
  }
}
function depends_on_old_values(derived2) {
  if (derived2.v === UNINITIALIZED) return true;
  if (derived2.deps === null) return false;
  for (const dep of derived2.deps) {
    if (old_values.has(dep)) {
      return true;
    }
    if ((dep.f & DERIVED) !== 0 && depends_on_old_values(
      /** @type {Derived} */
      dep
    )) {
      return true;
    }
  }
  return false;
}
function untrack(fn) {
  var previous_untracking = untracking;
  try {
    untracking = true;
    return fn();
  } finally {
    untracking = previous_untracking;
  }
}
const all_registered_events = /* @__PURE__ */ new Set();
const root_event_handles = /* @__PURE__ */ new Set();
function create_event(event_name, dom, handler, options = {}) {
  function target_handler(event2) {
    if (!options.capture) {
      handle_event_propagation.call(dom, event2);
    }
    if (!event2.cancelBubble) {
      return without_reactive_context(() => {
        return handler?.call(this, event2);
      });
    }
  }
  if (event_name.startsWith("pointer") || event_name.startsWith("touch") || event_name === "wheel") {
    queue_micro_task(() => {
      dom.addEventListener(event_name, target_handler, options);
    });
  } else {
    dom.addEventListener(event_name, target_handler, options);
  }
  return target_handler;
}
function event(event_name, dom, handler, capture2, passive) {
  var options = { capture: capture2, passive };
  var target_handler = create_event(event_name, dom, handler, options);
  if (dom === document.body || // @ts-ignore
  dom === window || // @ts-ignore
  dom === document || // Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
  dom instanceof HTMLMediaElement) {
    teardown(() => {
      dom.removeEventListener(event_name, target_handler, options);
    });
  }
}
function delegate(events) {
  for (var i = 0; i < events.length; i++) {
    all_registered_events.add(events[i]);
  }
  for (var fn of root_event_handles) {
    fn(events);
  }
}
let last_propagated_event = null;
function handle_event_propagation(event2) {
  var handler_element = this;
  var owner_document = (
    /** @type {Node} */
    handler_element.ownerDocument
  );
  var event_name = event2.type;
  var path = event2.composedPath?.() || [];
  var current_target = (
    /** @type {null | Element} */
    path[0] || event2.target
  );
  last_propagated_event = event2;
  var path_idx = 0;
  var handled_at = last_propagated_event === event2 && event2.__root;
  if (handled_at) {
    var at_idx = path.indexOf(handled_at);
    if (at_idx !== -1 && (handler_element === document || handler_element === /** @type {any} */
    window)) {
      event2.__root = handler_element;
      return;
    }
    var handler_idx = path.indexOf(handler_element);
    if (handler_idx === -1) {
      return;
    }
    if (at_idx <= handler_idx) {
      path_idx = at_idx;
    }
  }
  current_target = /** @type {Element} */
  path[path_idx] || event2.target;
  if (current_target === handler_element) return;
  define_property(event2, "currentTarget", {
    configurable: true,
    get() {
      return current_target || owner_document;
    }
  });
  var previous_reaction = active_reaction;
  var previous_effect = active_effect;
  set_active_reaction(null);
  set_active_effect(null);
  try {
    var throw_error;
    var other_errors = [];
    while (current_target !== null) {
      var parent_element = current_target.assignedSlot || current_target.parentNode || /** @type {any} */
      current_target.host || null;
      try {
        var delegated = current_target["__" + event_name];
        if (delegated != null && (!/** @type {any} */
        current_target.disabled || // DOM could've been updated already by the time this is reached, so we check this as well
        // -> the target could not have been disabled because it emits the event in the first place
        event2.target === current_target)) {
          delegated.call(current_target, event2);
        }
      } catch (error) {
        if (throw_error) {
          other_errors.push(error);
        } else {
          throw_error = error;
        }
      }
      if (event2.cancelBubble || parent_element === handler_element || parent_element === null) {
        break;
      }
      current_target = parent_element;
    }
    if (throw_error) {
      for (let error of other_errors) {
        queueMicrotask(() => {
          throw error;
        });
      }
      throw throw_error;
    }
  } finally {
    event2.__root = handler_element;
    delete event2.currentTarget;
    set_active_reaction(previous_reaction);
    set_active_effect(previous_effect);
  }
}
function create_fragment_from_html(html) {
  var elem = document.createElement("template");
  elem.innerHTML = html.replaceAll("<!>", "<!---->");
  return elem.content;
}
function assign_nodes(start, end) {
  var effect2 = (
    /** @type {Effect} */
    active_effect
  );
  if (effect2.nodes === null) {
    effect2.nodes = { start, end, a: null, t: null };
  }
}
// @__NO_SIDE_EFFECTS__
function from_html(content, flags2) {
  var is_fragment = (flags2 & TEMPLATE_FRAGMENT) !== 0;
  var use_import_node = (flags2 & TEMPLATE_USE_IMPORT_NODE) !== 0;
  var node;
  var has_start = !content.startsWith("<!>");
  return () => {
    if (node === void 0) {
      node = create_fragment_from_html(has_start ? content : "<!>" + content);
      if (!is_fragment) node = /** @type {TemplateNode} */
      /* @__PURE__ */ get_first_child(node);
    }
    var clone = (
      /** @type {TemplateNode} */
      use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true)
    );
    if (is_fragment) {
      var start = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ get_first_child(clone)
      );
      var end = (
        /** @type {TemplateNode} */
        clone.lastChild
      );
      assign_nodes(start, end);
    } else {
      assign_nodes(clone, clone);
    }
    return clone;
  };
}
function text(value = "") {
  {
    var t = create_text(value + "");
    assign_nodes(t, t);
    return t;
  }
}
function comment() {
  var frag = document.createDocumentFragment();
  var start = document.createComment("");
  var anchor = create_text();
  frag.append(start, anchor);
  assign_nodes(start, anchor);
  return frag;
}
function append(anchor, dom) {
  if (anchor === null) {
    return;
  }
  anchor.before(
    /** @type {Node} */
    dom
  );
}
const PASSIVE_EVENTS = ["touchstart", "touchmove"];
function is_passive_event(name) {
  return PASSIVE_EVENTS.includes(name);
}
function set_text(text2, value) {
  var str = value == null ? "" : typeof value === "object" ? value + "" : value;
  if (str !== (text2.__t ?? (text2.__t = text2.nodeValue))) {
    text2.__t = str;
    text2.nodeValue = str + "";
  }
}
function mount(component, options) {
  return _mount(component, options);
}
const document_listeners = /* @__PURE__ */ new Map();
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
  init_operations();
  var registered_events = /* @__PURE__ */ new Set();
  var event_handle = (events2) => {
    for (var i = 0; i < events2.length; i++) {
      var event_name = events2[i];
      if (registered_events.has(event_name)) continue;
      registered_events.add(event_name);
      var passive = is_passive_event(event_name);
      target.addEventListener(event_name, handle_event_propagation, { passive });
      var n = document_listeners.get(event_name);
      if (n === void 0) {
        document.addEventListener(event_name, handle_event_propagation, { passive });
        document_listeners.set(event_name, 1);
      } else {
        document_listeners.set(event_name, n + 1);
      }
    }
  };
  event_handle(array_from(all_registered_events));
  root_event_handles.add(event_handle);
  var component = void 0;
  var unmount = component_root(() => {
    var anchor_node = anchor ?? target.appendChild(create_text());
    boundary(
      /** @type {TemplateNode} */
      anchor_node,
      {
        pending: () => {
        }
      },
      (anchor_node2) => {
        if (context) {
          push({});
          var ctx = (
            /** @type {ComponentContext} */
            component_context
          );
          ctx.c = context;
        }
        if (events) {
          props.$$events = events;
        }
        component = Component(anchor_node2, props) || {};
        if (context) {
          pop();
        }
      }
    );
    return () => {
      for (var event_name of registered_events) {
        target.removeEventListener(event_name, handle_event_propagation);
        var n = (
          /** @type {number} */
          document_listeners.get(event_name)
        );
        if (--n === 0) {
          document.removeEventListener(event_name, handle_event_propagation);
          document_listeners.delete(event_name);
        } else {
          document_listeners.set(event_name, n);
        }
      }
      root_event_handles.delete(event_handle);
      if (anchor_node !== anchor) {
        anchor_node.parentNode?.removeChild(anchor_node);
      }
    };
  });
  mounted_components.set(component, unmount);
  return component;
}
let mounted_components = /* @__PURE__ */ new WeakMap();
class BranchManager {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(anchor, transition = true) {
    /** @type {TemplateNode} */
    __publicField(this, "anchor");
    /** @type {Map<Batch, Key>} */
    __privateAdd(this, _batches, /* @__PURE__ */ new Map());
    /**
     * Map of keys to effects that are currently rendered in the DOM.
     * These effects are visible and actively part of the document tree.
     * Example:
     * ```
     * {#if condition}
     * 	foo
     * {:else}
     * 	bar
     * {/if}
     * ```
     * Can result in the entries `true->Effect` and `false->Effect`
     * @type {Map<Key, Effect>}
     */
    __privateAdd(this, _onscreen, /* @__PURE__ */ new Map());
    /**
     * Similar to #onscreen with respect to the keys, but contains branches that are not yet
     * in the DOM, because their insertion is deferred.
     * @type {Map<Key, Branch>}
     */
    __privateAdd(this, _offscreen, /* @__PURE__ */ new Map());
    /**
     * Keys of effects that are currently outroing
     * @type {Set<Key>}
     */
    __privateAdd(this, _outroing, /* @__PURE__ */ new Set());
    /**
     * Whether to pause (i.e. outro) on change, or destroy immediately.
     * This is necessary for `<svelte:element>`
     */
    __privateAdd(this, _transition, true);
    __privateAdd(this, _commit, () => {
      var batch = (
        /** @type {Batch} */
        current_batch
      );
      if (!__privateGet(this, _batches).has(batch)) return;
      var key = (
        /** @type {Key} */
        __privateGet(this, _batches).get(batch)
      );
      var onscreen = __privateGet(this, _onscreen).get(key);
      if (onscreen) {
        resume_effect(onscreen);
        __privateGet(this, _outroing).delete(key);
      } else {
        var offscreen = __privateGet(this, _offscreen).get(key);
        if (offscreen) {
          __privateGet(this, _onscreen).set(key, offscreen.effect);
          __privateGet(this, _offscreen).delete(key);
          offscreen.fragment.lastChild.remove();
          this.anchor.before(offscreen.fragment);
          onscreen = offscreen.effect;
        }
      }
      for (const [b, k] of __privateGet(this, _batches)) {
        __privateGet(this, _batches).delete(b);
        if (b === batch) {
          break;
        }
        const offscreen2 = __privateGet(this, _offscreen).get(k);
        if (offscreen2) {
          destroy_effect(offscreen2.effect);
          __privateGet(this, _offscreen).delete(k);
        }
      }
      for (const [k, effect2] of __privateGet(this, _onscreen)) {
        if (k === key || __privateGet(this, _outroing).has(k)) continue;
        const on_destroy = () => {
          const keys = Array.from(__privateGet(this, _batches).values());
          if (keys.includes(k)) {
            var fragment = document.createDocumentFragment();
            move_effect(effect2, fragment);
            fragment.append(create_text());
            __privateGet(this, _offscreen).set(k, { effect: effect2, fragment });
          } else {
            destroy_effect(effect2);
          }
          __privateGet(this, _outroing).delete(k);
          __privateGet(this, _onscreen).delete(k);
        };
        if (__privateGet(this, _transition) || !onscreen) {
          __privateGet(this, _outroing).add(k);
          pause_effect(effect2, on_destroy, false);
        } else {
          on_destroy();
        }
      }
    });
    /**
     * @param {Batch} batch
     */
    __privateAdd(this, _discard, (batch) => {
      __privateGet(this, _batches).delete(batch);
      const keys = Array.from(__privateGet(this, _batches).values());
      for (const [k, branch2] of __privateGet(this, _offscreen)) {
        if (!keys.includes(k)) {
          destroy_effect(branch2.effect);
          __privateGet(this, _offscreen).delete(k);
        }
      }
    });
    this.anchor = anchor;
    __privateSet(this, _transition, transition);
  }
  /**
   *
   * @param {any} key
   * @param {null | ((target: TemplateNode) => void)} fn
   */
  ensure(key, fn) {
    var batch = (
      /** @type {Batch} */
      current_batch
    );
    var defer = should_defer_append();
    if (fn && !__privateGet(this, _onscreen).has(key) && !__privateGet(this, _offscreen).has(key)) {
      if (defer) {
        var fragment = document.createDocumentFragment();
        var target = create_text();
        fragment.append(target);
        __privateGet(this, _offscreen).set(key, {
          effect: branch(() => fn(target)),
          fragment
        });
      } else {
        __privateGet(this, _onscreen).set(
          key,
          branch(() => fn(this.anchor))
        );
      }
    }
    __privateGet(this, _batches).set(batch, key);
    if (defer) {
      for (const [k, effect2] of __privateGet(this, _onscreen)) {
        if (k === key) {
          batch.skipped_effects.delete(effect2);
        } else {
          batch.skipped_effects.add(effect2);
        }
      }
      for (const [k, branch2] of __privateGet(this, _offscreen)) {
        if (k === key) {
          batch.skipped_effects.delete(branch2.effect);
        } else {
          batch.skipped_effects.add(branch2.effect);
        }
      }
      batch.oncommit(__privateGet(this, _commit));
      batch.ondiscard(__privateGet(this, _discard));
    } else {
      __privateGet(this, _commit).call(this);
    }
  }
}
_batches = new WeakMap();
_onscreen = new WeakMap();
_offscreen = new WeakMap();
_outroing = new WeakMap();
_transition = new WeakMap();
_commit = new WeakMap();
_discard = new WeakMap();
function if_block(node, fn, elseif = false) {
  var branches = new BranchManager(node);
  var flags2 = elseif ? EFFECT_TRANSPARENT : 0;
  function update_branch(condition, fn2) {
    branches.ensure(condition, fn2);
  }
  block(() => {
    var has_branch = false;
    fn((fn2, flag = true) => {
      has_branch = true;
      update_branch(flag, fn2);
    });
    if (!has_branch) {
      update_branch(false, null);
    }
  }, flags2);
}
function index(_, i) {
  return i;
}
function pause_effects(state2, to_destroy, controlled_anchor) {
  var transitions = [];
  var length = to_destroy.length;
  var group;
  var remaining = to_destroy.length;
  for (var i = 0; i < length; i++) {
    let effect2 = to_destroy[i];
    pause_effect(
      effect2,
      () => {
        if (group) {
          group.pending.delete(effect2);
          group.done.add(effect2);
          if (group.pending.size === 0) {
            var groups = (
              /** @type {Set<EachOutroGroup>} */
              state2.outrogroups
            );
            destroy_effects(array_from(group.done));
            groups.delete(group);
            if (groups.size === 0) {
              state2.outrogroups = null;
            }
          }
        } else {
          remaining -= 1;
        }
      },
      false
    );
  }
  if (remaining === 0) {
    var fast_path = transitions.length === 0 && controlled_anchor !== null;
    if (fast_path) {
      var anchor = (
        /** @type {Element} */
        controlled_anchor
      );
      var parent_node = (
        /** @type {Element} */
        anchor.parentNode
      );
      clear_text_content(parent_node);
      parent_node.append(anchor);
      state2.items.clear();
    }
    destroy_effects(to_destroy, !fast_path);
  } else {
    group = {
      pending: new Set(to_destroy),
      done: /* @__PURE__ */ new Set()
    };
    (state2.outrogroups ?? (state2.outrogroups = /* @__PURE__ */ new Set())).add(group);
  }
}
function destroy_effects(to_destroy, remove_dom = true) {
  for (var i = 0; i < to_destroy.length; i++) {
    destroy_effect(to_destroy[i], remove_dom);
  }
}
var offscreen_anchor;
function each(node, flags2, get_collection, get_key, render_fn, fallback_fn = null) {
  var anchor = node;
  var items = /* @__PURE__ */ new Map();
  var is_controlled = (flags2 & EACH_IS_CONTROLLED) !== 0;
  if (is_controlled) {
    var parent_node = (
      /** @type {Element} */
      node
    );
    anchor = parent_node.appendChild(create_text());
  }
  var fallback = null;
  var each_array = /* @__PURE__ */ derived_safe_equal(() => {
    var collection = get_collection();
    return is_array(collection) ? collection : collection == null ? [] : array_from(collection);
  });
  var array;
  var first_run = true;
  function commit() {
    state2.fallback = fallback;
    reconcile(state2, array, anchor, flags2, get_key);
    if (fallback !== null) {
      if (array.length === 0) {
        if ((fallback.f & EFFECT_OFFSCREEN) === 0) {
          resume_effect(fallback);
        } else {
          fallback.f ^= EFFECT_OFFSCREEN;
          move(fallback, null, anchor);
        }
      } else {
        pause_effect(fallback, () => {
          fallback = null;
        });
      }
    }
  }
  var effect2 = block(() => {
    array = /** @type {V[]} */
    get(each_array);
    var length = array.length;
    var keys = /* @__PURE__ */ new Set();
    var batch = (
      /** @type {Batch} */
      current_batch
    );
    var defer = should_defer_append();
    for (var index2 = 0; index2 < length; index2 += 1) {
      var value = array[index2];
      var key = get_key(value, index2);
      var item = first_run ? null : items.get(key);
      if (item) {
        if (item.v) internal_set(item.v, value);
        if (item.i) internal_set(item.i, index2);
        if (defer) {
          batch.skipped_effects.delete(item.e);
        }
      } else {
        item = create_item(
          items,
          first_run ? anchor : offscreen_anchor ?? (offscreen_anchor = create_text()),
          value,
          key,
          index2,
          render_fn,
          flags2,
          get_collection
        );
        if (!first_run) {
          item.e.f |= EFFECT_OFFSCREEN;
        }
        items.set(key, item);
      }
      keys.add(key);
    }
    if (length === 0 && fallback_fn && !fallback) {
      if (first_run) {
        fallback = branch(() => fallback_fn(anchor));
      } else {
        fallback = branch(() => fallback_fn(offscreen_anchor ?? (offscreen_anchor = create_text())));
        fallback.f |= EFFECT_OFFSCREEN;
      }
    }
    if (!first_run) {
      if (defer) {
        for (const [key2, item2] of items) {
          if (!keys.has(key2)) {
            batch.skipped_effects.add(item2.e);
          }
        }
        batch.oncommit(commit);
        batch.ondiscard(() => {
        });
      } else {
        commit();
      }
    }
    get(each_array);
  });
  var state2 = { effect: effect2, items, outrogroups: null, fallback };
  first_run = false;
}
function skip_to_branch(effect2) {
  while (effect2 !== null && (effect2.f & BRANCH_EFFECT) === 0) {
    effect2 = effect2.next;
  }
  return effect2;
}
function reconcile(state2, array, anchor, flags2, get_key) {
  var is_animated = (flags2 & EACH_IS_ANIMATED) !== 0;
  var length = array.length;
  var items = state2.items;
  var current = skip_to_branch(state2.effect.first);
  var seen;
  var prev = null;
  var to_animate;
  var matched = [];
  var stashed = [];
  var value;
  var key;
  var effect2;
  var i;
  if (is_animated) {
    for (i = 0; i < length; i += 1) {
      value = array[i];
      key = get_key(value, i);
      effect2 = /** @type {EachItem} */
      items.get(key).e;
      if ((effect2.f & EFFECT_OFFSCREEN) === 0) {
        effect2.nodes?.a?.measure();
        (to_animate ?? (to_animate = /* @__PURE__ */ new Set())).add(effect2);
      }
    }
  }
  for (i = 0; i < length; i += 1) {
    value = array[i];
    key = get_key(value, i);
    effect2 = /** @type {EachItem} */
    items.get(key).e;
    if (state2.outrogroups !== null) {
      for (const group of state2.outrogroups) {
        group.pending.delete(effect2);
        group.done.delete(effect2);
      }
    }
    if ((effect2.f & EFFECT_OFFSCREEN) !== 0) {
      effect2.f ^= EFFECT_OFFSCREEN;
      if (effect2 === current) {
        move(effect2, null, anchor);
      } else {
        var next = prev ? prev.next : current;
        if (effect2 === state2.effect.last) {
          state2.effect.last = effect2.prev;
        }
        if (effect2.prev) effect2.prev.next = effect2.next;
        if (effect2.next) effect2.next.prev = effect2.prev;
        link(state2, prev, effect2);
        link(state2, effect2, next);
        move(effect2, next, anchor);
        prev = effect2;
        matched = [];
        stashed = [];
        current = skip_to_branch(prev.next);
        continue;
      }
    }
    if ((effect2.f & INERT) !== 0) {
      resume_effect(effect2);
      if (is_animated) {
        effect2.nodes?.a?.unfix();
        (to_animate ?? (to_animate = /* @__PURE__ */ new Set())).delete(effect2);
      }
    }
    if (effect2 !== current) {
      if (seen !== void 0 && seen.has(effect2)) {
        if (matched.length < stashed.length) {
          var start = stashed[0];
          var j;
          prev = start.prev;
          var a = matched[0];
          var b = matched[matched.length - 1];
          for (j = 0; j < matched.length; j += 1) {
            move(matched[j], start, anchor);
          }
          for (j = 0; j < stashed.length; j += 1) {
            seen.delete(stashed[j]);
          }
          link(state2, a.prev, b.next);
          link(state2, prev, a);
          link(state2, b, start);
          current = start;
          prev = b;
          i -= 1;
          matched = [];
          stashed = [];
        } else {
          seen.delete(effect2);
          move(effect2, current, anchor);
          link(state2, effect2.prev, effect2.next);
          link(state2, effect2, prev === null ? state2.effect.first : prev.next);
          link(state2, prev, effect2);
          prev = effect2;
        }
        continue;
      }
      matched = [];
      stashed = [];
      while (current !== null && current !== effect2) {
        (seen ?? (seen = /* @__PURE__ */ new Set())).add(current);
        stashed.push(current);
        current = skip_to_branch(current.next);
      }
      if (current === null) {
        continue;
      }
    }
    if ((effect2.f & EFFECT_OFFSCREEN) === 0) {
      matched.push(effect2);
    }
    prev = effect2;
    current = skip_to_branch(effect2.next);
  }
  if (state2.outrogroups !== null) {
    for (const group of state2.outrogroups) {
      if (group.pending.size === 0) {
        destroy_effects(array_from(group.done));
        state2.outrogroups?.delete(group);
      }
    }
    if (state2.outrogroups.size === 0) {
      state2.outrogroups = null;
    }
  }
  if (current !== null || seen !== void 0) {
    var to_destroy = [];
    if (seen !== void 0) {
      for (effect2 of seen) {
        if ((effect2.f & INERT) === 0) {
          to_destroy.push(effect2);
        }
      }
    }
    while (current !== null) {
      if ((current.f & INERT) === 0 && current !== state2.fallback) {
        to_destroy.push(current);
      }
      current = skip_to_branch(current.next);
    }
    var destroy_length = to_destroy.length;
    if (destroy_length > 0) {
      var controlled_anchor = (flags2 & EACH_IS_CONTROLLED) !== 0 && length === 0 ? anchor : null;
      if (is_animated) {
        for (i = 0; i < destroy_length; i += 1) {
          to_destroy[i].nodes?.a?.measure();
        }
        for (i = 0; i < destroy_length; i += 1) {
          to_destroy[i].nodes?.a?.fix();
        }
      }
      pause_effects(state2, to_destroy, controlled_anchor);
    }
  }
  if (is_animated) {
    queue_micro_task(() => {
      if (to_animate === void 0) return;
      for (effect2 of to_animate) {
        effect2.nodes?.a?.apply();
      }
    });
  }
}
function create_item(items, anchor, value, key, index2, render_fn, flags2, get_collection) {
  var v = (flags2 & EACH_ITEM_REACTIVE) !== 0 ? (flags2 & EACH_ITEM_IMMUTABLE) === 0 ? /* @__PURE__ */ mutable_source(value, false, false) : source(value) : null;
  var i = (flags2 & EACH_INDEX_REACTIVE) !== 0 ? source(index2) : null;
  return {
    v,
    i,
    e: branch(() => {
      render_fn(anchor, v ?? value, i ?? index2, get_collection);
      return () => {
        items.delete(key);
      };
    })
  };
}
function move(effect2, next, anchor) {
  if (!effect2.nodes) return;
  var node = effect2.nodes.start;
  var end = effect2.nodes.end;
  var dest = next && (next.f & EFFECT_OFFSCREEN) === 0 ? (
    /** @type {EffectNodes} */
    next.nodes.start
  ) : anchor;
  while (node !== null) {
    var next_node = (
      /** @type {TemplateNode} */
      /* @__PURE__ */ get_next_sibling(node)
    );
    dest.before(node);
    if (node === end) {
      return;
    }
    node = next_node;
  }
}
function link(state2, prev, next) {
  if (prev === null) {
    state2.effect.first = next;
  } else {
    prev.next = next;
  }
  if (next === null) {
    state2.effect.last = prev;
  } else {
    next.prev = prev;
  }
}
function append_styles(anchor, css) {
  effect(() => {
    var root2 = anchor.getRootNode();
    var target = (
      /** @type {ShadowRoot} */
      root2.host ? (
        /** @type {ShadowRoot} */
        root2
      ) : (
        /** @type {Document} */
        root2.head ?? /** @type {Document} */
        root2.ownerDocument.head
      )
    );
    if (!target.querySelector("#" + css.hash)) {
      const style = document.createElement("style");
      style.id = css.hash;
      style.textContent = css.code;
      target.appendChild(style);
    }
  });
}
const whitespace = [..." 	\n\r\f \v\uFEFF"];
function to_class(value, hash, directives) {
  var classname = value == null ? "" : "" + value;
  if (directives) {
    for (var key in directives) {
      if (directives[key]) {
        classname = classname ? classname + " " + key : key;
      } else if (classname.length) {
        var len = key.length;
        var a = 0;
        while ((a = classname.indexOf(key, a)) >= 0) {
          var b = a + len;
          if ((a === 0 || whitespace.includes(classname[a - 1])) && (b === classname.length || whitespace.includes(classname[b]))) {
            classname = (a === 0 ? "" : classname.substring(0, a)) + classname.substring(b + 1);
          } else {
            a = b;
          }
        }
      }
    }
  }
  return classname === "" ? null : classname;
}
function to_style(value, styles) {
  return value == null ? null : String(value);
}
function set_class(dom, is_html, value, hash, prev_classes, next_classes) {
  var prev = dom.__className;
  if (prev !== value || prev === void 0) {
    var next_class_name = to_class(value, hash, next_classes);
    {
      if (next_class_name == null) {
        dom.removeAttribute("class");
      } else {
        dom.className = next_class_name;
      }
    }
    dom.__className = value;
  } else if (next_classes && prev_classes !== next_classes) {
    for (var key in next_classes) {
      var is_present = !!next_classes[key];
      if (prev_classes == null || is_present !== !!prev_classes[key]) {
        dom.classList.toggle(key, is_present);
      }
    }
  }
  return next_classes;
}
function set_style(dom, value, prev_styles, next_styles) {
  var prev = dom.__style;
  if (prev !== value) {
    var next_style_attr = to_style(value);
    {
      if (next_style_attr == null) {
        dom.removeAttribute("style");
      } else {
        dom.style.cssText = next_style_attr;
      }
    }
    dom.__style = value;
  }
  return next_styles;
}
function select_option(select, value, mounting = false) {
  if (select.multiple) {
    if (value == void 0) {
      return;
    }
    if (!is_array(value)) {
      return select_multiple_invalid_value();
    }
    for (var option of select.options) {
      option.selected = value.includes(get_option_value(option));
    }
    return;
  }
  for (option of select.options) {
    var option_value = get_option_value(option);
    if (is(option_value, value)) {
      option.selected = true;
      return;
    }
  }
  if (!mounting || value !== void 0) {
    select.selectedIndex = -1;
  }
}
function init_select(select) {
  var observer = new MutationObserver(() => {
    select_option(select, select.__value);
  });
  observer.observe(select, {
    // Listen to option element changes
    childList: true,
    subtree: true,
    // because of <optgroup>
    // Listen to option element value attribute changes
    // (doesn't get notified of select value changes,
    // because that property is not reflected as an attribute)
    attributes: true,
    attributeFilter: ["value"]
  });
  teardown(() => {
    observer.disconnect();
  });
}
function bind_select_value(select, get2, set2 = get2) {
  var batches2 = /* @__PURE__ */ new WeakSet();
  var mounting = true;
  listen_to_event_and_reset_event(select, "change", (is_reset) => {
    var query = is_reset ? "[selected]" : ":checked";
    var value;
    if (select.multiple) {
      value = [].map.call(select.querySelectorAll(query), get_option_value);
    } else {
      var selected_option = select.querySelector(query) ?? // will fall back to first non-disabled option if no option is selected
      select.querySelector("option:not([disabled])");
      value = selected_option && get_option_value(selected_option);
    }
    set2(value);
    if (current_batch !== null) {
      batches2.add(current_batch);
    }
  });
  effect(() => {
    var value = get2();
    if (select === document.activeElement) {
      var batch = (
        /** @type {Batch} */
        previous_batch ?? current_batch
      );
      if (batches2.has(batch)) {
        return;
      }
    }
    select_option(select, value, mounting);
    if (mounting && value === void 0) {
      var selected_option = select.querySelector(":checked");
      if (selected_option !== null) {
        value = get_option_value(selected_option);
        set2(value);
      }
    }
    select.__value = value;
    mounting = false;
  });
  init_select(select);
}
function get_option_value(option) {
  if ("__value" in option) {
    return option.__value;
  } else {
    return option.value;
  }
}
const IS_CUSTOM_ELEMENT = Symbol("is custom element");
const IS_HTML = Symbol("is html");
function set_attribute(element, attribute, value, skip_warning) {
  var attributes = get_attributes(element);
  if (attributes[attribute] === (attributes[attribute] = value)) return;
  if (attribute === "loading") {
    element[LOADING_ATTR_SYMBOL] = value;
  }
  if (value == null) {
    element.removeAttribute(attribute);
  } else if (typeof value !== "string" && get_setters(element).includes(attribute)) {
    element[attribute] = value;
  } else {
    element.setAttribute(attribute, value);
  }
}
function get_attributes(element) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    element.__attributes ?? (element.__attributes = {
      [IS_CUSTOM_ELEMENT]: element.nodeName.includes("-"),
      [IS_HTML]: element.namespaceURI === NAMESPACE_HTML
    })
  );
}
var setters_cache = /* @__PURE__ */ new Map();
function get_setters(element) {
  var cache_key = element.getAttribute("is") || element.nodeName;
  var setters = setters_cache.get(cache_key);
  if (setters) return setters;
  setters_cache.set(cache_key, setters = []);
  var descriptors;
  var proto = element;
  var element_proto = Element.prototype;
  while (element_proto !== proto) {
    descriptors = get_descriptors(proto);
    for (var key in descriptors) {
      if (descriptors[key].set) {
        setters.push(key);
      }
    }
    proto = get_prototype_of(proto);
  }
  return setters;
}
function bind_value(input, get2, set2 = get2) {
  var batches2 = /* @__PURE__ */ new WeakSet();
  listen_to_event_and_reset_event(input, "input", async (is_reset) => {
    var value = is_reset ? input.defaultValue : input.value;
    value = is_numberlike_input(input) ? to_number(value) : value;
    set2(value);
    if (current_batch !== null) {
      batches2.add(current_batch);
    }
    await tick();
    if (value !== (value = get2())) {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var length = input.value.length;
      input.value = value ?? "";
      if (end !== null) {
        var new_length = input.value.length;
        if (start === end && end === length && new_length > length) {
          input.selectionStart = new_length;
          input.selectionEnd = new_length;
        } else {
          input.selectionStart = start;
          input.selectionEnd = Math.min(end, new_length);
        }
      }
    }
  });
  if (
    // If we are hydrating and the value has since changed,
    // then use the updated value from the input instead.
    // If defaultValue is set, then value == defaultValue
    // TODO Svelte 6: remove input.value check and set to empty string?
    untrack(get2) == null && input.value
  ) {
    set2(is_numberlike_input(input) ? to_number(input.value) : input.value);
    if (current_batch !== null) {
      batches2.add(current_batch);
    }
  }
  render_effect(() => {
    var value = get2();
    if (input === document.activeElement) {
      var batch = (
        /** @type {Batch} */
        previous_batch ?? current_batch
      );
      if (batches2.has(batch)) {
        return;
      }
    }
    if (is_numberlike_input(input) && value === to_number(input.value)) {
      return;
    }
    if (input.type === "date" && !value && !input.value) {
      return;
    }
    if (value !== input.value) {
      input.value = value ?? "";
    }
  });
}
function is_numberlike_input(input) {
  var type = input.type;
  return type === "number" || type === "range";
}
function to_number(value) {
  return value === "" ? null : +value;
}
var root_1$5 = /* @__PURE__ */ from_html(`<option> </option>`);
var root_2$4 = /* @__PURE__ */ from_html(`<option> </option>`);
var root_3$3 = /* @__PURE__ */ from_html(`<div class="attachments svelte-19knzis"><span class="attach-icon svelte-19knzis">&#x1f4ce;</span> <span class="attach-text svelte-19knzis"> </span></div>`);
var root_5$1 = /* @__PURE__ */ from_html(`<img class="form-thumb svelte-19knzis"/>`);
var root_6 = /* @__PURE__ */ from_html(`<span class="more-count svelte-19knzis"> </span>`);
var root_4$3 = /* @__PURE__ */ from_html(`<div class="screenshot-strip svelte-19knzis"><!> <!></div>`);
var root_7$1 = /* @__PURE__ */ from_html(`<div class="error svelte-19knzis"> </div>`);
var root_8$1 = /* @__PURE__ */ from_html(`<span class="spinner svelte-19knzis"></span> Submitting...`, 1);
var root$5 = /* @__PURE__ */ from_html(`<form class="form svelte-19knzis"><div class="field svelte-19knzis"><label for="title" class="svelte-19knzis">Title <span class="required svelte-19knzis">*</span></label> <input id="title" type="text" placeholder="Brief description of the issue" required class="svelte-19knzis"/></div> <div class="field svelte-19knzis"><label for="description" class="svelte-19knzis">Description</label> <textarea id="description" placeholder="Steps to reproduce, expected vs actual behavior..." rows="4" class="svelte-19knzis"></textarea></div> <div class="field-row svelte-19knzis"><div class="field half svelte-19knzis"><label for="type" class="svelte-19knzis">Type</label> <select id="type" class="svelte-19knzis"></select></div> <div class="field half svelte-19knzis"><label for="priority" class="svelte-19knzis">Priority</label> <select id="priority" class="svelte-19knzis"></select></div></div> <!> <!> <!> <div class="actions svelte-19knzis"><button type="button" class="cancel-btn svelte-19knzis">Cancel</button> <button type="submit" class="submit-btn svelte-19knzis"><!></button></div></form>`);
const $$css$5 = {
  hash: "svelte-19knzis",
  code: ".form.svelte-19knzis {display:flex;flex-direction:column;gap:12px;}.field.svelte-19knzis {display:flex;flex-direction:column;gap:4px;}.field-row.svelte-19knzis {display:flex;gap:10px;}.half.svelte-19knzis {flex:1;}label.svelte-19knzis {font-weight:600;font-size:12px;color:#374151;}.required.svelte-19knzis {color:#dc2626;}input.svelte-19knzis, textarea.svelte-19knzis, select.svelte-19knzis {padding:7px 10px;border:1px solid #d1d5db;border-radius:5px;font-size:13px;font-family:inherit;color:#1f2937;background:#fff;transition:border-color 0.15s;}input.svelte-19knzis:focus, textarea.svelte-19knzis:focus, select.svelte-19knzis:focus {outline:none;border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59, 130, 246, 0.15);}input.svelte-19knzis:disabled, textarea.svelte-19knzis:disabled, select.svelte-19knzis:disabled {opacity:0.6;cursor:not-allowed;}textarea.svelte-19knzis {resize:vertical;min-height:60px;}.attachments.svelte-19knzis {display:flex;align-items:center;gap:6px;padding:6px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;font-size:12px;color:#0369a1;}.attach-icon.svelte-19knzis {font-size:13px;}.attach-text.svelte-19knzis {flex:1;}.screenshot-strip.svelte-19knzis {display:flex;gap:4px;align-items:center;}.form-thumb.svelte-19knzis {width:56px;height:38px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;}.more-count.svelte-19knzis {font-size:11px;color:#9ca3af;padding:0 4px;}.error.svelte-19knzis {padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:5px;color:#dc2626;font-size:12px;}.actions.svelte-19knzis {display:flex;gap:8px;justify-content:flex-end;padding-top:4px;}.cancel-btn.svelte-19knzis {padding:7px 14px;background:#f9fafb;border:1px solid #d1d5db;border-radius:5px;color:#374151;font-size:13px;cursor:pointer;}.cancel-btn.svelte-19knzis:hover:not(:disabled) {background:#f3f4f6;}.cancel-btn.svelte-19knzis:disabled {opacity:0.5;cursor:not-allowed;}.submit-btn.svelte-19knzis {padding:7px 16px;background:#3b82f6;border:none;border-radius:5px;color:white;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background 0.15s;}.submit-btn.svelte-19knzis:hover:not(:disabled) {background:#2563eb;}.submit-btn.svelte-19knzis:disabled {opacity:0.6;cursor:not-allowed;}.spinner.svelte-19knzis {display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;\n    animation: svelte-19knzis-spin 0.6s linear infinite;}\n\n  @keyframes svelte-19knzis-spin {\n    to { transform: rotate(360deg); }\n  }"
};
function FeedbackForm($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css$5);
  let title = /* @__PURE__ */ state("");
  let description = /* @__PURE__ */ state("");
  let type = /* @__PURE__ */ state("bug");
  let priority = /* @__PURE__ */ state("medium");
  let submitting = /* @__PURE__ */ state(false);
  let submitError = /* @__PURE__ */ state("");
  const typeOptions = [
    { value: "bug", label: "Bug" },
    { value: "enhancement", label: "Enhancement" },
    { value: "other", label: "Other" }
  ];
  const priorityOptions = [
    { value: "low", label: "Low", desc: "Minor issue" },
    { value: "medium", label: "Medium", desc: "Notable issue" },
    { value: "high", label: "High", desc: "Major issue" },
    { value: "critical", label: "Critical", desc: "Blocking" }
  ];
  async function handleSubmit(e) {
    e.preventDefault();
    if (!get(title).trim()) return;
    set(submitting, true);
    set(submitError, "");
    try {
      const report = {
        title: get(title).trim(),
        description: get(description).trim(),
        type: get(type),
        priority: get(priority),
        url: (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url || "",
        userAgent: navigator.userAgent,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        capturedData: {
          screenshots: $$props.screenshots,
          consoleLogs: $$props.consoleLogs,
          selectedElements: $$props.selectedElements
        }
      };
      await chrome.storage.local.set({ [`bugReport_${Date.now()}`]: report });
      await chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED_DATA" });
      $$props.onclose();
    } catch (err) {
      set(submitError, err instanceof Error ? err.message : "Submission failed", true);
    } finally {
      set(submitting, false);
    }
  }
  function attachmentSummary() {
    const parts = [];
    if ($$props.screenshots.length > 0) parts.push(`${$$props.screenshots.length} screenshot${$$props.screenshots.length > 1 ? "s" : ""}`);
    if ($$props.consoleLogs.length > 0) parts.push(`${$$props.consoleLogs.length} console log${$$props.consoleLogs.length > 1 ? "s" : ""}`);
    if ($$props.selectedElements.length > 0) parts.push(`${$$props.selectedElements.length} element${$$props.selectedElements.length > 1 ? "s" : ""}`);
    return parts;
  }
  var form = root$5();
  var div = child(form);
  var input = sibling(child(div), 2);
  var div_1 = sibling(div, 2);
  var textarea = sibling(child(div_1), 2);
  var div_2 = sibling(div_1, 2);
  var div_3 = child(div_2);
  var select = sibling(child(div_3), 2);
  each(select, 21, () => typeOptions, index, ($$anchor2, opt) => {
    var option = root_1$5();
    var text2 = child(option);
    var option_value = {};
    template_effect(() => {
      set_text(text2, get(opt).label);
      if (option_value !== (option_value = get(opt).value)) {
        option.value = (option.__value = get(opt).value) ?? "";
      }
    });
    append($$anchor2, option);
  });
  var div_4 = sibling(div_3, 2);
  var select_1 = sibling(child(div_4), 2);
  each(select_1, 21, () => priorityOptions, index, ($$anchor2, opt) => {
    var option_1 = root_2$4();
    var text_1 = child(option_1);
    var option_1_value = {};
    template_effect(() => {
      set_text(text_1, `${get(opt).label ?? ""} - ${get(opt).desc ?? ""}`);
      if (option_1_value !== (option_1_value = get(opt).value)) {
        option_1.value = (option_1.__value = get(opt).value) ?? "";
      }
    });
    append($$anchor2, option_1);
  });
  var node = sibling(div_2, 2);
  {
    var consequent = ($$anchor2) => {
      var div_5 = root_3$3();
      var span = sibling(child(div_5), 2);
      var text_2 = child(span);
      template_effect(($0) => set_text(text_2, `${$0 ?? ""} attached`), [() => attachmentSummary().join(", ")]);
      append($$anchor2, div_5);
    };
    if_block(node, ($$render) => {
      if (attachmentSummary().length > 0) $$render(consequent);
    });
  }
  var node_1 = sibling(node, 2);
  {
    var consequent_2 = ($$anchor2) => {
      var div_6 = root_4$3();
      var node_2 = child(div_6);
      each(node_2, 17, () => $$props.screenshots.slice(-3), index, ($$anchor3, src, i) => {
        var img = root_5$1();
        set_attribute(img, "alt", `Attachment ${i + 1}`);
        template_effect(() => set_attribute(img, "src", get(src)));
        append($$anchor3, img);
      });
      var node_3 = sibling(node_2, 2);
      {
        var consequent_1 = ($$anchor3) => {
          var span_1 = root_6();
          var text_3 = child(span_1);
          template_effect(() => set_text(text_3, `+${$$props.screenshots.length - 3}`));
          append($$anchor3, span_1);
        };
        if_block(node_3, ($$render) => {
          if ($$props.screenshots.length > 3) $$render(consequent_1);
        });
      }
      append($$anchor2, div_6);
    };
    if_block(node_1, ($$render) => {
      if ($$props.screenshots.length > 0) $$render(consequent_2);
    });
  }
  var node_4 = sibling(node_1, 2);
  {
    var consequent_3 = ($$anchor2) => {
      var div_7 = root_7$1();
      var text_4 = child(div_7);
      template_effect(() => set_text(text_4, get(submitError)));
      append($$anchor2, div_7);
    };
    if_block(node_4, ($$render) => {
      if (get(submitError)) $$render(consequent_3);
    });
  }
  var div_8 = sibling(node_4, 2);
  var button = child(div_8);
  button.__click = function(...$$args) {
    $$props.onclose?.apply(this, $$args);
  };
  var button_1 = sibling(button, 2);
  var node_5 = child(button_1);
  {
    var consequent_4 = ($$anchor2) => {
      var fragment = root_8$1();
      append($$anchor2, fragment);
    };
    var alternate = ($$anchor2) => {
      var text_5 = text("Submit Report");
      append($$anchor2, text_5);
    };
    if_block(node_5, ($$render) => {
      if (get(submitting)) $$render(consequent_4);
      else $$render(alternate, false);
    });
  }
  template_effect(
    ($0) => {
      input.disabled = get(submitting);
      textarea.disabled = get(submitting);
      select.disabled = get(submitting);
      select_1.disabled = get(submitting);
      button.disabled = get(submitting);
      button_1.disabled = $0;
    },
    [() => get(submitting) || !get(title).trim()]
  );
  event("submit", form, handleSubmit);
  bind_value(input, () => get(title), ($$value) => set(title, $$value));
  bind_value(textarea, () => get(description), ($$value) => set(description, $$value));
  bind_select_value(select, () => get(type), ($$value) => set(type, $$value));
  bind_select_value(select_1, () => get(priority), ($$value) => set(priority, $$value));
  append($$anchor, form);
  pop();
}
delegate(["click"]);
var root_2$3 = /* @__PURE__ */ from_html(`<div class="thumb-wrapper svelte-5eponf"><img class="thumb svelte-5eponf"/> <span class="thumb-index svelte-5eponf"></span></div>`);
var root_1$4 = /* @__PURE__ */ from_html(`<div class="thumbnails svelte-5eponf"></div>`);
var root_4$2 = /* @__PURE__ */ from_html(`<div class="inline-thumb svelte-5eponf"><img class="thumb-sm svelte-5eponf" alt="Latest screenshot"/> <span class="thumb-hint svelte-5eponf">Latest capture</span></div>`);
var root$4 = /* @__PURE__ */ from_html(`<div class="preview svelte-5eponf"><button class="preview-header svelte-5eponf"><span class="preview-icon svelte-5eponf">&#x1f4f7;</span> <span class="preview-label svelte-5eponf"> </span> <span>&#x25b6;</span></button> <!></div>`);
const $$css$4 = {
  hash: "svelte-5eponf",
  code: ".preview.svelte-5eponf {margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}.preview-header.svelte-5eponf {width:100%;display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f9fafb;border:none;cursor:pointer;font-size:12px;color:#374151;text-align:left;}.preview-header.svelte-5eponf:hover {background:#f3f4f6;}.preview-icon.svelte-5eponf {font-size:13px;}.preview-label.svelte-5eponf {flex:1;font-weight:500;}.chevron.svelte-5eponf {font-size:10px;color:#9ca3af;transition:transform 0.15s;}.chevron.open.svelte-5eponf {transform:rotate(90deg);}.thumbnails.svelte-5eponf {display:flex;gap:6px;padding:8px;overflow-x:auto;background:#fff;}.thumb-wrapper.svelte-5eponf {position:relative;flex-shrink:0;}.thumb.svelte-5eponf {width:100px;height:70px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;}.thumb-index.svelte-5eponf {position:absolute;top:2px;left:2px;background:rgba(0,0,0,0.6);color:white;font-size:9px;padding:1px 4px;border-radius:3px;}.inline-thumb.svelte-5eponf {display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;}.thumb-sm.svelte-5eponf {width:48px;height:32px;object-fit:cover;border-radius:3px;border:1px solid #e5e7eb;}.thumb-hint.svelte-5eponf {font-size:11px;color:#9ca3af;}"
};
function ScreenshotPreview($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css$4);
  let expanded = /* @__PURE__ */ state(false);
  user_effect(() => {
    if ($$props.screenshots.length === 0) set(expanded, false);
  });
  var div = root$4();
  var button = child(div);
  button.__click = () => {
    set(expanded, !get(expanded));
  };
  var span = sibling(child(button), 2);
  var text2 = child(span);
  var span_1 = sibling(span, 2);
  let classes;
  var node = sibling(button, 2);
  {
    var consequent = ($$anchor2) => {
      var div_1 = root_1$4();
      each(div_1, 21, () => $$props.screenshots, index, ($$anchor3, src, i) => {
        var div_2 = root_2$3();
        var img = child(div_2);
        set_attribute(img, "alt", `Screenshot ${i + 1}`);
        var span_2 = sibling(img, 2);
        span_2.textContent = i + 1;
        template_effect(() => set_attribute(img, "src", get(src)));
        append($$anchor3, div_2);
      });
      append($$anchor2, div_1);
    };
    var alternate = ($$anchor2) => {
      var fragment = comment();
      var node_1 = first_child(fragment);
      {
        var consequent_1 = ($$anchor3) => {
          var div_3 = root_4$2();
          var img_1 = child(div_3);
          template_effect(() => set_attribute(img_1, "src", $$props.screenshots[$$props.screenshots.length - 1]));
          append($$anchor3, div_3);
        };
        if_block(
          node_1,
          ($$render) => {
            if ($$props.screenshots.length > 0) $$render(consequent_1);
          },
          true
        );
      }
      append($$anchor2, fragment);
    };
    if_block(node, ($$render) => {
      if (get(expanded)) $$render(consequent);
      else $$render(alternate, false);
    });
  }
  template_effect(() => {
    set_text(text2, `Screenshots (${$$props.screenshots.length ?? ""})`);
    classes = set_class(span_1, 1, "chevron svelte-5eponf", null, classes, { open: get(expanded) });
  });
  append($$anchor, div);
  pop();
}
delegate(["click"]);
var root_3$2 = /* @__PURE__ */ from_html(`<div class="element-text svelte-inaxlf"> </div>`);
var root_4$1 = /* @__PURE__ */ from_html(`<code class="meta-selector svelte-inaxlf"> </code>`);
var root_5 = /* @__PURE__ */ from_html(`<img class="element-thumb svelte-inaxlf"/>`);
var root_2$2 = /* @__PURE__ */ from_html(`<div class="element-item svelte-inaxlf"><div class="element-tag svelte-inaxlf"><code class="svelte-inaxlf"> </code></div> <!> <div class="element-meta svelte-inaxlf"><span class="meta-item svelte-inaxlf"> </span> <!></div> <!></div>`);
var root_1$3 = /* @__PURE__ */ from_html(`<div class="elements-list svelte-inaxlf"></div>`);
var root_8 = /* @__PURE__ */ from_html(`<span class="text-inline svelte-inaxlf"> </span>`);
var root_7 = /* @__PURE__ */ from_html(`<div class="inline-preview svelte-inaxlf"><code class="tag-inline svelte-inaxlf"> </code> <!></div>`);
var root$3 = /* @__PURE__ */ from_html(`<div class="preview svelte-inaxlf"><button class="preview-header svelte-inaxlf"><span class="preview-icon svelte-inaxlf">&#x1f3af;</span> <span class="preview-label svelte-inaxlf"> </span> <span>&#x25b6;</span></button> <!></div>`);
const $$css$3 = {
  hash: "svelte-inaxlf",
  code: ".preview.svelte-inaxlf {margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}.preview-header.svelte-inaxlf {width:100%;display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f9fafb;border:none;cursor:pointer;font-size:12px;color:#374151;text-align:left;}.preview-header.svelte-inaxlf:hover {background:#f3f4f6;}.preview-icon.svelte-inaxlf {font-size:13px;}.preview-label.svelte-inaxlf {flex:1;font-weight:500;}.chevron.svelte-inaxlf {font-size:10px;color:#9ca3af;transition:transform 0.15s;}.chevron.open.svelte-inaxlf {transform:rotate(90deg);}.elements-list.svelte-inaxlf {padding:8px;background:#fff;display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto;}.element-item.svelte-inaxlf {padding:6px 8px;border:1px solid #e5e7eb;border-radius:4px;background:#fafafa;}.element-tag.svelte-inaxlf {margin-bottom:2px;}.element-tag.svelte-inaxlf code:where(.svelte-inaxlf) {font-size:12px;color:#7c3aed;background:#f5f3ff;padding:1px 4px;border-radius:3px;}.element-text.svelte-inaxlf {font-size:11px;color:#6b7280;margin-bottom:4px;}.element-meta.svelte-inaxlf {display:flex;gap:8px;align-items:center;font-size:10px;}.meta-item.svelte-inaxlf {color:#9ca3af;}.meta-selector.svelte-inaxlf {color:#9ca3af;font-size:10px;background:#f3f4f6;padding:1px 3px;border-radius:2px;}.element-thumb.svelte-inaxlf {margin-top:4px;max-width:100%;max-height:60px;object-fit:contain;border-radius:3px;border:1px solid #e5e7eb;}.inline-preview.svelte-inaxlf {display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;}.tag-inline.svelte-inaxlf {font-size:12px;color:#7c3aed;background:#f5f3ff;padding:1px 4px;border-radius:3px;}.text-inline.svelte-inaxlf {font-size:11px;color:#9ca3af;}"
};
function ElementPreview($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css$3);
  let expanded = /* @__PURE__ */ state(false);
  var div = root$3();
  var button = child(div);
  button.__click = () => {
    set(expanded, !get(expanded));
  };
  var span = sibling(child(button), 2);
  var text2 = child(span);
  var span_1 = sibling(span, 2);
  let classes;
  var node = sibling(button, 2);
  {
    var consequent_3 = ($$anchor2) => {
      var div_1 = root_1$3();
      each(div_1, 21, () => $$props.elements, index, ($$anchor3, el, i) => {
        var div_2 = root_2$2();
        var div_3 = child(div_2);
        var code = child(div_3);
        var text_1 = child(code);
        var node_1 = sibling(div_3, 2);
        {
          var consequent = ($$anchor4) => {
            var div_4 = root_3$2();
            var text_2 = child(div_4);
            template_effect(($0) => set_text(text_2, `${$0 ?? ""}${get(el).textContent.length > 60 ? "..." : ""}`), [() => get(el).textContent.slice(0, 60)]);
            append($$anchor4, div_4);
          };
          if_block(node_1, ($$render) => {
            if (get(el).textContent) $$render(consequent);
          });
        }
        var div_5 = sibling(node_1, 2);
        var span_2 = child(div_5);
        var text_3 = child(span_2);
        var node_2 = sibling(span_2, 2);
        {
          var consequent_1 = ($$anchor4) => {
            var code_1 = root_4$1();
            var text_4 = child(code_1);
            template_effect(
              ($0) => {
                set_attribute(code_1, "title", get(el).selector);
                set_text(text_4, $0);
              },
              [
                () => get(el).selector.length > 40 ? get(el).selector.slice(0, 40) + "..." : get(el).selector
              ]
            );
            append($$anchor4, code_1);
          };
          if_block(node_2, ($$render) => {
            if (get(el).selector) $$render(consequent_1);
          });
        }
        var node_3 = sibling(div_5, 2);
        {
          var consequent_2 = ($$anchor4) => {
            var img = root_5();
            set_attribute(img, "alt", `Element ${i + 1}`);
            template_effect(() => set_attribute(img, "src", get(el).screenshot));
            append($$anchor4, img);
          };
          if_block(node_3, ($$render) => {
            if (get(el).screenshot) $$render(consequent_2);
          });
        }
        template_effect(
          ($0, $1, $2, $3) => {
            set_text(text_1, `<${$0 ?? ""}${get(el).id ? `#${get(el).id}` : ""}${$1 ?? ""}>`);
            set_text(text_3, `${$2 ?? ""}x${$3 ?? ""}`);
          },
          [
            () => get(el).tagName.toLowerCase(),
            () => get(el).className ? `.${get(el).className.split(" ")[0]}` : "",
            () => Math.round(get(el).boundingRect.width),
            () => Math.round(get(el).boundingRect.height)
          ]
        );
        append($$anchor3, div_2);
      });
      append($$anchor2, div_1);
    };
    var alternate = ($$anchor2) => {
      var fragment = comment();
      var node_4 = first_child(fragment);
      {
        var consequent_5 = ($$anchor3) => {
          const latest = /* @__PURE__ */ user_derived(() => $$props.elements[$$props.elements.length - 1]);
          var div_6 = root_7();
          var code_2 = child(div_6);
          var text_5 = child(code_2);
          var node_5 = sibling(code_2, 2);
          {
            var consequent_4 = ($$anchor4) => {
              var span_3 = root_8();
              var text_6 = child(span_3);
              template_effect(($0) => set_text(text_6, `${$0 ?? ""}...`), [() => get(latest).textContent.slice(0, 30)]);
              append($$anchor4, span_3);
            };
            if_block(node_5, ($$render) => {
              if (get(latest).textContent) $$render(consequent_4);
            });
          }
          template_effect(($0) => set_text(text_5, `<${$0 ?? ""}>`), [() => get(latest).tagName.toLowerCase()]);
          append($$anchor3, div_6);
        };
        if_block(
          node_4,
          ($$render) => {
            if ($$props.elements.length > 0) $$render(consequent_5);
          },
          true
        );
      }
      append($$anchor2, fragment);
    };
    if_block(node, ($$render) => {
      if (get(expanded)) $$render(consequent_3);
      else $$render(alternate, false);
    });
  }
  template_effect(() => {
    set_text(text2, `Selected Elements (${$$props.elements.length ?? ""})`);
    classes = set_class(span_1, 1, "chevron svelte-inaxlf", null, classes, { open: get(expanded) });
  });
  append($$anchor, div);
  pop();
}
delegate(["click"]);
var root_1$2 = /* @__PURE__ */ from_html(`<span class="badge svelte-1mjkfxc"> </span>`);
var root_4 = /* @__PURE__ */ from_html(`<div class="log-source svelte-1mjkfxc"> </div>`);
var root_3$1 = /* @__PURE__ */ from_html(`<div class="log-entry svelte-1mjkfxc"><div class="log-header svelte-1mjkfxc"><span class="log-type svelte-1mjkfxc"> </span> <span class="log-time svelte-1mjkfxc"> </span></div> <div class="log-message svelte-1mjkfxc"> </div> <!></div>`);
var root_2$1 = /* @__PURE__ */ from_html(`<div class="logs-list svelte-1mjkfxc"></div>`);
var root$2 = /* @__PURE__ */ from_html(`<div class="preview svelte-1mjkfxc"><button class="preview-header svelte-1mjkfxc"><span class="preview-icon svelte-1mjkfxc">&#x1f41b;</span> <span class="preview-label svelte-1mjkfxc"> </span> <div class="type-badges svelte-1mjkfxc"></div> <span>&#x25b6;</span></button> <!></div>`);
const $$css$2 = {
  hash: "svelte-1mjkfxc",
  code: ".preview.svelte-1mjkfxc {margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}.preview-header.svelte-1mjkfxc {width:100%;display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f9fafb;border:none;cursor:pointer;font-size:12px;color:#374151;text-align:left;}.preview-header.svelte-1mjkfxc:hover {background:#f3f4f6;}.preview-icon.svelte-1mjkfxc {font-size:13px;}.preview-label.svelte-1mjkfxc {font-weight:500;white-space:nowrap;}.type-badges.svelte-1mjkfxc {display:flex;gap:3px;flex:1;justify-content:flex-end;flex-wrap:wrap;}.badge.svelte-1mjkfxc {font-size:9px;padding:1px 5px;border-radius:3px;font-weight:500;}.chevron.svelte-1mjkfxc {font-size:10px;color:#9ca3af;transition:transform 0.15s;flex-shrink:0;}.chevron.open.svelte-1mjkfxc {transform:rotate(90deg);}.logs-list.svelte-1mjkfxc {max-height:250px;overflow-y:auto;background:#fff;padding:4px;}.log-entry.svelte-1mjkfxc {padding:4px 8px;border-left:3px solid #d1d5db;margin-bottom:2px;font-size:11px;font-family:'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;}.log-header.svelte-1mjkfxc {display:flex;justify-content:space-between;margin-bottom:1px;}.log-type.svelte-1mjkfxc {font-weight:600;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;}.log-time.svelte-1mjkfxc {color:#9ca3af;font-size:10px;}.log-message.svelte-1mjkfxc {color:#374151;word-break:break-word;white-space:pre-wrap;}.log-source.svelte-1mjkfxc {color:#9ca3af;font-size:10px;margin-top:1px;}"
};
function ConsoleLogPreview($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css$2);
  let expanded = /* @__PURE__ */ state(false);
  const typeColors = {
    error: { bg: "#fef2f2", text: "#dc2626" },
    warn: { bg: "#fffbeb", text: "#d97706" },
    log: { bg: "#f9fafb", text: "#374151" },
    info: { bg: "#eff6ff", text: "#2563eb" },
    debug: { bg: "#f5f3ff", text: "#7c3aed" },
    trace: { bg: "#f0fdf4", text: "#16a34a" }
  };
  function getColor(type) {
    return typeColors[type] || typeColors.log;
  }
  function typeCounts(entries) {
    const counts = {};
    for (const e of entries) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }
  function formatTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  }
  var div = root$2();
  var button = child(div);
  button.__click = () => {
    set(expanded, !get(expanded));
  };
  var span = sibling(child(button), 2);
  var text2 = child(span);
  var div_1 = sibling(span, 2);
  each(div_1, 21, () => Object.entries(typeCounts($$props.logs)), index, ($$anchor2, $$item) => {
    var $$array = /* @__PURE__ */ user_derived(() => to_array(get($$item), 2));
    let type = () => get($$array)[0];
    let count = () => get($$array)[1];
    var span_1 = root_1$2();
    var text_1 = child(span_1);
    template_effect(
      ($0, $1) => {
        set_style(span_1, `background: ${$0 ?? ""}; color: ${$1 ?? ""}`);
        set_text(text_1, `${count() ?? ""} ${type() ?? ""}`);
      },
      [() => getColor(type()).bg, () => getColor(type()).text]
    );
    append($$anchor2, span_1);
  });
  var span_2 = sibling(div_1, 2);
  let classes;
  var node = sibling(button, 2);
  {
    var consequent_1 = ($$anchor2) => {
      var div_2 = root_2$1();
      each(div_2, 21, () => $$props.logs, index, ($$anchor3, entry) => {
        var div_3 = root_3$1();
        var div_4 = child(div_3);
        var span_3 = child(div_4);
        var text_2 = child(span_3);
        var span_4 = sibling(span_3, 2);
        var text_3 = child(span_4);
        var div_5 = sibling(div_4, 2);
        var text_4 = child(div_5);
        var node_1 = sibling(div_5, 2);
        {
          var consequent = ($$anchor4) => {
            var div_6 = root_4();
            var text_5 = child(div_6);
            template_effect(() => set_text(text_5, `${get(entry).fileName ?? ""}${get(entry).lineNumber ? `:${get(entry).lineNumber}` : ""}`));
            append($$anchor4, div_6);
          };
          if_block(node_1, ($$render) => {
            if (get(entry).fileName) $$render(consequent);
          });
        }
        template_effect(
          ($0, $1, $2, $3) => {
            set_style(div_3, `border-left-color: ${$0 ?? ""}`);
            set_style(span_3, `color: ${$1 ?? ""}`);
            set_text(text_2, get(entry).type);
            set_text(text_3, $2);
            set_text(text_4, `${$3 ?? ""}${get(entry).message.length > 200 ? "..." : ""}`);
          },
          [
            () => getColor(get(entry).type).text,
            () => getColor(get(entry).type).text,
            () => formatTime(get(entry).timestamp),
            () => get(entry).message.slice(0, 200)
          ]
        );
        append($$anchor3, div_3);
      });
      append($$anchor2, div_2);
    };
    if_block(node, ($$render) => {
      if (get(expanded)) $$render(consequent_1);
    });
  }
  template_effect(() => {
    set_text(text2, `Console Logs (${$$props.logs.length ?? ""})`);
    classes = set_class(span_2, 1, "chevron svelte-1mjkfxc", null, classes, { open: get(expanded) });
  });
  append($$anchor, div);
  pop();
}
delegate(["click"]);
let capturedData = proxy({
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
});
async function loadCapturedData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_ALL_CAPTURED_DATA" });
    if (response?.success && response.data) {
      capturedData.screenshots = response.data.screenshots || [];
      capturedData.consoleLogs = response.data.consoleLogs || [];
      capturedData.networkRequests = response.data.networkRequests || [];
      capturedData.selectedElements = response.data.selectedElements || [];
    }
  } catch (err) {
    console.error("Failed to load captured data:", err);
  }
}
async function clearAllData() {
  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED_DATA" });
    capturedData.screenshots = [];
    capturedData.consoleLogs = [];
    capturedData.networkRequests = [];
    capturedData.selectedElements = [];
  } catch (err) {
    console.error("Failed to clear data:", err);
  }
}
var root_1$1 = /* @__PURE__ */ from_html(`<div> </div>`);
var root$1 = /* @__PURE__ */ from_html(`<section class="actions svelte-1dw3jt8"><div class="action-group svelte-1dw3jt8"><span class="group-label svelte-1dw3jt8">Screenshot</span> <div class="action-grid svelte-1dw3jt8"><button class="action-btn primary svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x1f4f8;</span> Visible Area</button> <button class="action-btn primary svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x1f4dc;</span> Full Page</button> <button class="action-btn svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x1f3af;</span> Element</button> <button class="action-btn svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x270f;&#xfe0f;</span> Annotate</button></div></div> <div class="action-group svelte-1dw3jt8"><span class="group-label svelte-1dw3jt8">Capture Data</span> <div class="action-grid svelte-1dw3jt8"><button class="action-btn svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x1f41b;</span> Console Logs</button> <button class="action-btn svelte-1dw3jt8"><span class="icon svelte-1dw3jt8">&#x1f310;</span> Network Logs</button></div></div> <!></section>`);
const $$css$1 = {
  hash: "svelte-1dw3jt8",
  code: ".actions.svelte-1dw3jt8 {margin-bottom:12px;}.action-group.svelte-1dw3jt8 {margin-bottom:10px;}.group-label.svelte-1dw3jt8 {display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;}.action-grid.svelte-1dw3jt8 {display:grid;grid-template-columns:1fr 1fr;gap:6px;}.action-btn.svelte-1dw3jt8 {padding:9px 6px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#374151;font-size:12px;text-align:center;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:4px;}.action-btn.svelte-1dw3jt8:hover {background:#f3f4f6;border-color:#9ca3af;}.action-btn.primary.svelte-1dw3jt8 {background:#3b82f6;border-color:#3b82f6;color:white;}.action-btn.primary.svelte-1dw3jt8:hover {background:#2563eb;border-color:#2563eb;}.icon.svelte-1dw3jt8 {font-size:13px;}.status.svelte-1dw3jt8 {margin-top:8px;padding:6px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;font-size:12px;color:#0369a1;}.status.error.svelte-1dw3jt8 {background:#fef2f2;border-color:#fecaca;color:#dc2626;}"
};
function CaptureActions($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css$1);
  let status = /* @__PURE__ */ state(null);
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  function showStatus(message, isError = false) {
    set(status, { message, isError }, true);
    setTimeout(
      () => {
        set(status, null);
      },
      3e3
    );
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  async function captureVisible() {
    try {
      showStatus("Capturing visible area...");
      const tab = await getCurrentTab();
      if (!tab.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_SCREENSHOT", options: { type: "visible" } });
      if (response?.success) {
        const size = response.size ? ` (${formatBytes(response.size)})` : "";
        showStatus(`Visible area captured${size}!`);
        await loadCapturedData();
      } else {
        throw new Error(response?.error || "Capture failed");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  async function captureFullPage() {
    try {
      showStatus("Capturing full page...");
      const tab = await getCurrentTab();
      if (!tab.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_SCREENSHOT", options: { type: "fullpage" } });
      if (response?.success) {
        const dims = response.width && response.height ? ` ${response.width}x${response.height}` : "";
        showStatus(`Full page captured${dims}!`);
        await loadCapturedData();
      } else {
        throw new Error(response?.error || "Capture failed");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  async function captureElement() {
    try {
      showStatus("Click an element to capture...");
      const tab = await getCurrentTab();
      if (!tab.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "START_ELEMENT_SCREENSHOT" });
      if (response?.success) {
        window.close();
      } else {
        throw new Error(response?.error || "Element picker failed");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  async function annotate() {
    try {
      showStatus("Opening annotation editor...");
      const tab = await getCurrentTab();
      if (!tab.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "OPEN_ANNOTATION_EDITOR" });
      if (response?.success) {
        window.close();
      } else {
        throw new Error(response?.error || "No screenshot to annotate");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  async function captureConsoleLogs() {
    try {
      showStatus("Capturing console logs...");
      const tab = await getCurrentTab();
      if (!tab.id) throw new Error("No active tab");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_CONSOLE_LOGS" });
      if (response?.success) {
        showStatus(`Captured ${response.logsCount || 0} console logs!`);
        await loadCapturedData();
      } else {
        throw new Error(response?.error || "Capture failed");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  async function captureNetworkLogs() {
    try {
      showStatus("Capturing network logs...");
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_NETWORK_LOGS" });
      if (response?.success) {
        showStatus(`Captured ${response.requestsCount || 0} network requests!`);
        await loadCapturedData();
      } else {
        throw new Error(response?.error || "Capture failed");
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`, true);
    }
  }
  var section = root$1();
  var div = child(section);
  var div_1 = sibling(child(div), 2);
  var button = child(div_1);
  button.__click = captureVisible;
  var button_1 = sibling(button, 2);
  button_1.__click = captureFullPage;
  var button_2 = sibling(button_1, 2);
  button_2.__click = captureElement;
  var button_3 = sibling(button_2, 2);
  button_3.__click = annotate;
  var div_2 = sibling(div, 2);
  var div_3 = sibling(child(div_2), 2);
  var button_4 = child(div_3);
  button_4.__click = captureConsoleLogs;
  var button_5 = sibling(button_4, 2);
  button_5.__click = captureNetworkLogs;
  var node = sibling(div_2, 2);
  {
    var consequent = ($$anchor2) => {
      var div_4 = root_1$1();
      let classes;
      var text2 = child(div_4);
      template_effect(() => {
        classes = set_class(div_4, 1, "status svelte-1dw3jt8", null, classes, { error: get(status).isError });
        set_text(text2, get(status).message);
      });
      append($$anchor2, div_4);
    };
    if_block(node, ($$render) => {
      if (get(status)) $$render(consequent);
    });
  }
  append($$anchor, section);
  pop();
}
delegate(["click"]);
var root_1 = /* @__PURE__ */ from_html(`<button class="back-btn svelte-2iqjbh">&larr; Back</button>`);
var root_3 = /* @__PURE__ */ from_html(`<div class="captured-section svelte-2iqjbh"><div class="section-header svelte-2iqjbh"><span class="section-title svelte-2iqjbh">Captured Data</span> <button class="clear-btn svelte-2iqjbh">Clear All</button></div> <!> <!> <!></div>`);
var root_2 = /* @__PURE__ */ from_html(`<!> <!> <div class="report-section svelte-2iqjbh"><button class="report-btn svelte-2iqjbh">Create Bug Report</button></div> <footer class="footer svelte-2iqjbh"><button class="settings-link svelte-2iqjbh">Settings</button></footer>`, 1);
var root = /* @__PURE__ */ from_html(`<div class="popup svelte-2iqjbh"><header class="header svelte-2iqjbh"><div class="logo svelte-2iqjbh">J</div> <h1 class="title svelte-2iqjbh">JAT Bug Reporter</h1> <!></header> <!></div>`);
const $$css = {
  hash: "svelte-2iqjbh",
  code: "body {width:420px;margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;font-size:14px;background-color:#ffffff;color:#1f2937;}.popup.svelte-2iqjbh {padding:16px;min-height:200px;}.header.svelte-2iqjbh {display:flex;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;}.logo.svelte-2iqjbh {width:28px;height:28px;margin-right:10px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0;}.title.svelte-2iqjbh {font-size:15px;font-weight:600;margin:0;flex:1;}.back-btn.svelte-2iqjbh {padding:4px 10px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;color:#374151;font-size:12px;cursor:pointer;}.back-btn.svelte-2iqjbh:hover {background:#f3f4f6;}.captured-section.svelte-2iqjbh {margin-bottom:12px;}.section-header.svelte-2iqjbh {display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}.section-title.svelte-2iqjbh {font-weight:600;font-size:13px;color:#374151;}.clear-btn.svelte-2iqjbh {padding:2px 8px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#6b7280;font-size:11px;cursor:pointer;}.clear-btn.svelte-2iqjbh:hover {background:#fef2f2;border-color:#fca5a5;color:#dc2626;}.report-section.svelte-2iqjbh {margin-bottom:12px;}.report-btn.svelte-2iqjbh {width:100%;padding:10px;background:#3b82f6;border:none;border-radius:6px;color:white;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;}.report-btn.svelte-2iqjbh:hover {background:#2563eb;}.footer.svelte-2iqjbh {text-align:center;padding-top:8px;border-top:1px solid #f3f4f6;}.settings-link.svelte-2iqjbh {color:#6b7280;font-size:12px;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;}.settings-link.svelte-2iqjbh:hover {color:#374151;text-decoration:underline;}"
};
function App($$anchor, $$props) {
  push($$props, true);
  append_styles($$anchor, $$css);
  let view = /* @__PURE__ */ state("main");
  user_effect(() => {
    loadCapturedData();
  });
  function openForm() {
    set(view, "form");
  }
  function closeForm() {
    set(view, "form");
    loadCapturedData();
    set(view, "main");
  }
  async function handleClear() {
    await clearAllData();
  }
  var div = root();
  var header = child(div);
  var node = sibling(child(header), 4);
  {
    var consequent = ($$anchor2) => {
      var button = root_1();
      button.__click = () => {
        set(view, "main");
      };
      append($$anchor2, button);
    };
    if_block(node, ($$render) => {
      if (get(view) === "form") $$render(consequent);
    });
  }
  var node_1 = sibling(header, 2);
  {
    var consequent_5 = ($$anchor2) => {
      var fragment = root_2();
      var node_2 = first_child(fragment);
      CaptureActions(node_2, {});
      var node_3 = sibling(node_2, 2);
      {
        var consequent_4 = ($$anchor3) => {
          var div_1 = root_3();
          var div_2 = child(div_1);
          var button_1 = sibling(child(div_2), 2);
          button_1.__click = handleClear;
          var node_4 = sibling(div_2, 2);
          {
            var consequent_1 = ($$anchor4) => {
              ScreenshotPreview($$anchor4, {
                get screenshots() {
                  return capturedData.screenshots;
                }
              });
            };
            if_block(node_4, ($$render) => {
              if (capturedData.screenshots.length > 0) $$render(consequent_1);
            });
          }
          var node_5 = sibling(node_4, 2);
          {
            var consequent_2 = ($$anchor4) => {
              ElementPreview($$anchor4, {
                get elements() {
                  return capturedData.selectedElements;
                }
              });
            };
            if_block(node_5, ($$render) => {
              if (capturedData.selectedElements.length > 0) $$render(consequent_2);
            });
          }
          var node_6 = sibling(node_5, 2);
          {
            var consequent_3 = ($$anchor4) => {
              ConsoleLogPreview($$anchor4, {
                get logs() {
                  return capturedData.consoleLogs;
                }
              });
            };
            if_block(node_6, ($$render) => {
              if (capturedData.consoleLogs.length > 0) $$render(consequent_3);
            });
          }
          append($$anchor3, div_1);
        };
        if_block(node_3, ($$render) => {
          if (capturedData.screenshots.length > 0 || capturedData.selectedElements.length > 0 || capturedData.consoleLogs.length > 0) $$render(consequent_4);
        });
      }
      var div_3 = sibling(node_3, 2);
      var button_2 = child(div_3);
      button_2.__click = openForm;
      var footer = sibling(div_3, 2);
      var button_3 = child(footer);
      button_3.__click = () => {
        chrome.runtime.openOptionsPage?.();
      };
      append($$anchor2, fragment);
    };
    var alternate = ($$anchor2) => {
      FeedbackForm($$anchor2, {
        get screenshots() {
          return capturedData.screenshots;
        },
        get consoleLogs() {
          return capturedData.consoleLogs;
        },
        get selectedElements() {
          return capturedData.selectedElements;
        },
        onclose: closeForm
      });
    };
    if_block(node_1, ($$render) => {
      if (get(view) === "main") $$render(consequent_5);
      else $$render(alternate, false);
    });
  }
  append($$anchor, div);
  pop();
}
delegate(["click"]);
mount(App, { target: document.getElementById("app") });
