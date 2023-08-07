
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.55.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let style;
    	let t1;
    	let title;
    	let t3;
    	let div8;
    	let h1;
    	let t5;
    	let div1;
    	let textarea;
    	let t6;
    	let button;
    	let t8;
    	let div0;
    	let t9;
    	let div7;
    	let div2;
    	let t10;
    	let div3;
    	let t11;
    	let div4;
    	let t12;
    	let div5;
    	let t13;
    	let div6;
    	let t14;
    	let script;

    	const block = {
    		c: function create() {
    			main = element("main");
    			style = element("style");
    			style.textContent = ".adverb {\n  background: #c4e3f3;\n}\n\n.qualifier {\n  background: #c4e3f3;\n}\n\n.passive {\n  background: #c4ed9d;\n}\n\n.complex {\n  background: #e3b7e8;\n}\n\n.hardSentence {\n  background: #f7ecb5;\n}\n\n.veryHardSentence {\n  background: #e4b9b9;\n}\n\n#text-area,\n#output {\n  width: 100%;\n}\n\n#left {\n  width: 75%;\n  position: absolute;\n  left: 2.5%;\n}\n#right {\n  width: 20%;\n  position: absolute;\n  right: 2.5%;\n}\n\n.counter {\n  position: relative;\n  padding: 5% 5%;\n  margin: 5% 0 0 5%;\n  border-radius: 8px;\n}";
    			t1 = space();
    			title = element("title");
    			title.textContent = "Hemingway Clone";
    			t3 = space();
    			div8 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Hemingway Editor Clone";
    			t5 = space();
    			div1 = element("div");
    			textarea = element("textarea");
    			t6 = space();
    			button = element("button");
    			button.textContent = "Test Me";
    			t8 = space();
    			div0 = element("div");
    			t9 = space();
    			div7 = element("div");
    			div2 = element("div");
    			t10 = space();
    			div3 = element("div");
    			t11 = space();
    			div4 = element("div");
    			t12 = space();
    			div5 = element("div");
    			t13 = space();
    			div6 = element("div");
    			t14 = space();
    			script = element("script");
    			script.textContent = "(function() {\n  let inputArea = document.getElementById(\"text-area\");\n  let text = `The app highlights lengthy, complex sentences and common errors; if you see a yellow sentence, shorten or split it. If you see a red highlight, your sentence is so dense and complicated that your readers will get lost trying to follow its meandering, splitting logic - try editing this sentence to remove the red.\nYou can utilize a shorter word in place of a purple one. Mouse over them for hints.\nAdverbs and weakening phrases are helpfully shown in blue. Get rid of them and pick words with force, perhaps.\nPhrases in green have been marked to show passive voice.\nYou can format your text with the toolbar.\nPaste in something you're working on and edit away. Or, click the Write button and compose something new.`;\n  inputArea.value = text;\n\n  let data = {\n  paragraphs: 0,\n  sentences: 0,\n  words: 0,\n  hardSentences: 0,\n  veryHardSentences: 0,\n  adverbs: 0,\n  passiveVoice: 0,\n  complex: 0\n  };\n\n  function format() {\n  data = {\n    paragraphs: 0,\n    sentences: 0,\n    words: 0,\n    hardSentences: 0,\n    veryHardSentences: 0,\n    adverbs: 0,\n    passiveVoice: 0,\n    complex: 0\n  };\n  (\"use strict\");\n  let inputArea = document.getElementById(\"text-area\");\n  let text = inputArea.value;\n  let paragraphs = text.split(\"\\n\");\n  let outputArea = document.getElementById(\"output\");\n  let hardSentences = paragraphs.map(p => getDifficultSentences(p));\n  let inP = hardSentences.map(para => `<p>${para}</p>`);\n  data.paragraphs = paragraphs.length;\n  console.log(data);\n  counters();\n  outputArea.innerHTML = inP.join(\" \");\n  }\n  window.format = format;\n  format();\n\n  function counters() {\n  document.querySelector(\"#adverb\").innerHTML = `You have used ${\n    data.adverbs\n  } adverb${data.adverbs > 1 ? \"s\" : \"\"}. Try to use ${Math.round(\n    data.paragraphs / 3\n  )} or less`;\n  document.querySelector(\n    \"#passive\"\n  ).innerHTML = `You have used passive voice ${data.passiveVoice} time${\n    data.passiveVoice > 1 ? \"s\" : \"\"\n  }. Aim for ${Math.round(data.sentences / 5)} or less.`;\n  document.querySelector(\"#complex\").innerHTML = `${data.complex} phrase${\n    data.complex > 1 ? \"s\" : \"\"\n  } could be simplified.`;\n  document.querySelector(\"#hardSentence\").innerHTML = `${\n    data.hardSentences\n  } of ${data.sentences} sentence${\n    data.sentences > 1 ? \"s are\" : \" is\"\n  } hard to read`;\n  document.querySelector(\"#veryHardSentence\").innerHTML = `${\n    data.veryHardSentences\n  } of ${data.sentences} sentence${\n    data.sentences > 1 ? \"s are\" : \" is\"\n  } very hard to read`;\n  }\n\n  function getDifficultSentences(p) {\n  let sentences = getSentenceFromParagraph(p + \" \");\n  data.sentences += sentences.length;\n  let hardOrNot = sentences.map(sent => {\n    let cleanSentence = sent.replace(/[^a-z0-9. ]/gi, \"\") + \".\";\n    let words = cleanSentence.split(\" \").length;\n    let letters = cleanSentence.split(\" \").join(\"\").length;\n    data.words += words;\n    sent = getAdverbs(sent);\n    sent = getComplex(sent);\n    sent = getPassive(sent);\n    sent = getQualifier(sent);\n    let level = calculateLevel(letters, words, 1);\n    if (words < 14) {\n    return sent;\n    } else if (level >= 10 && level < 14) {\n    data.hardSentences += 1;\n    return `<span class=\"hardSentence\">${sent}</span>`;\n    } else if (level >= 14) {\n    data.veryHardSentences += 1;\n    return `<span class=\"veryHardSentence\">${sent}</span>`;\n    } else {\n    return sent;\n    }\n  });\n\n  return hardOrNot.join(\" \");\n  }\n\n  function getPassive(sent) {\n  let originalWords = sent.split(\" \");\n  let words = sent\n    .replace(/[^a-z0-9. ]/gi, \"\")\n    .toLowerCase()\n    .split(\" \");\n  let ed = words.filter(word => word.match(/ed$/));\n  if (ed.length > 0) {\n    ed.forEach(match => {\n    originalWords = checkPrewords(words, originalWords, match);\n    });\n  }\n  return originalWords.join(\" \");\n  }\n\n  function checkPrewords(words, originalWords, match) {\n  let preWords = [\"is\", \"are\", \"was\", \"were\", \"be\", \"been\", \"being\"];\n  let index = words.indexOf(match);\n  if (preWords.indexOf(words[index - 1]) >= 0) {\n    data.passiveVoice += 1;\n    originalWords[index - 1] =\n    '<span class=\"passive\">' + originalWords[index - 1];\n    originalWords[index] = originalWords[index] + \"</span>\";\n    let next = checkPrewords(\n    words.slice(index + 1),\n    originalWords.slice(index + 1),\n    match\n    );\n    return [...originalWords.slice(0, index + 1), ...next];\n  } else {\n    return originalWords;\n  }\n  }\n\n  function getSentenceFromParagraph(p) {\n  let sentences = p\n    .split(\". \")\n    .filter(s => s.length > 0)\n    .map(s => s + \".\");\n  return sentences;\n  }\n\n  function calculateLevel(letters, words, sentences) {\n  if (words === 0 || sentences === 0) {\n    return 0;\n  }\n  let level = Math.round(\n    4.71 * (letters / words) + 0.5 * words / sentences - 21.43\n  );\n  return level <= 0 ? 0 : level;\n  }\n\n  function getAdverbs(sentence) {\n  let lyWords = getLyWords();\n  return sentence\n    .split(\" \")\n    .map(word => {\n    if (\n      word.replace(/[^a-z0-9. ]/gi, \"\").match(/ly$/) &&\n      lyWords[word.replace(/[^a-z0-9. ]/gi, \"\").toLowerCase()] === undefined\n    ) {\n      data.adverbs += 1;\n      return `<span class=\"adverb\">${word}</span>`;\n    } else {\n      return word;\n    }\n    })\n    .join(\" \");\n  }\n\n  function getComplex(sentence) {\n  let words = getComplexWords();\n  let wordList = Object.keys(words);\n  wordList.forEach(key => {\n    sentence = findAndSpan(sentence, key, \"complex\");\n  });\n  return sentence;\n  }\n\n  function findAndSpan(sentence, string, type) {\n  let index = sentence.toLowerCase().indexOf(string);\n  let a = { complex: \"complex\", qualifier: \"adverbs\" };\n  if (index >= 0) {\n    data[a[type]] += 1;\n    sentence =\n    sentence.slice(0, index) +\n    `<span class=\"${type}\">` +\n    sentence.slice(index, index + string.length) +\n    \"</span>\" +\n    findAndSpan(sentence.slice(index + string.length), string, type);\n  }\n  return sentence;\n  }\n\n  function getQualifier(sentence) {\n  let qualifiers = getQualifyingWords();\n  let wordList = Object.keys(qualifiers);\n  wordList.forEach(key => {\n    sentence = findAndSpan(sentence, key, \"qualifier\");\n  });\n  return sentence;\n  }\n\n  function getQualifyingWords() {\n  return {\n    \"i believe\": 1,\n    \"i consider\": 1,\n    \"i don't believe\": 1,\n    \"i don't consider\": 1,\n    \"i don't feel\": 1,\n    \"i don't suggest\": 1,\n    \"i don't think\": 1,\n    \"i feel\": 1,\n    \"i hope to\": 1,\n    \"i might\": 1,\n    \"i suggest\": 1,\n    \"i think\": 1,\n    \"i was wondering\": 1,\n    \"i will try\": 1,\n    \"i wonder\": 1,\n    \"in my opinion\": 1,\n    \"is kind of\": 1,\n    \"is sort of\": 1,\n    just: 1,\n    maybe: 1,\n    perhaps: 1,\n    possibly: 1,\n    \"we believe\": 1,\n    \"we consider\": 1,\n    \"we don't believe\": 1,\n    \"we don't consider\": 1,\n    \"we don't feel\": 1,\n    \"we don't suggest\": 1,\n    \"we don't think\": 1,\n    \"we feel\": 1,\n    \"we hope to\": 1,\n    \"we might\": 1,\n    \"we suggest\": 1,\n    \"we think\": 1,\n    \"we were wondering\": 1,\n    \"we will try\": 1,\n    \"we wonder\": 1\n  };\n  }\n\n  function getLyWords() {\n  return {\n    actually: 1,\n    additionally: 1,\n    allegedly: 1,\n    ally: 1,\n    alternatively: 1,\n    anomaly: 1,\n    apply: 1,\n    approximately: 1,\n    ashely: 1,\n    ashly: 1,\n    assembly: 1,\n    awfully: 1,\n    baily: 1,\n    belly: 1,\n    bely: 1,\n    billy: 1,\n    bradly: 1,\n    bristly: 1,\n    bubbly: 1,\n    bully: 1,\n    burly: 1,\n    butterfly: 1,\n    carly: 1,\n    charly: 1,\n    chilly: 1,\n    comely: 1,\n    completely: 1,\n    comply: 1,\n    consequently: 1,\n    costly: 1,\n    courtly: 1,\n    crinkly: 1,\n    crumbly: 1,\n    cuddly: 1,\n    curly: 1,\n    currently: 1,\n    daily: 1,\n    dastardly: 1,\n    deadly: 1,\n    deathly: 1,\n    definitely: 1,\n    dilly: 1,\n    disorderly: 1,\n    doily: 1,\n    dolly: 1,\n    dragonfly: 1,\n    early: 1,\n    elderly: 1,\n    elly: 1,\n    emily: 1,\n    especially: 1,\n    exactly: 1,\n    exclusively: 1,\n    family: 1,\n    finally: 1,\n    firefly: 1,\n    folly: 1,\n    friendly: 1,\n    frilly: 1,\n    gadfly: 1,\n    gangly: 1,\n    generally: 1,\n    ghastly: 1,\n    giggly: 1,\n    globally: 1,\n    goodly: 1,\n    gravelly: 1,\n    grisly: 1,\n    gully: 1,\n    haily: 1,\n    hally: 1,\n    harly: 1,\n    hardly: 1,\n    heavenly: 1,\n    hillbilly: 1,\n    hilly: 1,\n    holly: 1,\n    holy: 1,\n    homely: 1,\n    homily: 1,\n    horsefly: 1,\n    hourly: 1,\n    immediately: 1,\n    instinctively: 1,\n    imply: 1,\n    italy: 1,\n    jelly: 1,\n    jiggly: 1,\n    jilly: 1,\n    jolly: 1,\n    july: 1,\n    karly: 1,\n    kelly: 1,\n    kindly: 1,\n    lately: 1,\n    likely: 1,\n    lilly: 1,\n    lily: 1,\n    lively: 1,\n    lolly: 1,\n    lonely: 1,\n    lovely: 1,\n    lowly: 1,\n    luckily: 1,\n    mealy: 1,\n    measly: 1,\n    melancholy: 1,\n    mentally: 1,\n    molly: 1,\n    monopoly: 1,\n    monthly: 1,\n    multiply: 1,\n    nightly: 1,\n    oily: 1,\n    only: 1,\n    orderly: 1,\n    panoply: 1,\n    particularly: 1,\n    partly: 1,\n    paully: 1,\n    pearly: 1,\n    pebbly: 1,\n    polly: 1,\n    potbelly: 1,\n    presumably: 1,\n    previously: 1,\n    pualy: 1,\n    quarterly: 1,\n    rally: 1,\n    rarely: 1,\n    recently: 1,\n    rely: 1,\n    reply: 1,\n    reportedly: 1,\n    roughly: 1,\n    sally: 1,\n    scaly: 1,\n    shapely: 1,\n    shelly: 1,\n    shirly: 1,\n    shortly: 1,\n    sickly: 1,\n    silly: 1,\n    sly: 1,\n    smelly: 1,\n    sparkly: 1,\n    spindly: 1,\n    spritely: 1,\n    squiggly: 1,\n    stately: 1,\n    steely: 1,\n    supply: 1,\n    surly: 1,\n    tally: 1,\n    timely: 1,\n    trolly: 1,\n    ugly: 1,\n    underbelly: 1,\n    unfortunately: 1,\n    unholy: 1,\n    unlikely: 1,\n    usually: 1,\n    waverly: 1,\n    weekly: 1,\n    wholly: 1,\n    willy: 1,\n    wily: 1,\n    wobbly: 1,\n    wooly: 1,\n    worldly: 1,\n    wrinkly: 1,\n    yearly: 1\n  };\n  }\n\n  function getComplexWords() {\n  return {\n    \"a number of\": [\"many\", \"some\"],\n    abundance: [\"enough\", \"plenty\"],\n    \"accede to\": [\"allow\", \"agree to\"],\n    accelerate: [\"speed up\"],\n    accentuate: [\"stress\"],\n    accompany: [\"go with\", \"with\"],\n    accomplish: [\"do\"],\n    accorded: [\"given\"],\n    accrue: [\"add\", \"gain\"],\n    acquiesce: [\"agree\"],\n    acquire: [\"get\"],\n    additional: [\"more\", \"extra\"],\n    \"adjacent to\": [\"next to\"],\n    adjustment: [\"change\"],\n    admissible: [\"allowed\", \"accepted\"],\n    advantageous: [\"helpful\"],\n    \"adversely impact\": [\"hurt\"],\n    advise: [\"tell\"],\n    aforementioned: [\"remove\"],\n    aggregate: [\"total\", \"add\"],\n    aircraft: [\"plane\"],\n    \"all of\": [\"all\"],\n    alleviate: [\"ease\", \"reduce\"],\n    allocate: [\"divide\"],\n    \"along the lines of\": [\"like\", \"as in\"],\n    \"already existing\": [\"existing\"],\n    alternatively: [\"or\"],\n    ameliorate: [\"improve\", \"help\"],\n    anticipate: [\"expect\"],\n    apparent: [\"clear\", \"plain\"],\n    appreciable: [\"many\"],\n    \"as a means of\": [\"to\"],\n    \"as of yet\": [\"yet\"],\n    \"as to\": [\"on\", \"about\"],\n    \"as yet\": [\"yet\"],\n    ascertain: [\"find out\", \"learn\"],\n    assistance: [\"help\"],\n    \"at this time\": [\"now\"],\n    attain: [\"meet\"],\n    \"attributable to\": [\"because\"],\n    authorize: [\"allow\", \"let\"],\n    \"because of the fact that\": [\"because\"],\n    belated: [\"late\"],\n    \"benefit from\": [\"enjoy\"],\n    bestow: [\"give\", \"award\"],\n    \"by virtue of\": [\"by\", \"under\"],\n    cease: [\"stop\"],\n    \"close proximity\": [\"near\"],\n    commence: [\"begin or start\"],\n    \"comply with\": [\"follow\"],\n    concerning: [\"about\", \"on\"],\n    consequently: [\"so\"],\n    consolidate: [\"join\", \"merge\"],\n    constitutes: [\"is\", \"forms\", \"makes up\"],\n    demonstrate: [\"prove\", \"show\"],\n    depart: [\"leave\", \"go\"],\n    designate: [\"choose\", \"name\"],\n    discontinue: [\"drop\", \"stop\"],\n    \"due to the fact that\": [\"because\", \"since\"],\n    \"each and every\": [\"each\"],\n    economical: [\"cheap\"],\n    eliminate: [\"cut\", \"drop\", \"end\"],\n    elucidate: [\"explain\"],\n    employ: [\"use\"],\n    endeavor: [\"try\"],\n    enumerate: [\"count\"],\n    equitable: [\"fair\"],\n    equivalent: [\"equal\"],\n    evaluate: [\"test\", \"check\"],\n    evidenced: [\"showed\"],\n    exclusively: [\"only\"],\n    expedite: [\"hurry\"],\n    expend: [\"spend\"],\n    expiration: [\"end\"],\n    facilitate: [\"ease\", \"help\"],\n    \"factual evidence\": [\"facts\", \"evidence\"],\n    feasible: [\"workable\"],\n    finalize: [\"complete\", \"finish\"],\n    \"first and foremost\": [\"first\"],\n    \"for the purpose of\": [\"to\"],\n    forfeit: [\"lose\", \"give up\"],\n    formulate: [\"plan\"],\n    \"honest truth\": [\"truth\"],\n    however: [\"but\", \"yet\"],\n    \"if and when\": [\"if\", \"when\"],\n    impacted: [\"affected\", \"harmed\", \"changed\"],\n    implement: [\"install\", \"put in place\", \"tool\"],\n    \"in a timely manner\": [\"on time\"],\n    \"in accordance with\": [\"by\", \"under\"],\n    \"in addition\": [\"also\", \"besides\", \"too\"],\n    \"in all likelihood\": [\"probably\"],\n    \"in an effort to\": [\"to\"],\n    \"in between\": [\"between\"],\n    \"in excess of\": [\"more than\"],\n    \"in lieu of\": [\"instead\"],\n    \"in light of the fact that\": [\"because\"],\n    \"in many cases\": [\"often\"],\n    \"in order to\": [\"to\"],\n    \"in regard to\": [\"about\", \"concerning\", \"on\"],\n    \"in some instances \": [\"sometimes\"],\n    \"in terms of\": [\"omit\"],\n    \"in the near future\": [\"soon\"],\n    \"in the process of\": [\"omit\"],\n    inception: [\"start\"],\n    \"incumbent upon\": [\"must\"],\n    indicate: [\"say\", \"state\", \"or show\"],\n    indication: [\"sign\"],\n    initiate: [\"start\"],\n    \"is applicable to\": [\"applies to\"],\n    \"is authorized to\": [\"may\"],\n    \"is responsible for\": [\"handles\"],\n    \"it is essential\": [\"must\", \"need to\"],\n    literally: [\"omit\"],\n    magnitude: [\"size\"],\n    maximum: [\"greatest\", \"largest\", \"most\"],\n    methodology: [\"method\"],\n    minimize: [\"cut\"],\n    minimum: [\"least\", \"smallest\", \"small\"],\n    modify: [\"change\"],\n    monitor: [\"check\", \"watch\", \"track\"],\n    multiple: [\"many\"],\n    necessitate: [\"cause\", \"need\"],\n    nevertheless: [\"still\", \"besides\", \"even so\"],\n    \"not certain\": [\"uncertain\"],\n    \"not many\": [\"few\"],\n    \"not often\": [\"rarely\"],\n    \"not unless\": [\"only if\"],\n    \"not unlike\": [\"similar\", \"alike\"],\n    notwithstanding: [\"in spite of\", \"still\"],\n    \"null and void\": [\"use either null or void\"],\n    numerous: [\"many\"],\n    objective: [\"aim\", \"goal\"],\n    obligate: [\"bind\", \"compel\"],\n    obtain: [\"get\"],\n    \"on the contrary\": [\"but\", \"so\"],\n    \"on the other hand\": [\"omit\", \"but\", \"so\"],\n    \"one particular\": [\"one\"],\n    optimum: [\"best\", \"greatest\", \"most\"],\n    overall: [\"omit\"],\n    \"owing to the fact that\": [\"because\", \"since\"],\n    participate: [\"take part\"],\n    particulars: [\"details\"],\n    \"pass away\": [\"die\"],\n    \"pertaining to\": [\"about\", \"of\", \"on\"],\n    \"point in time\": [\"time\", \"point\", \"moment\", \"now\"],\n    portion: [\"part\"],\n    possess: [\"have\", \"own\"],\n    preclude: [\"prevent\"],\n    previously: [\"before\"],\n    \"prior to\": [\"before\"],\n    prioritize: [\"rank\", \"focus on\"],\n    procure: [\"buy\", \"get\"],\n    proficiency: [\"skill\"],\n    \"provided that\": [\"if\"],\n    purchase: [\"buy\", \"sale\"],\n    \"put simply\": [\"omit\"],\n    \"readily apparent\": [\"clear\"],\n    \"refer back\": [\"refer\"],\n    regarding: [\"about\", \"of\", \"on\"],\n    relocate: [\"move\"],\n    remainder: [\"rest\"],\n    remuneration: [\"payment\"],\n    require: [\"must\", \"need\"],\n    requirement: [\"need\", \"rule\"],\n    reside: [\"live\"],\n    residence: [\"house\"],\n    retain: [\"keep\"],\n    satisfy: [\"meet\", \"please\"],\n    shall: [\"must\", \"will\"],\n    \"should you wish\": [\"if you want\"],\n    \"similar to\": [\"like\"],\n    solicit: [\"ask for\", \"request\"],\n    \"span across\": [\"span\", \"cross\"],\n    strategize: [\"plan\"],\n    subsequent: [\"later\", \"next\", \"after\", \"then\"],\n    substantial: [\"large\", \"much\"],\n    \"successfully complete\": [\"complete\", \"pass\"],\n    sufficient: [\"enough\"],\n    terminate: [\"end\", \"stop\"],\n    \"the month of\": [\"omit\"],\n    therefore: [\"thus\", \"so\"],\n    \"this day and age\": [\"today\"],\n    \"time period\": [\"time\", \"period\"],\n    \"took advantage of\": [\"preyed on\"],\n    transmit: [\"send\"],\n    transpire: [\"happen\"],\n    \"until such time as\": [\"until\"],\n    utilization: [\"use\"],\n    utilize: [\"use\"],\n    validate: [\"confirm\"],\n    \"various different\": [\"various\", \"different\"],\n    \"whether or not\": [\"whether\"],\n    \"with respect to\": [\"on\", \"about\"],\n    \"with the exception of\": [\"except for\"],\n    witnessed: [\"saw\", \"seen\"]\n  };\n  }\n\n  function getJustifierWords() {\n  return {\n    \"i believe\": 1,\n    \"i consider\": 1,\n    \"i don't believe\": 1,\n    \"i don't consider\": 1,\n    \"i don't feel\": 1,\n    \"i don't suggest\": 1,\n    \"i don't think\": 1,\n    \"i feel\": 1,\n    \"i hope to\": 1,\n    \"i might\": 1,\n    \"i suggest\": 1,\n    \"i think\": 1,\n    \"i was wondering\": 1,\n    \"i will try\": 1,\n    \"i wonder\": 1,\n    \"in my opinion\": 1,\n    \"is kind of\": 1,\n    \"is sort of\": 1,\n    just: 1,\n    maybe: 1,\n    perhaps: 1,\n    possibly: 1,\n    \"we believe\": 1,\n    \"we consider\": 1,\n    \"we don't believe\": 1,\n    \"we don't consider\": 1,\n    \"we don't feel\": 1,\n    \"we don't suggest\": 1,\n    \"we don't think\": 1,\n    \"we feel\": 1,\n    \"we hope to\": 1,\n    \"we might\": 1,\n    \"we suggest\": 1,\n    \"we think\": 1,\n    \"we were wondering\": 1,\n    \"we will try\": 1,\n    \"we wonder\": 1\n  };\n  }\n})();";
    			add_location(style, file, 7, 1, 107);
    			add_location(title, file, 57, 0, 624);
    			add_location(h1, file, 59, 2, 664);
    			attr_dev(textarea, "name", "");
    			attr_dev(textarea, "id", "text-area");
    			attr_dev(textarea, "rows", "10");
    			add_location(textarea, file, 61, 4, 719);
    			attr_dev(button, "onclick", "format()");
    			add_location(button, file, 62, 4, 778);
    			attr_dev(div0, "id", "output");
    			add_location(div0, file, 63, 4, 826);
    			attr_dev(div1, "id", "left");
    			add_location(div1, file, 60, 2, 699);
    			attr_dev(div2, "id", "adverb");
    			attr_dev(div2, "class", "adverb counter");
    			add_location(div2, file, 66, 4, 882);
    			attr_dev(div3, "id", "passive");
    			attr_dev(div3, "class", "passive counter");
    			add_location(div3, file, 67, 4, 933);
    			attr_dev(div4, "id", "complex");
    			attr_dev(div4, "class", "complex counter");
    			add_location(div4, file, 68, 4, 986);
    			attr_dev(div5, "id", "hardSentence");
    			attr_dev(div5, "class", "hardSentence counter");
    			add_location(div5, file, 69, 4, 1039);
    			attr_dev(div6, "id", "veryHardSentence");
    			attr_dev(div6, "class", "veryHardSentence counter");
    			add_location(div6, file, 70, 4, 1102);
    			attr_dev(div7, "id", "right");
    			add_location(div7, file, 65, 2, 861);
    			add_location(div8, file, 58, 0, 656);
    			add_location(script, file, 75, 0, 1187);
    			add_location(main, file, 4, 0, 47);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, style);
    			append_dev(main, t1);
    			append_dev(main, title);
    			append_dev(main, t3);
    			append_dev(main, div8);
    			append_dev(div8, h1);
    			append_dev(div8, t5);
    			append_dev(div8, div1);
    			append_dev(div1, textarea);
    			append_dev(div1, t6);
    			append_dev(div1, button);
    			append_dev(div1, t8);
    			append_dev(div1, div0);
    			append_dev(div8, t9);
    			append_dev(div8, div7);
    			append_dev(div7, div2);
    			append_dev(div7, t10);
    			append_dev(div7, div3);
    			append_dev(div7, t11);
    			append_dev(div7, div4);
    			append_dev(div7, t12);
    			append_dev(div7, div5);
    			append_dev(div7, t13);
    			append_dev(div7, div6);
    			append_dev(main, t14);
    			append_dev(main, script);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
