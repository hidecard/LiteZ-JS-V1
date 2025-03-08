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
    this.el = document.querySelector(options.el);
    this.data = this.reactive(options.data ? options.data() : {});
    this.methods = options.methods || {};
    this.template = options.template || this.el.innerHTML;
    this.components = LiteZ.components;
    this.componentInstances = new Map();
    this.render();
    this.bindEvents();
  }

  reactive(data, callback = () => this.update()) {
    return new Proxy(data, {
      get(target, key) {
        return target[key];
      },
      set(target, key, value) {
        target[key] = value;
        callback();
        return true;
      }
    });
  }

  render() {
    let html = this.template;

    // z-for
    const forRegex = /<(\w+)[^>]*z-for=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/g;
    html = html.replace(forRegex, (match, tag, expression, content) => {
      const [itemVar, listVar] = expression.split(' in ').map(s => s.trim());
      const list = this.data[listVar] || [];
      let result = '';
      list.forEach((item, index) => {
        let itemHtml = content;
        itemHtml = itemHtml.replace(new RegExp(`{{${itemVar}}}`, 'g'), item);
        itemHtml = itemHtml.replace(new RegExp(`{{${itemVar}\\.index}}`, 'g'), index);
        result += itemHtml;
      });
      return result;
    });

    // z-if and z-else
    const ifElseRegex = /<(\w+)[^>]*z-if=["']([^"']+)["'][^>]*>([\s\S]*?)(?:<\/\1>\s*<[^>]+z-else[^>]*>([\s\S]*?)<\/[^>]+>|<\/\1>)/g;
    html = html.replace(ifElseRegex, (match, tag, condition, ifContent, elseContent) => {
      const isTrue = this.evaluateCondition(condition);
      return isTrue ? ifContent : (elseContent || '');
    });

    // z-show
    const showRegex = /<(\w+)([^>]*)z-show=["']([^"']+)["']([^>]*)>/g;
    html = html.replace(showRegex, (match, tag, beforeAttrs, condition, afterAttrs) => {
      const isTrue = this.evaluateCondition(condition);
      const styleAttr = `style="display: ${isTrue ? '' : 'none'}"`;
      return `<${tag}${beforeAttrs} ${styleAttr}${afterAttrs}>`;
    });

    // z-bind
    const bindRegex = /<(\w+)[^>]*z-bind:([^=]+)="([^"]+)"[^>]*>/g;
    html = html.replace(bindRegex, (match, tag, attr, value) => {
      const attrValue = this.data[value] !== undefined ? this.data[value] : value;
      return match.replace(`z-bind:${attr}="${value}"`, `${attr}="${attrValue}"`);
    });

    // z-html 
    const htmlRegex = /<(\w+)([^>]*)z-html=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/\1>/g;
    html = html.replace(htmlRegex, (match, tag, beforeAttrs, value, afterAttrs) => {
      const htmlContent = this.data[value] || '';
      return `<${tag}${beforeAttrs}${afterAttrs}>${htmlContent}</${tag}>`;
    });

    // z-text 
    const textRegex = /<(\w+)([^>]*)z-text=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/\1>/g;
    html = html.replace(textRegex, (match, tag, beforeAttrs, value, afterAttrs) => {
      const textContent = this.data[value] || '';
      return `<${tag}${beforeAttrs}${afterAttrs}>${textContent}</${tag}>`;
    });

 
    for (let key in this.data) {
      if (typeof this.data[key] !== 'object') {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), this.data[key]);
      }
    }


    for (let name in this.components) {
      const component = this.components[name];
      const regex = new RegExp(`<${name}(.*?)></${name}>`, 'g');
      html = html.replace(regex, (match, attrs) => {
        const props = {};
        const propMatches = attrs.match(/z-prop:([^=]+)="([^"]+)"/g);
        if (propMatches) {
          propMatches.forEach(prop => {
            const [, key, value] = prop.match(/z-prop:([^=]+)="([^"]+)"/);
            props[key] = this.data[value] || value;
          });
        }

        const compData = component.data ? component.data() : {};
        Object.assign(compData, props);
        const reactiveData = this.reactive(compData);
        const instance = { data: reactiveData, methods: component.methods || {} };
        this.componentInstances.set(`${name}-${Math.random().toString(36).substr(2, 9)}`, instance);

        let compHtml = component.template;
        for (let key in reactiveData) {
          compHtml = compHtml.replace(new RegExp(`{{${key}}}`, 'g'), reactiveData[key]);
        }
        return `<div data-component="${name}">${compHtml}</div>`;
      });
    }

    this.el.innerHTML = html;
  }

  evaluateCondition(condition) {
    try {
      const fn = new Function('data', `with (data) { return ${condition}; }`);
      return fn(this.data);
    } catch (e) {
      console.error('Directive error:', e);
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
          const compName = parentNode.getAttribute('data-component');
          const instance = Array.from(this.componentInstances.entries())
            .find(([key]) => key.startsWith(compName))?.[1];
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
        const compName = parentNode.getAttribute('data-component');
        const instance = Array.from(this.componentInstances.entries())
          .find(([key]) => key.startsWith(compName))?.[1];
        if (instance && instance.data[key] !== undefined) {
          input.value = instance.data[key];
          input.removeEventListener('input', input._handler);
          input._handler = () => { instance.data[key] = input.value; };
          input.addEventListener('input', input._handler);
        }
      } else if (this.data[key] !== undefined) {
        input.value = this.data[key];
        input.removeEventListener('input', input._handler);
        input._handler = () => { this.data[key] = input.value; };
        input.addEventListener('input', input._handler);
      }
    });
  }
}