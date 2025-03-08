const LiteZ = {
    components: {},
  
    component(name, options) {
      this.components[name] = options;
    },
  
    createApp(options) {
      return new LiteZApp(options);
    }
  };
  
  class LiteZApp {
    constructor(options) {
      this.lifecycleHooks = {
        beforeCreate: options.beforeCreate ? [options.beforeCreate] : [],
        created: options.created ? [options.created] : [],
        beforeMount: options.beforeMount ? [options.beforeMount] : [],
        mounted: options.mounted ? [options.mounted] : []
      };
      
      try {
        this.emitLifecycle('beforeCreate');
        this.el = document.querySelector(options.el);
        this.rawData = options.data ? options.data() : {};
        this.data = this.reactive(this.rawData);
        this.methods = options.methods || {};
        this.template = options.template || this.el.innerHTML;
        this.components = LiteZ.components;
        this.componentInstances = new Map();
        this.emitLifecycle('created');
        this.render();
        this.bindEvents();
        this.emitLifecycle('mounted');
      } catch (error) {
        this.handleError(error, 'Initialization failed');
      }
    }
  
    reactive(data, callback = () => this.update()) {
      const deepProxy = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        return new Proxy(obj, {
          get(target, key) {
            const value = target[key];
            return typeof value === 'object' && value !== null ? deepProxy(value) : value;
          },
          set(target, key, value) {
            target[key] = value;
            callback();
            return true;
          }
        });
      };
      return deepProxy(data);
    }
  
    render() {
      try {
        this.emitLifecycle('beforeMount');
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${this.template}</div>`, 'text/html');
        const root = doc.body.firstChild;
        if (root) {
          Array.from(root.childNodes).forEach(child => this.processNode(child));
          this.el.innerHTML = root.innerHTML;
        } else {
          this.el.innerHTML = '';
        }
      } catch (error) {
        this.handleError(error, 'Rendering failed');
      }
    }
  
    processNode(node, componentData = null) {
      if (!node) return;
  
      if (node.nodeType === Node.TEXT_NODE) {
        this.processTextContent(node, componentData || this.data);
        return;
      }
  
      if (node.nodeType !== Node.ELEMENT_NODE) return;
  
      if (node.hasAttribute('z-for')) {
        const [itemVar, listVar] = node.getAttribute('z-for').split(' in ').map(s => s.trim());
        const list = this.data[listVar] || [];
        const parent = node.parentNode;
        if (!parent) return;
        const fragment = document.createDocumentFragment();
        list.forEach((item, index) => {
          const clone = node.cloneNode(true);
          clone.removeAttribute('z-for');
          this.replaceTemplate(clone, itemVar, item, index);
          this.processNode(clone);
          fragment.appendChild(clone);
        });
        parent.replaceChild(fragment, node);
        return;
      }
  
      if (node.hasAttribute('z-if')) {
        const condition = node.getAttribute('z-if');
        const isTrue = this.evaluateCondition(condition, componentData || this.data);
        if (!isTrue && node.parentNode) {
          node.parentNode.removeChild(node);
          return;
        }
        node.removeAttribute('z-if');
      }
  
      if (node.hasAttribute('z-text')) {
        const key = node.getAttribute('z-text');
        const data = componentData || this.data;
        try {
          const fn = new Function('data', `with (data) { return ${key}; }`);
          const value = fn(data);
          node.textContent = value !== undefined ? value : '';
        } catch (e) {
          this.handleError(e, `z-text evaluation failed: ${key}`);
          node.textContent = '';
        }
        node.removeAttribute('z-text');
      }
  
      if (this.components[node.tagName.toLowerCase()]) {
        this.processComponent(node);
        return;
      }
  
      if (node.hasAttribute('z-show')) {
        const condition = node.getAttribute('z-show');
        const isTrue = this.evaluateCondition(condition, componentData || this.data);
        node.style.display = isTrue ? '' : 'none';
        node.removeAttribute('z-show');
      }
  
      this.processAttributes(node);
      
      Array.from(node.childNodes).forEach(child => this.processNode(child, componentData));
    }
  
    processComponent(node) {
      const name = node.tagName.toLowerCase();
      const component = this.components[name];
      const props = {};
      const showCondition = node.hasAttribute('z-show') ? node.getAttribute('z-show') : null;
      Array.from(node.attributes).forEach(attr => {
        if (attr.name.startsWith('z-prop:')) {
          const key = attr.name.replace('z-prop:', '');
          props[key] = this.data[attr.value] || attr.value;
        }
      });
  
      const compData = component.data ? component.data() : {};
      Object.assign(compData, props);
      const reactiveData = this.reactive(compData);
      const instance = { 
        data: reactiveData, 
        methods: component.methods || {},
        hooks: component
      };
      const instanceId = `${name}-${Math.random().toString(36).substr(2, 9)}`;
      this.componentInstances.set(instanceId, instance);
  
      const compDoc = new DOMParser().parseFromString(component.template, 'text/html');
      const compRoot = compDoc.body.firstChild;
      if (!node.parentNode) return;
      compRoot.setAttribute('data-component', instanceId);
      this.processNode(compRoot, reactiveData);
  
      if (showCondition) {
        const isTrue = this.evaluateCondition(showCondition, { ...this.data, ...reactiveData });
        compRoot.style.display = isTrue ? '' : 'none';
      }
  
      node.parentNode.replaceChild(compRoot, node);
    }
  
    processAttributes(node) {
      Array.from(node.attributes).forEach(attr => {
        if (attr.name.startsWith('z-bind:')) {
          const attrName = attr.name.replace('z-bind:', '');
          const value = this.data[attr.value] !== undefined ? this.data[attr.value] : attr.value;
          node.setAttribute(attrName, value);
          node.removeAttribute(attr.name);
        }
      });
    }
  
    processTextContent(node, data) {
      if (node.nodeType !== Node.TEXT_NODE) return;
      let text = node.textContent;
      const matches = text.match(/{{([^}]+)}}/g);
      if (matches) {
        matches.forEach(match => {
          const expression = match.slice(2, -2).trim();
          try {
            const fn = new Function('data', `with (data) { return ${expression}; }`);
            const value = fn(data);
            text = text.replace(match, value !== undefined ? value : '');
          } catch (e) {
            this.handleError(e, `Text binding failed: ${expression}`);
            text = text.replace(match, '');
          }
        });
        node.textContent = text;
      }
    }
  
    replaceTemplate(node, itemVar, item, index) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode;
      while (textNode = walker.nextNode()) {
        textNode.textContent = textNode.textContent
          .replace(new RegExp(`{{${itemVar}}}`, 'g'), item)
          .replace(new RegExp(`{{${itemVar}\\.index}}`, 'g'), index);
      }
    }
  
    evaluateCondition(condition, data) {
      try {
        const fn = new Function('data', `with (data) { return ${condition}; }`);
        return fn(data);
      } catch (e) {
        this.handleError(e, `Condition evaluation failed: ${condition}`);
        return false;
      }
    }
  
    update() {
      this.render();
      this.bindEvents();
    }
  
    bindEvents() {
      const elements = this.el.querySelectorAll('[z-on\\:click], [z-on\\:mouseover]');
      elements.forEach(el => {
        const eventAttrs = Array.from(el.attributes).filter(attr => attr.name.startsWith('z-on:'));
        eventAttrs.forEach(attr => {
          const eventName = attr.name.split(':')[1];
          const methodName = attr.value;
          const parentNode = el.closest('[data-component]');
          if (parentNode) {
            const instanceId = parentNode.getAttribute('data-component');
            const instance = this.componentInstances.get(instanceId);
            if (instance && instance.methods[methodName]) {
              el.removeEventListener(eventName, instance.methods[methodName]);
              el.addEventListener(eventName, () => {
                instance.methods[methodName].call(instance.data);
              });
            }
          } else if (this.methods[methodName]) {
            el.removeEventListener(eventName, this.methods[methodName]);
            el.addEventListener(eventName, () => {
              this.methods[methodName].call(this.data);
            });
          }
        });
      });
  
      const inputs = this.el.querySelectorAll('[z-model]');
      inputs.forEach(input => {
        const key = input.getAttribute('z-model');
        const parentNode = input.closest('[data-component]');
        if (parentNode) {
          const instanceId = parentNode.getAttribute('data-component');
          const instance = this.componentInstances.get(instanceId);
          if (instance && instance.data[key] !== undefined) {
            if (input.type === 'checkbox') {
              input.checked = instance.data[key];
              input.removeEventListener('change', input._handler);
              input._handler = () => { instance.data[key] = input.checked; };
              input.addEventListener('change', input._handler);
            } else {
              input.value = instance.data[key];
              input.removeEventListener('input', input._handler);
              input._handler = () => { instance.data[key] = input.value; };
              input.addEventListener('input', input._handler);
            }
          }
        } else if (this.data[key] !== undefined) {
          if (input.type === 'checkbox') {
            input.checked = this.data[key];
            input.removeEventListener('change', input._handler);
            input._handler = () => { this.data[key] = input.checked; };
            input.addEventListener('change', input._handler);
          } else {
            input.value = this.data[key];
            input.removeEventListener('input', input._handler);
            input._handler = () => { this.data[key] = input.value; };
            input.addEventListener('input', input._handler);
          }
        }
      });
    }
  
    handleError(error, context) {
      console.error(`[${context}]: ${error.message}`);
      this.rawData.error = { message: error.message, context };
    }
  
    registerHook(hookName, callback) {
      if (this.lifecycleHooks[hookName]) {
        this.lifecycleHooks[hookName].push(callback);
      }
    }
  
    emitLifecycle(hookName) {
      if (this.lifecycleHooks[hookName]) {
        this.lifecycleHooks[hookName].forEach(callback => callback.call(this));
      }
    }
  }